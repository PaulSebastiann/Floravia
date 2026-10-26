using Dapper;
using Floravia.Core.Entidades;
using Npgsql;

DefaultTypeMap.MatchNamesWithUnderscores = true; // id_categoria -> IdCategoria

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var cs = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Falta ConnectionStrings:Default");
builder.Services.AddSingleton(NpgsqlDataSource.Create(cs));

builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p
    .WithOrigins("http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");

app.MapGet("/health", async (NpgsqlDataSource db) =>
{
    await using var cmd = db.CreateCommand("SELECT 1");
    await cmd.ExecuteScalarAsync();
    return Results.Ok(new { estado = "ok", baseDatos = "conectada" });
});

app.MapGet("/api/categorias", async (NpgsqlDataSource db) =>
{
    await using var conn = await db.OpenConnectionAsync();
    var categorias = await conn.QueryAsync<Categoria>(
        "SELECT id_categoria, id_categoria_padre, nombre, descripcion FROM categoria ORDER BY nombre");
    return Results.Ok(categorias);
});

app.Run();