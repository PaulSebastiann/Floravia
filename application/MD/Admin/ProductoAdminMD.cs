using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>Datos editables de un producto. El stock NO va aquí: se mueve solo con <see cref="InventarioAdminMD"/>.</summary>
public sealed record DatosProducto(
    int IdCategoria, string Codigo, string Nombre, string? Descripcion, string? Cuidados, decimal Precio, int StockMinimo);

/// <summary>Gestión del catálogo desde /admin: crear, editar, activar/desactivar y eliminar productos.</summary>
public sealed class ProductoAdminMD(
    Db db, ProductoDP productos, ColorDP colores, MovimientoDP movimientos, ImagenDP imagenes, IAlmacenArchivos almacen)
{
    /// <summary>Lista productos del admin: por defecto incluye inactivos.</summary>
    public Task<ResultadoPagina<Producto>> ListarAsync(FiltroProducto filtro, bool incluirInactivos = true)
    {
        filtro.SoloActivos = !incluirInactivos;
        return productos.BuscarAsync(filtro);
    }

    public async Task<ProductoDetalle?> ObtenerAsync(int idProducto)
    {
        var p = await productos.ObtenerAsync(idProducto);
        if (p is null) return null;
        return new ProductoDetalle
        {
            Producto = p,
            Imagenes = await imagenes.ListarPorProductoAsync(idProducto),
            Colores = await colores.ListarPorProductoAsync(idProducto),
        };
    }

    /// <summary>Crea el producto. Si hay stock inicial queda registrado como ENTRADA en el kardex.</summary>
    public async Task<int> CrearAsync(
        DatosProducto d, int stockInicial = 0, IReadOnlyList<int>? idColores = null, int? idAdmin = null)
    {
        if (stockInicial < 0) throw new ReglaNegocioException("El stock inicial no puede ser negativo.");
        var producto = Normalizar(d);
        producto.Stock = stockInicial;
        producto.Estado = EstadoRegistro.Activo;

        try
        {
            return await db.TransaccionAsync(async () =>
            {
                var id = await productos.InsertarAsync(producto);
                if (stockInicial > 0)
                {
                    await movimientos.InsertarAsync(new MovimientoInventario
                    {
                        IdProducto = id, IdAdmin = idAdmin, Tipo = TipoMovimiento.Entrada,
                        Cantidad = stockInicial, Saldo = stockInicial, Motivo = "Stock inicial",
                    });
                }
                foreach (var idColor in idColores?.Distinct() ?? [])
                    await colores.AsignarAProductoAsync(id, idColor);
                return id;
            });
        }
        catch (Exception e) when (Traducir(e) is not null)
        {
            throw Traducir(e)!;
        }
    }

    /// <summary>Actualiza datos del producto (precio, nombre, categoría...). Si se pasan colores, reemplazan a los actuales.</summary>
    public async Task ActualizarAsync(int idProducto, DatosProducto d, IReadOnlyList<int>? idColores = null)
    {
        var producto = Normalizar(d);
        producto.IdProducto = idProducto;

        try
        {
            await db.TransaccionAsync(async () =>
            {
                if (await productos.ActualizarAsync(producto) == 0)
                    throw new NoEncontradoException("Producto no encontrado.");
                if (idColores is not null) await ReemplazarColoresAsync(idProducto, idColores);
            });
        }
        catch (Exception e) when (Traducir(e) is not null)
        {
            throw Traducir(e)!;
        }
    }

    public async Task CambiarEstadoAsync(int idProducto, bool activo)
    {
        var estado = activo ? EstadoRegistro.Activo : EstadoRegistro.Inactivo;
        if (await productos.CambiarEstadoAsync(idProducto, estado) == 0)
            throw new NoEncontradoException("Producto no encontrado.");
    }

    public async Task AsignarColoresAsync(int idProducto, IReadOnlyList<int> idColores)
    {
        if (await productos.ObtenerAsync(idProducto) is null)
            throw new NoEncontradoException("Producto no encontrado.");
        try
        {
            await db.TransaccionAsync(() => ReemplazarColoresAsync(idProducto, idColores));
        }
        catch (Exception e) when (Traducir(e) is not null)
        {
            throw Traducir(e)!;
        }
    }

    private async Task ReemplazarColoresAsync(int idProducto, IReadOnlyList<int> idColores)
    {
        await colores.QuitarTodosDeProductoAsync(idProducto);
        foreach (var idColor in idColores.Distinct())
            await colores.AsignarAProductoAsync(idProducto, idColor);
    }

    /// <summary>Elimina el producto solo si nunca se vendió ni reservó. Si tiene historial, hay que desactivarlo.</summary>
    public async Task EliminarAsync(int idProducto)
    {
        if (await productos.ObtenerAsync(idProducto) is null)
            throw new NoEncontradoException("Producto no encontrado.");
        if (await productos.TieneVentasAsync(idProducto))
            throw new ReglaNegocioException("El producto tiene pedidos asociados. Desactívalo en lugar de eliminarlo.");

        var rutas = await imagenes.RutasDeProductoAsync(idProducto);
        await db.TransaccionAsync(() => productos.EliminarAsync(idProducto));
        foreach (var ruta in rutas) await almacen.EliminarAsync(ruta); // archivos solo después de confirmar en BD
    }

    private static Producto Normalizar(DatosProducto d)
    {
        if (d.Precio <= 0) throw new ReglaNegocioException("El precio debe ser mayor que cero.");
        if (decimal.Round(d.Precio, 2) != d.Precio) throw new ReglaNegocioException("El precio admite máximo 2 decimales.");
        if (d.StockMinimo < 0) throw new ReglaNegocioException("El stock mínimo no puede ser negativo.");
        if (d.IdCategoria <= 0) throw new ReglaNegocioException("Selecciona una categoría.");

        return new Producto
        {
            IdCategoria = d.IdCategoria,
            Codigo = Validar.Texto(d.Codigo, "El código", 30).ToUpperInvariant(),
            Nombre = Validar.Texto(d.Nombre, "El nombre", 150),
            Descripcion = Validar.TextoOpcional(d.Descripcion, "La descripción", 5000),
            Cuidados = Validar.TextoOpcional(d.Cuidados, "Los cuidados", 5000),
            Precio = d.Precio,
            StockMinimo = d.StockMinimo,
        };
    }

    private static ReglaNegocioException? Traducir(Exception e) => Db.Restriccion(e) switch
    {
        "uq_producto_codigo" => new ReglaNegocioException("Ya existe un producto con ese código."),
        "fk_producto_categoria" => new ReglaNegocioException("La categoría seleccionada no existe."),
        "fk_pc_color" => new ReglaNegocioException("Alguno de los colores seleccionados no existe."),
        _ => null,
    };
}
