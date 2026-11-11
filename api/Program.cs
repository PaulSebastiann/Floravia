using System.Threading.RateLimiting;
using Api.Archivos;
using Api.Auth;
using Api.Endpoints;
using Api.Endpoints.Administracion;
using Api.Servicios;
using Floravia.Application;
using Floravia.Core;
using Floravia.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
var esDesarrollo = builder.Environment.IsDevelopment();

// ───────────── Configuración obligatoria: si falta algo, la app NO arranca (mejor que fallar a medias) ─────────────
var cadenaConexion = cfg.GetConnectionString("Default")
    ?? throw new InvalidOperationException(
        "Falta ConnectionStrings:Default. Usa: dotnet user-secrets set \"ConnectionStrings:Default\" \"Host=...;Database=floravia;Username=...;Password=...\"");

var claveJwt = cfg["Jwt:Key"];
if (string.IsNullOrWhiteSpace(claveJwt) || claveJwt.Length < 32)
    throw new InvalidOperationException("Jwt:Key es obligatoria y debe tener al menos 32 caracteres.");
if (!esDesarrollo && claveJwt.StartsWith("DEV-ONLY", StringComparison.Ordinal))
    throw new InvalidOperationException("Estás usando la clave JWT de desarrollo fuera de Development. Define una propia (variable Jwt__Key).");

var rutaImagenes = cfg["Almacen:RutaImagenes"] ?? Path.Combine(builder.Environment.ContentRootPath, "almacen", "imagenes");
var rutaComprobantes = cfg["Almacen:RutaComprobantes"] ?? Path.Combine(builder.Environment.ContentRootPath, "almacen", "comprobantes");

// ───────────── Servicios ─────────────
// Toda la lógica de negocio vive en la capa Application: la API solo traduce HTTP ⇄ casos de uso.
var almacenImagenes = new AlmacenLocal(rutaImagenes);
builder.Services.AddSingleton(new FloraviaServicios(cadenaConexion, almacenImagenes));
builder.Services.AddSingleton(new ComprobanteStore(rutaComprobantes));
builder.Services.AddSingleton<TokenService>();

if (!string.IsNullOrWhiteSpace(cfg["Smtp:Host"])) builder.Services.AddSingleton<IServicioCorreo, CorreoSmtp>();
else builder.Services.AddSingleton<IServicioCorreo, CorreoConsola>();

builder.Services.AddHostedService<LimpiezaReservasService>();
builder.Services.AddHostedService<SemillaAdmin>();

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ManejadorErrores>();

// Subidas: 5 MB de archivo + un margen para el resto del formulario.
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 6 * 1024 * 1024);

// ───────────── Autenticación y autorización ─────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = TokenService.Issuer,
            ValidateAudience = true,
            ValidAudience = TokenService.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = TokenService.Clave(cfg),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            RoleClaimType = "role",
            NameClaimType = "sub",
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

// Seguro por defecto: todo exige sesión salvo lo marcado con AllowAnonymous.
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy("Admin", p => p.RequireRole(Roles.Admin))
    .AddPolicy("Cliente", p => p.RequireRole(Roles.Cliente));

// ───────────── CORS ─────────────
var origenes = cfg.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p
    .WithOrigins(origenes)
    .WithHeaders("Authorization", "Content-Type", "X-Carrito-Token")
    .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));

// ───────────── Límite de peticiones (por IP) ─────────────
// "estricta": login, registro, recuperar contraseña y pago con tarjeta. Global: protección general.
int Limite(string clave, int porDefecto) => int.TryParse(cfg[clave], out var v) && v > 0 ? v : porDefecto;
var porMinuto = Limite("RateLimit:PorMinuto", 300);
var estrictoPorMinuto = Limite("RateLimit:EstrictoPorMinuto", 10);
static string Ip(HttpContext c) => c.Connection.RemoteIpAddress?.ToString() ?? "desconocida";

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c =>
        c.Request.Path.StartsWithSegments("/health")
            ? RateLimitPartition.GetNoLimiter("salud")
            : RateLimitPartition.GetFixedWindowLimiter(Ip(c), _ => new FixedWindowRateLimiterOptions
            { PermitLimit = porMinuto, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("estricta", c => RateLimitPartition.GetFixedWindowLimiter(Ip(c), _ => new FixedWindowRateLimiterOptions
    { PermitLimit = estrictoPorMinuto, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new ProblemDetails { Status = 429, Title = "Demasiadas solicitudes", Detail = "Espera un momento antes de volver a intentarlo." },
            options: null, contentType: "application/problem+json", cancellationToken: ct);
    };
});

// ───────────── Pipeline ─────────────
var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (!esDesarrollo && cfg.GetValue<bool>("Seguridad:ForzarHttps"))
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "no-referrer";
    h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});

// Solo las fotos de productos son públicas (/media/productos/...). Los comprobantes NO se sirven como estáticos.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.GetFullPath(rutaImagenes)),
    RequestPath = "/media",
    ServeUnknownFileTypes = false,
    OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "public, max-age=604800",
});

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (esDesarrollo || cfg.GetValue<bool>("OpenApi:Habilitado")) app.MapOpenApi().AllowAnonymous();

// ───────────── Rutas ─────────────
// /health: la app está viva. /health/ready: además hay conexión con la base de datos (para Docker/balanceadores).
app.MapGet("/health", () => Results.Ok(new { estado = "ok" })).AllowAnonymous();
app.MapGet("/health/ready", async (FloraviaServicios s) =>
{
    try
    {
        await s.Db.EscalarAsync<int>("SELECT 1");
        return Results.Ok(new { estado = "ok", baseDatos = "ok" });
    }
    catch
    {
        return Results.Json(new { estado = "degradado", baseDatos = "sin conexión" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapAuth();
app.MapTienda();
app.MapCarrito();
app.MapCuenta();
app.MapPedidos();
app.MapAdmin();

app.Run();

/// <summary>Necesario para que los tests de integración (WebApplicationFactory) puedan arrancar la API.</summary>
public partial class Program { }
