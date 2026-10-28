using Dapper;
using Floravia.Core.Entidades;
using Npgsql;

namespace Api.Endpoints;

public static class TiendaEndpoints
{
    private const string Cte = @"WITH RECURSIVE arbol AS (
        SELECT id_categoria FROM categoria WHERE id_categoria = @IdCategoria
        UNION ALL
        SELECT c.id_categoria FROM categoria c JOIN arbol a ON c.id_categoria_padre = a.id_categoria) ";

    private const string Desde = @" FROM producto p JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE p.estado = 'ACTIVO'
          AND (@IdCategoria IS NULL OR p.id_categoria IN (SELECT id_categoria FROM arbol))
          AND (@Texto IS NULL OR p.nombre ILIKE '%' || @Texto || '%' OR p.codigo ILIKE '%' || @Texto || '%')
          AND (@PrecioMin IS NULL OR p.precio >= @PrecioMin)
          AND (@PrecioMax IS NULL OR p.precio <= @PrecioMax)
          AND (@IdColor IS NULL OR EXISTS (SELECT 1 FROM producto_color pc
                                           WHERE pc.id_producto = p.id_producto AND pc.id_color = @IdColor))
          AND (NOT @SoloConStock OR p.stock - p.stock_reservado > 0)";

    // El público nunca recibe stock_minimo ni stock_reservado.
    private static object Publico(Producto p) => new
    {
        p.IdProducto, p.IdCategoria, p.Codigo, p.Nombre, p.Descripcion, p.Cuidados,
        p.Precio, p.StockDisponible, p.CategoriaNombre, p.ImagenPrincipal
    };

    public static void MapTienda(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api").AllowAnonymous();

        g.MapGet("/categorias", async (NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            return Results.Ok(await conn.QueryAsync<Categoria>(
                "SELECT id_categoria, id_categoria_padre, nombre, descripcion FROM categoria ORDER BY nombre"));
        });

        g.MapGet("/productos", async (
            int? idCategoria, string? texto, decimal? precioMin, decimal? precioMax,
            int? idColor, bool? soloConStock, string? orden, int? pagina, int? tamanoPagina,
            NpgsqlDataSource db) =>
        {
            var f = new FiltroProducto
            {
            IdCategoria = idCategoria,
            Texto = string.IsNullOrWhiteSpace(texto) ? null : texto.Trim(),
            PrecioMin = precioMin,
            PrecioMax = precioMax,
            IdColor = idColor,
            SoloActivos = true,                       // forzado: el público no ve inactivos
            SoloConStock = soloConStock ?? false,
            Orden = orden ?? "recientes",
            Pagina = Math.Max(1, pagina ?? 1),
            TamanoPagina = Math.Clamp(tamanoPagina ?? 12, 1, 50)
        };

    var ordenSql = f.Orden switch
    {
        "precio_asc"  => "p.precio ASC, p.id_producto",
        "precio_desc" => "p.precio DESC, p.id_producto",
        "nombre"      => "p.nombre ASC, p.id_producto",
        _             => "p.creado_en DESC, p.id_producto"
    };
    var args = new { f.IdCategoria, f.Texto, f.PrecioMin, f.PrecioMax, f.IdColor, f.SoloConStock,
                     f.TamanoPagina, Offset = (f.Pagina - 1) * f.TamanoPagina };

    await using var conn = await db.OpenConnectionAsync();
    var total = await conn.ExecuteScalarAsync<int>(Cte + "SELECT COUNT(*)" + Desde, args);
    var items = await conn.QueryAsync<Producto>(Cte + @"SELECT p.id_producto, p.id_categoria, p.codigo, p.nombre,
            p.descripcion, p.cuidados, p.precio, p.stock, p.stock_reservado, c.nombre AS categoria_nombre,
            (SELECT m.ruta FROM imagen_producto m WHERE m.id_producto = p.id_producto AND m.es_principal) AS imagen_principal"
        + Desde + $" ORDER BY {ordenSql} LIMIT @TamanoPagina OFFSET @Offset", args);

            return Results.Ok(new
            {
        items = items.Select(Publico),
        total, pagina = f.Pagina, tamanoPagina = f.TamanoPagina,
        totalPaginas = (int)Math.Ceiling(total / (double)f.TamanoPagina)
            });
        });

        g.MapGet("/productos/{id:int}", async (int id, NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            var p = await conn.QuerySingleOrDefaultAsync<Producto>(
                @"SELECT p.*, c.nombre AS categoria_nombre,
                    (SELECT m.ruta FROM imagen_producto m WHERE m.id_producto = p.id_producto AND m.es_principal) AS imagen_principal
                  FROM producto p JOIN categoria c ON c.id_categoria = p.id_categoria
                  WHERE p.id_producto = @id AND p.estado = 'ACTIVO'", new { id });
            if (p is null) return Results.NotFound();

            var imagenes = await conn.QueryAsync<ImagenProducto>(
                "SELECT * FROM imagen_producto WHERE id_producto = @id ORDER BY orden", new { id });
            var colores = await conn.QueryAsync<Color>(
                @"SELECT c.* FROM color c JOIN producto_color pc ON pc.id_color = c.id_color
                  WHERE pc.id_producto = @id ORDER BY c.nombre", new { id });
            return Results.Ok(new { producto = Publico(p), imagenes, colores });
        });
    }
}