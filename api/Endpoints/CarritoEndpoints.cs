using System.Globalization;
using System.Security.Cryptography;
using Dapper;
using Floravia.Core.Entidades;
using Npgsql;

namespace Api.Endpoints;

public record ItemDto(int IdProducto, int Cantidad);
public record CantidadDto(int Cantidad);

public static class CarritoEndpoints
{
    public static void MapCarrito(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/carrito").AllowAnonymous();

        g.MapGet("/", async (HttpContext ctx, NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            return Results.Ok(await Vista(conn, await Buscar(conn, ctx)));
        });

        g.MapPost("/items", async (ItemDto d, HttpContext ctx, NpgsqlDataSource db) =>
        {
            if (d.Cantidad < 1 || d.Cantidad > 99) return Results.BadRequest(new { error = "Cantidad inválida" });
            await using var conn = await db.OpenConnectionAsync();
            var (id, tokenNuevo) = await ObtenerOCrear(conn, ctx);
            var actual = await conn.ExecuteScalarAsync<int?>(
                "SELECT cantidad FROM item_carrito WHERE id_carrito = @id AND id_producto = @p",
                new { id, p = d.IdProducto }) ?? 0;
            var error = await FijarCantidad(conn, id, d.IdProducto, actual + d.Cantidad);
            if (error is not null) return Results.Conflict(new { error });
            // 'token' solo viene la primera vez: el frontend debe guardarlo (localStorage)
            return Results.Ok(new { token = tokenNuevo, carrito = await Vista(conn, id) });
        });

        g.MapPut("/items/{idProducto:int}", async (int idProducto, CantidadDto d, HttpContext ctx, NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            var id = await Buscar(conn, ctx);
            if (id is null) return Results.NotFound();
            if (d.Cantidad <= 0)
                await conn.ExecuteAsync("DELETE FROM item_carrito WHERE id_carrito = @id AND id_producto = @idProducto",
                    new { id, idProducto });
            else
            {
                var error = await FijarCantidad(conn, id.Value, idProducto, d.Cantidad);
                if (error is not null) return Results.Conflict(new { error });
            }
            return Results.Ok(await Vista(conn, id));
        });

        g.MapDelete("/items/{idProducto:int}", async (int idProducto, HttpContext ctx, NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            var id = await Buscar(conn, ctx);
            if (id is null) return Results.NotFound();
            await conn.ExecuteAsync("DELETE FROM item_carrito WHERE id_carrito = @id AND id_producto = @idProducto",
                new { id, idProducto });
            return Results.Ok(await Vista(conn, id));
        });

        // Fuera del grupo anónimo a propósito: AllowAnonymous gana sobre RequireAuthorization.
        app.MapPost("/api/carrito/fusionar", async (HttpContext ctx, NpgsqlDataSource db) =>
        {
            if (!int.TryParse(ctx.User.FindFirst("cid")?.Value, out var cid)) return Results.Forbid();
            var token = ctx.Request.Headers["X-Carrito-Token"].FirstOrDefault();

            await using var conn = await db.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();
            if (!string.IsNullOrWhiteSpace(token))
            {
                var origen = await conn.ExecuteScalarAsync<int?>(
                    "SELECT id_carrito FROM carrito WHERE token_sesion = @token AND id_cliente IS NULL AND estado = 'ACTIVO'",
                    new { token }, tx);
                if (origen is int o)
                {
                    var destino = await conn.ExecuteScalarAsync<int?>(
                        "SELECT id_carrito FROM carrito WHERE id_cliente = @cid AND estado = 'ACTIVO'", new { cid }, tx);
                    if (destino is int d)
                    {
                        await conn.ExecuteAsync(
                            @"INSERT INTO item_carrito (id_carrito, id_producto, cantidad, precio_unitario)
                              SELECT @d, i.id_producto, i.cantidad, p.precio
                              FROM item_carrito i JOIN producto p ON p.id_producto = i.id_producto
                              WHERE i.id_carrito = @o AND p.estado = 'ACTIVO'
                              ON CONFLICT (id_carrito, id_producto)
                              DO UPDATE SET cantidad = LEAST(item_carrito.cantidad + EXCLUDED.cantidad, 99)",
                            new { d, o }, tx);
                        await conn.ExecuteAsync(
                            "UPDATE carrito SET estado = 'ABANDONADO', token_sesion = NULL WHERE id_carrito = @o", new { o }, tx);
                    }
                    else
                        await conn.ExecuteAsync(
                            "UPDATE carrito SET id_cliente = @cid, token_sesion = NULL WHERE id_carrito = @o",
                            new { cid, o }, tx);
                }
            }
            await tx.CommitAsync();
            return Results.Ok(await Vista(conn, await Buscar(conn, ctx)));
        }).RequireAuthorization("Cliente");
    }

