using Dapper;
using Floravia.Core.Entidades;

namespace Floravia.Infrastructure.DP;

public sealed class CategoriaDP(Db db)
{
    private const string Cols = "id_categoria, id_categoria_padre, nombre, descripcion";

    public Task<List<Categoria>> ListarAsync() =>
        db.ListarAsync<Categoria>($"SELECT {Cols} FROM categoria ORDER BY nombre");

    public Task<Categoria?> ObtenerAsync(int id) =>
        db.UnoAsync<Categoria>($"SELECT {Cols} FROM categoria WHERE id_categoria = @id", new { id });

    public Task<int> InsertarAsync(Categoria c) =>
        db.EscalarAsync<int>("""
            INSERT INTO categoria (id_categoria_padre, nombre, descripcion)
            VALUES (@IdCategoriaPadre, @Nombre, @Descripcion)
            RETURNING id_categoria
            """, c);

    public Task<int> ActualizarAsync(Categoria c) =>
        db.EjecutarAsync("""
            UPDATE categoria
               SET id_categoria_padre = @IdCategoriaPadre, nombre = @Nombre, descripcion = @Descripcion
             WHERE id_categoria = @IdCategoria
            """, c);

    public Task<int> EliminarAsync(int id) =>
        db.EjecutarAsync("DELETE FROM categoria WHERE id_categoria = @id", new { id });

    /// <summary>La categoría y todas sus descendientes (para detectar ciclos al cambiar el padre).</summary>
    public Task<List<int>> IdsDelArbolAsync(int id) =>
        db.ListarAsync<int>("""
            WITH RECURSIVE arbol AS (
                SELECT id_categoria FROM categoria WHERE id_categoria = @id
                UNION ALL
                SELECT h.id_categoria FROM categoria h JOIN arbol a ON h.id_categoria_padre = a.id_categoria)
            SELECT id_categoria FROM arbol
            """, new { id });
}

public sealed class ColorDP(Db db)
{
    private const string Cols = "id_color, nombre, codigo_hex";

    public Task<List<Color>> ListarAsync() =>
        db.ListarAsync<Color>($"SELECT {Cols} FROM color ORDER BY nombre");

    public Task<Color?> ObtenerAsync(int id) =>
        db.UnoAsync<Color>($"SELECT {Cols} FROM color WHERE id_color = @id", new { id });

    public Task<int> InsertarAsync(Color c) =>
        db.EscalarAsync<int>(
            "INSERT INTO color (nombre, codigo_hex) VALUES (@Nombre, @CodigoHex) RETURNING id_color", c);

    public Task<int> ActualizarAsync(Color c) =>
        db.EjecutarAsync("UPDATE color SET nombre = @Nombre, codigo_hex = @CodigoHex WHERE id_color = @IdColor", c);

    public Task<int> EliminarAsync(int id) =>
        db.EjecutarAsync("DELETE FROM color WHERE id_color = @id", new { id });

    // ----- Relación producto <-> color -----

    public Task<List<Color>> ListarPorProductoAsync(int idProducto) =>
        db.ListarAsync<Color>("""
            SELECT c.id_color, c.nombre, c.codigo_hex
              FROM producto_color pc JOIN color c ON c.id_color = pc.id_color
             WHERE pc.id_producto = @idProducto
             ORDER BY c.nombre
            """, new { idProducto });

    public Task<int> AsignarAProductoAsync(int idProducto, int idColor) =>
        db.EjecutarAsync("""
            INSERT INTO producto_color (id_producto, id_color) VALUES (@idProducto, @idColor)
            ON CONFLICT DO NOTHING
            """, new { idProducto, idColor });

    public Task<int> QuitarTodosDeProductoAsync(int idProducto) =>
        db.EjecutarAsync("DELETE FROM producto_color WHERE id_producto = @idProducto", new { idProducto });
}

public sealed class ProductoDP(Db db)
{
    private const string Cols = """
        p.id_producto, p.id_categoria, p.codigo, p.nombre, p.descripcion, p.cuidados, p.precio,
        p.stock, p.stock_reservado, p.stock_minimo, p.estado, p.creado_en, p.actualizado_en,
        c.nombre AS categoria_nombre,
        (SELECT i.ruta FROM imagen_producto i WHERE i.id_producto = p.id_producto
          ORDER BY i.es_principal DESC, i.orden, i.id_imagen LIMIT 1) AS imagen_principal
        """;

    private const string Desde = "FROM producto p JOIN categoria c ON c.id_categoria = p.id_categoria";

    // ---------- Consultas (tienda y admin) ----------

