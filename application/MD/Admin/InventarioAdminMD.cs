using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>Control de stock desde /admin. Cada cambio deja una fila en el kardex con el saldo resultante.</summary>
public sealed class InventarioAdminMD(Db db, ProductoDP productos, MovimientoDP movimientos, ProveedorDP proveedores)
{
    /// <summary>Aumenta el stock (compra a proveedor, reposición). Registra una ENTRADA.</summary>
    public Task<MovimientoInventario> AumentarStockAsync(
        int idProducto, int cantidad, int idAdmin, int? idProveedor = null, decimal? costoUnitario = null, string? motivo = null)
    {
        Validar.Positivo(cantidad, "La cantidad");
        if (costoUnitario.HasValue && costoUnitario.Value < 0) throw new ReglaNegocioException("El costo no puede ser negativo.");
        motivo = Validar.TextoOpcional(motivo, "El motivo", 250) ?? "Reposición de stock";

        return db.TransaccionAsync(async () =>
        {
            await ObtenerProductoAsync(idProducto);
            if (idProveedor is int pv && await proveedores.ObtenerAsync(pv) is null)
                throw new NoEncontradoException("Proveedor no encontrado.");

            var saldo = await productos.AjustarStockAsync(idProducto, cantidad)
                ?? throw new ReglaNegocioException("No se pudo actualizar el stock.");
            return await RegistrarAsync(new MovimientoInventario
            {
                IdProducto = idProducto, IdAdmin = idAdmin, IdProveedor = idProveedor,
                Tipo = TipoMovimiento.Entrada, Cantidad = cantidad, CostoUnitario = costoUnitario,
                Saldo = saldo, Motivo = motivo,
            });
        });
    }

    /// <summary>Disminuye el stock (merma, daño, pérdida). Registra una SALIDA; el motivo es obligatorio.</summary>
    public Task<MovimientoInventario> DisminuirStockAsync(int idProducto, int cantidad, int idAdmin, string motivo)
    {
        Validar.Positivo(cantidad, "La cantidad");
        motivo = Validar.Texto(motivo, "El motivo", 250);

        return db.TransaccionAsync(async () =>
        {
            var producto = await ObtenerProductoAsync(idProducto);
            if (cantidad > producto.StockDisponible)
                throw new ReglaNegocioException(
                    $"Solo hay {producto.StockDisponible} unidades disponibles " +
                    $"({producto.StockReservado} están reservadas por pedidos pendientes).");

            var saldo = await productos.AjustarStockAsync(idProducto, -cantidad)
                ?? throw new ReglaNegocioException("El stock no puede quedar por debajo de lo reservado.");
            return await RegistrarAsync(new MovimientoInventario
            {
                IdProducto = idProducto, IdAdmin = idAdmin, Tipo = TipoMovimiento.Salida,
                Cantidad = cantidad, Saldo = saldo, Motivo = motivo,
            });
        });
    }

    /// <summary>Corrige el stock al conteo físico real. Registra un AJUSTE (positivo o negativo).</summary>
    public Task<MovimientoInventario> AjustarStockAsync(int idProducto, int stockReal, int idAdmin, string motivo)
    {
        if (stockReal < 0) throw new ReglaNegocioException("El stock real no puede ser negativo.");
        motivo = Validar.Texto(motivo, "El motivo", 250);

        return db.TransaccionAsync(async () =>
        {
            var producto = await ObtenerProductoAsync(idProducto);
            var delta = stockReal - producto.Stock;
            if (delta == 0) throw new ReglaNegocioException("El stock ya coincide con el conteo indicado.");

            var saldo = await productos.AjustarStockAsync(idProducto, delta)
                ?? throw new ReglaNegocioException(
                    $"El stock no puede quedar por debajo de lo reservado ({producto.StockReservado}).");
            return await RegistrarAsync(new MovimientoInventario
            {
                IdProducto = idProducto, IdAdmin = idAdmin, Tipo = TipoMovimiento.Ajuste,
                Cantidad = delta, Saldo = saldo, Motivo = motivo,
            });
        });
    }

    public Task<List<MovimientoInventario>> ObtenerKardexAsync(int idProducto, int limite = 100) =>
        movimientos.ListarPorProductoAsync(idProducto, Math.Clamp(limite, 1, 1000));

    public Task<List<MovimientoInventario>> ListarMovimientosRecientesAsync(int limite = 50) =>
        movimientos.ListarRecientesAsync(Math.Clamp(limite, 1, 500));

    /// <summary>Productos activos cuyo stock disponible llegó al mínimo (o se agotó).</summary>
    public async Task<List<Producto>> ListarStockBajoAsync() =>
        (await productos.BuscarAsync(new FiltroProducto
        {
            StockBajo = true, SoloActivos = true, Orden = "nombre", TamanoPagina = 100,
        })).Items;

    private async Task<Producto> ObtenerProductoAsync(int idProducto) =>
        await productos.ObtenerAsync(idProducto) ?? throw new NoEncontradoException("Producto no encontrado.");

    private async Task<MovimientoInventario> RegistrarAsync(MovimientoInventario m)
    {
        m.IdMovimiento = await movimientos.InsertarAsync(m);
        return m;
    }
}
