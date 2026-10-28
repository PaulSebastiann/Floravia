using System.Security.Claims;
using Api.Auth;
using Api.Endpoints;
using Dapper;
using Floravia.Core;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();

var cs = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Falta ConnectionStrings:Default");
builder.Services.AddSingleton(NpgsqlDataSource.Create(cs));
builder.Services.AddSingleton<TokenService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = TokenService.Issuer,
            ValidAudience = TokenService.Audience,
            IssuerSigningKey = TokenService.Clave(builder.Configuration),
            RoleClaimType = "role",
            NameClaimType = "sub",
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

// Seguro por defecto: todo exige sesión salvo lo marcado con AllowAnonymous.
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy("Admin", p => p.RequireRole(Roles.Admin))
    .AddPolicy("Cliente", p => p.RequireRole(Roles.Cliente));

var origenes = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p
    .WithOrigins(origenes).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment()) app.MapOpenApi().AllowAnonymous();

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (NpgsqlDataSource db) =>
{
    await using var cmd = db.CreateCommand("SELECT 1");
    await cmd.ExecuteScalarAsync();
    return Results.Ok(new { estado = "ok" });
}).AllowAnonymous();

app.MapAuth();
app.MapTienda();
app.MapCarrito();

// Todo lo de administración vive en este grupo: ninguna ruta puede quedar pública por descuido.
var admin = app.MapGroup("/api/admin").RequireAuthorization("Admin");
admin.MapGet("/ping", (ClaimsPrincipal u) => Results.Ok(new { ok = true, correo = u.FindFirst("email")?.Value }));

// Comprar exige cuenta de cliente. Aquí irá POST /api/pedidos (crear pedido).
var pedidos = app.MapGroup("/api/pedidos").RequireAuthorization("Cliente");
pedidos.MapGet("/mios", async (ClaimsPrincipal u, NpgsqlDataSource db) =>
{
    var cid = int.Parse(u.FindFirst("cid")!.Value);
    await using var conn = await db.OpenConnectionAsync();
    return Results.Ok(await conn.QueryAsync<Floravia.Core.Entidades.Pedido>(
        "SELECT * FROM pedido WHERE id_cliente = @cid ORDER BY fecha DESC", new { cid }));
});

app.Run();