    public async Task<ResultadoPagina<Producto>> BuscarAsync(FiltroProducto f)
    {
        var p = new DynamicParameters();
        var where = new List<string>();
        var prefijo = "";

        if (f.SoloActivos) where.Add("p.estado = 'ACTIVO'");
        if (f.SoloConStock) where.Add("p.stock - p.stock_reservado > 0");
        if (f.StockBajo) where.Add("p.stock - p.stock_reservado <= p.stock_minimo");

        if (f.IdCategoria is int cat)
        {
            // Filtrar por "Planta" también trae los productos de "Bonsai" (subcategoría)
            prefijo = """
                WITH RECURSIVE arbol AS (
                    SELECT id_categoria FROM categoria WHERE id_categoria = @cat
                    UNION ALL
                    SELECT h.id_categoria FROM categoria h JOIN arbol a ON h.id_categoria_padre = a.id_categoria)

                """;
            where.Add("p.id_categoria IN (SELECT id_categoria FROM arbol)");
            p.Add("cat", cat);
        }
        if (!string.IsNullOrWhiteSpace(f.Texto))
        {
            where.Add("(p.nombre ILIKE @texto OR p.codigo ILIKE @texto)");
            p.Add("texto", "%" + EscaparLike(f.Texto.Trim()) + "%");
        }
        if (f.PrecioMin is decimal min) { where.Add("p.precio >= @min"); p.Add("min", min); }
        if (f.PrecioMax is decimal max) { where.Add("p.precio <= @max"); p.Add("max", max); }
        if (f.IdColor is int color)
        {
            where.Add("EXISTS (SELECT 1 FROM producto_color pc WHERE pc.id_producto = p.id_producto AND pc.id_color = @color)");
            p.Add("color", color);
        }

        var w = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        var orden = f.Orden switch
        {
            "precio_asc" => "p.precio ASC, p.id_producto",
            "precio_desc" => "p.precio DESC, p.id_producto",
            "nombre" => "p.nombre ASC, p.id_producto",
            _ => "p.creado_en DESC, p.id_producto DESC",
        };

        var pagina = Math.Max(1, f.Pagina);
        var tamano = Math.Clamp(f.TamanoPagina, 1, 100);
        p.Add("limite", tamano);
        p.Add("desplazamiento", (pagina - 1) * tamano);

        var total = await db.EscalarAsync<int>($"{prefijo}SELECT COUNT(*)::int {Desde} {w}", p);
        var items = await db.ListarAsync<Producto>(
            $"{prefijo}SELECT {Cols} {Desde} {w} ORDER BY {orden} LIMIT @limite OFFSET @desplazamiento", p);

        return new ResultadoPagina<Producto>(items, total, pagina, tamano);
    }

    private static string EscaparLike(string s) =>
        s.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    public Task<Producto?> ObtenerAsync(int id) =>
        db.UnoAsync<Producto>($"SELECT {Cols} {Desde} WHERE p.id_producto = @id", new { id });

    public Task<Producto?> ObtenerPorCodigoAsync(string codigo) =>
        db.UnoAsync<Producto>($"SELECT {Cols} {Desde} WHERE p.codigo = @codigo", new { codigo });

    /// <summary>Productos activos de la misma categoría (sección "te puede interesar").</summary>
    public Task<List<Producto>> RelacionadosAsync(int idProducto, int cantidad) =>
        db.ListarAsync<Producto>($"""
            SELECT {Cols} {Desde}
             WHERE p.estado = 'ACTIVO' AND p.id_producto <> @idProducto
               AND p.id_categoria = (SELECT id_categoria FROM producto WHERE id_producto = @idProducto)
             ORDER BY p.creado_en DESC
             LIMIT @cantidad
            """, new { idProducto, cantidad });

    // ---------- Escritura (admin) ----------

    public Task<int> InsertarAsync(Producto p) =>
        db.EscalarAsync<int>("""
            INSERT INTO producto (id_categoria, codigo, nombre, descripcion, cuidados, precio, stock, stock_minimo, estado)
            VALUES (@IdCategoria, @Codigo, @Nombre, @Descripcion, @Cuidados, @Precio, @Stock, @StockMinimo, @Estado)
            RETURNING id_producto
            """, p);

    /// <summary>Actualiza los datos del producto. El stock NO se toca aquí: solo por operaciones de inventario.</summary>
    public Task<int> ActualizarAsync(Producto p) =>
        db.EjecutarAsync("""
            UPDATE producto
               SET id_categoria = @IdCategoria, codigo = @Codigo, nombre = @Nombre,
                   descripcion = @Descripcion, cuidados = @Cuidados, precio = @Precio,
                   stock_minimo = @StockMinimo, actualizado_en = NOW()
             WHERE id_producto = @IdProducto
            """, p);

    public Task<int> CambiarEstadoAsync(int id, string estado) =>
        db.EjecutarAsync(
            "UPDATE producto SET estado = @estado, actualizado_en = NOW() WHERE id_producto = @id", new { id, estado });

    /// <summary>True si el producto aparece en pedidos o reservas (entonces solo se puede desactivar).</summary>
    public async Task<bool> TieneVentasAsync(int id) =>
        await db.EscalarAsync<bool>("""
            SELECT EXISTS (SELECT 1 FROM detalle_pedido WHERE id_producto = @id)
                OR EXISTS (SELECT 1 FROM reserva_stock  WHERE id_producto = @id)
            """, new { id });