    private static (int? cid, string? token) Dueno(HttpContext ctx)
    {
        if (int.TryParse(ctx.User.FindFirst("cid")?.Value, out var cid)) return (cid, null);
        var t = ctx.Request.Headers["X-Carrito-Token"].FirstOrDefault();
        return (null, string.IsNullOrWhiteSpace(t) ? null : t);
    }

    private static async Task<int?> Buscar(NpgsqlConnection c, HttpContext ctx)
    {
        var (cid, token) = Dueno(ctx);
        if (cid is not null)
            return await c.ExecuteScalarAsync<int?>(
                "SELECT id_carrito FROM carrito WHERE id_cliente = @cid AND estado = 'ACTIVO'", new { cid });
        if (token is not null)
            return await c.ExecuteScalarAsync<int?>(
                "SELECT id_carrito FROM carrito WHERE token_sesion = @token AND id_cliente IS NULL AND estado = 'ACTIVO'",
                new { token });
        return null;
    }

    private static async Task<(int id, string? tokenNuevo)> ObtenerOCrear(NpgsqlConnection c, HttpContext ctx)
    {
        if (await Buscar(c, ctx) is int existente) return (existente, null);
        var (cid, _) = Dueno(ctx);
        if (cid is not null)
            return (await c.ExecuteScalarAsync<int>(
                "INSERT INTO carrito (id_cliente) VALUES (@cid) RETURNING id_carrito", new { cid }), null);

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var nuevo = await c.ExecuteScalarAsync<int>(
            "INSERT INTO carrito (token_sesion) VALUES (@token) RETURNING id_carrito", new { token });
        return (nuevo, token);
    }

    private static async Task<string?> FijarCantidad(NpgsqlConnection c, int idCarrito, int idProducto, int cantidad)
    {
        var disponible = await c.ExecuteScalarAsync<int?>(
            "SELECT stock - stock_reservado FROM producto WHERE id_producto = @idProducto AND estado = 'ACTIVO'",
            new { idProducto });
        if (disponible is null) return "Producto no disponible";
        if (cantidad > disponible) return $"Solo hay {disponible} unidades disponibles";

        await c.ExecuteAsync(
            @"INSERT INTO item_carrito (id_carrito, id_producto, cantidad, precio_unitario)
              SELECT @idCarrito, id_producto, @cantidad, precio FROM producto WHERE id_producto = @idProducto
              ON CONFLICT (id_carrito, id_producto)
              DO UPDATE SET cantidad = EXCLUDED.cantidad, precio_unitario = EXCLUDED.precio_unitario",
            new { idCarrito, idProducto, cantidad });
        return null;
    }

    private static async Task<CarritoVista> Vista(NpgsqlConnection c, int? idCarrito)
    {
        var v = new CarritoVista();
        var iva = await c.ExecuteScalarAsync<string?>("SELECT valor FROM parametro WHERE clave = 'IVA_PORCENTAJE'");
        v.PorcentajeIva = decimal.Parse(iva ?? "15", CultureInfo.InvariantCulture);

        if (idCarrito is int id)
        {
            v.Carrito = await c.QuerySingleAsync<Carrito>("SELECT * FROM carrito WHERE id_carrito = @id", new { id });
            v.Items = (await c.QueryAsync<ItemCarrito>(
                @"SELECT i.id_item, i.id_carrito, i.id_producto, i.cantidad, p.precio AS precio_unitario,
                         p.codigo, p.nombre, (p.stock - p.stock_reservado) AS stock_disponible,
                         (SELECT m.ruta FROM imagen_producto m WHERE m.id_producto = p.id_producto AND m.es_principal) AS imagen
                  FROM item_carrito i JOIN producto p ON p.id_producto = i.id_producto
                  WHERE i.id_carrito = @id ORDER BY i.id_item", new { id })).ToList();
        }
        v.Subtotal = v.Items.Sum(i => i.Subtotal);
        v.Iva = Math.Round(v.Subtotal * v.PorcentajeIva / 100m, 2, MidpointRounding.AwayFromZero);
        v.TotalSinEnvio = v.Subtotal + v.Iva;
        return v;
    }
}