    /// <summary>Borra el producto y lo que cuelga de él (carritos y kardex). Usar solo si no tiene ventas.</summary>
    public async Task<int> EliminarAsync(int id)
    {
        await db.EjecutarAsync("DELETE FROM item_carrito WHERE id_producto = @id", new { id });
        await db.EjecutarAsync("DELETE FROM movimiento_inventario WHERE id_producto = @id", new { id });
        return await db.EjecutarAsync("DELETE FROM producto WHERE id_producto = @id", new { id });
    }

    // ---------- Stock (cada UPDATE es atómico y respeta los CHECK de la tabla) ----------

    /// <summary>Suma (o resta, si es negativo) al stock. Devuelve el stock nuevo, o null si quedaría bajo lo reservado.</summary>
    public Task<int?> AjustarStockAsync(int id, int delta) =>
        db.UnoAsync<int?>("""
            UPDATE producto
               SET stock = stock + @delta, actualizado_en = NOW()
             WHERE id_producto = @id AND stock + @delta >= stock_reservado
            RETURNING stock
            """, new { id, delta });

    /// <summary>Reserva unidades solo si hay disponibles. Devuelve filas afectadas (0 = no alcanza o inactivo).</summary>
    public Task<int> ReservarAsync(int id, int cantidad) =>
        db.EjecutarAsync("""
            UPDATE producto
               SET stock_reservado = stock_reservado + @cantidad
             WHERE id_producto = @id AND estado = 'ACTIVO' AND stock - stock_reservado >= @cantidad
            """, new { id, cantidad });

    public Task<int> LiberarReservaAsync(int id, int cantidad) =>
        db.EjecutarAsync("""
            UPDATE producto SET stock_reservado = stock_reservado - @cantidad
             WHERE id_producto = @id AND stock_reservado >= @cantidad
            """, new { id, cantidad });

    /// <summary>Convierte una reserva en venta: baja stock y reserva a la vez. Devuelve el stock resultante.</summary>
    public Task<int?> ConfirmarVentaAsync(int id, int cantidad) =>
        db.UnoAsync<int?>("""
            UPDATE producto
               SET stock = stock - @cantidad, stock_reservado = stock_reservado - @cantidad, actualizado_en = NOW()
             WHERE id_producto = @id AND stock_reservado >= @cantidad
            RETURNING stock
            """, new { id, cantidad });
}

public sealed class ImagenDP(Db db)
{
    private const string Cols = "id_imagen, id_producto, ruta, es_principal, orden";

    public Task<List<ImagenProducto>> ListarPorProductoAsync(int idProducto) =>
        db.ListarAsync<ImagenProducto>(
            $"SELECT {Cols} FROM imagen_producto WHERE id_producto = @idProducto ORDER BY es_principal DESC, orden, id_imagen",
            new { idProducto });

    public Task<ImagenProducto?> ObtenerAsync(int id) =>
        db.UnoAsync<ImagenProducto>($"SELECT {Cols} FROM imagen_producto WHERE id_imagen = @id", new { id });

    public Task<int> InsertarAsync(ImagenProducto i) =>
        db.EscalarAsync<int>("""
            INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
            VALUES (@IdProducto, @Ruta, @EsPrincipal, @Orden)
            RETURNING id_imagen
            """, i);

    public Task<int> ContarAsync(int idProducto) =>
        db.EscalarAsync<int>("SELECT COUNT(*)::int FROM imagen_producto WHERE id_producto = @idProducto", new { idProducto });

    public Task<int> SiguienteOrdenAsync(int idProducto) =>
        db.EscalarAsync<int>(
            "SELECT COALESCE(MAX(orden), -1) + 1 FROM imagen_producto WHERE id_producto = @idProducto", new { idProducto });

    /// <summary>Hay un índice único: primero se quita la principal actual y luego se marca la nueva.</summary>
    public Task<int> QuitarPrincipalAsync(int idProducto) =>
        db.EjecutarAsync(
            "UPDATE imagen_producto SET es_principal = FALSE WHERE id_producto = @idProducto AND es_principal", new { idProducto });

    public Task<int> MarcarPrincipalAsync(int idImagen) =>
        db.EjecutarAsync("UPDATE imagen_producto SET es_principal = TRUE WHERE id_imagen = @idImagen", new { idImagen });

    public Task<int> ActualizarOrdenAsync(int idImagen, int orden) =>
        db.EjecutarAsync("UPDATE imagen_producto SET orden = @orden WHERE id_imagen = @idImagen", new { idImagen, orden });

    /// <summary>Borra la fila y devuelve la ruta para poder borrar también el archivo.</summary>
    public Task<string?> EliminarAsync(int idImagen) =>
        db.UnoAsync<string>("DELETE FROM imagen_producto WHERE id_imagen = @idImagen RETURNING ruta", new { idImagen });

    public Task<List<string>> RutasDeProductoAsync(int idProducto) =>
        db.ListarAsync<string>("SELECT ruta FROM imagen_producto WHERE id_producto = @idProducto", new { idProducto });

    public Task<int?> PrimeraDeProductoAsync(int idProducto) =>
        db.UnoAsync<int?>(
            "SELECT id_imagen FROM imagen_producto WHERE id_producto = @idProducto ORDER BY orden, id_imagen LIMIT 1",
            new { idProducto });
}
