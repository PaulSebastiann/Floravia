using System.Globalization;
using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD;

/// <summary>Lectura (y edición desde el admin) de la tabla parametro: IVA, minutos de reserva, límites de login.</summary>
public sealed class ParametrosMD(ParametroDP parametros)
{
    public async Task<decimal> IvaAsync() => await DecimalAsync(Parametros.IvaPorcentaje, 15m);
    public async Task<int> MinutosReservaAsync() => (int)await DecimalAsync(Parametros.ReservaStockMinutos, 30m);
    public async Task<int> MaxIntentosLoginAsync() => (int)await DecimalAsync(Parametros.MaxIntentosLogin, 5m);
    public async Task<int> MinutosBloqueoLoginAsync() => (int)await DecimalAsync(Parametros.MinutosBloqueoLogin, 15m);

    private async Task<decimal> DecimalAsync(string clave, decimal porDefecto)
    {
        var valor = await parametros.ObtenerValorAsync(clave);
        return decimal.TryParse(valor, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : porDefecto;
    }

    // ----- Admin -----

    public Task<List<Parametro>> ListarAsync() => parametros.ListarAsync();

    public async Task ActualizarAsync(string clave, string valor)
    {
        if (!decimal.TryParse(valor, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) || d < 0)
            throw new ReglaNegocioException("El valor del parámetro debe ser un número mayor o igual a cero.");
        if (clave == Parametros.IvaPorcentaje && d > 100)
            throw new ReglaNegocioException("El IVA no puede superar el 100 %.");

        var filas = await parametros.ActualizarAsync(clave, d.ToString(CultureInfo.InvariantCulture));
        if (filas == 0) throw new NoEncontradoException("El parámetro no existe.");
    }
}

/// <summary>
/// Reglas de stock ligadas a pedidos: reservar al crear el pedido, confirmar al pagar,
/// liberar al cancelar o expirar. Se ejecuta siempre dentro de una transacción.
/// </summary>
public sealed class StockMD(
    Db db, ProductoDP productos, ReservaDP reservas, MovimientoDP movimientos,
    PedidoDP pedidos, PagoDP pagos, ParametrosMD parametros)
{
    /// <summary>Reserva stock para el pedido. Si algún producto no alcanza, lanza error y la transacción se revierte.</summary>
    public async Task ReservarAsync(int idPedido, IEnumerable<(int IdProducto, int Cantidad)> items)
    {
        var minutos = await parametros.MinutosReservaAsync();
        // Orden fijo por producto para evitar bloqueos cruzados entre pedidos simultáneos
        foreach (var (idProducto, cantidad) in items.OrderBy(i => i.IdProducto))
        {
            if (await productos.ReservarAsync(idProducto, cantidad) == 0)
            {
                var p = await productos.ObtenerAsync(idProducto);
                var nombre = p?.Nombre ?? $"#{idProducto}";
                throw new ReglaNegocioException(p is null || p.Estado != EstadoRegistro.Activo
                    ? $"El producto «{nombre}» ya no está disponible."
                    : $"No hay stock suficiente de «{nombre}» (disponibles: {p.StockDisponible}).");
            }
            await reservas.InsertarAsync(idPedido, idProducto, cantidad, minutos);
        }
    }

    /// <summary>El pedido se pagó: la reserva pasa a venta, baja el stock y queda la SALIDA en el kardex.</summary>
    public async Task ConfirmarVentaAsync(int idPedido)
    {
        var activas = await reservas.ListarActivasPorPedidoAsync(idPedido);
        if (activas.Count == 0)
            throw new ReglaNegocioException("El pedido ya no tiene stock reservado (venció o fue liberado).");

        foreach (var r in activas)
        {
            var saldo = await productos.ConfirmarVentaAsync(r.IdProducto, r.Cantidad)
                ?? throw new ReglaNegocioException("No se pudo confirmar el stock del pedido.");
            await movimientos.InsertarAsync(new MovimientoInventario
            {
                IdProducto = r.IdProducto,
                IdPedido = idPedido,
                Tipo = TipoMovimiento.Salida,
                Cantidad = r.Cantidad,
                Saldo = saldo,
                Motivo = "Venta",
            });
        }
        await reservas.CambiarEstadoPorPedidoAsync(idPedido, EstadoReserva.Activa, EstadoReserva.Confirmada);
    }

    /// <summary>Devuelve al stock disponible las unidades reservadas y marca la reserva con el estado indicado.</summary>
    public async Task LiberarAsync(int idPedido, string estadoFinal)
    {
        foreach (var r in await reservas.ListarActivasPorPedidoAsync(idPedido))
            await productos.LiberarReservaAsync(r.IdProducto, r.Cantidad);
        await reservas.CambiarEstadoPorPedidoAsync(idPedido, EstadoReserva.Activa, estadoFinal);
    }

    /// <summary>Cancela un pedido que todavía no se pagó y libera su stock.</summary>
    public Task CancelarPedidoAsync(int idPedido) => db.TransaccionAsync(async () =>
    {
        var filas = await pedidos.CambiarEstadoAsync(idPedido, EstadoPedido.Cancelado,
            EstadoPedido.PendientePago, EstadoPedido.PagoFallido);
        if (filas == 0)
            throw new ReglaNegocioException("Solo se puede cancelar un pedido que aún no ha sido pagado.");

        await LiberarAsync(idPedido, EstadoReserva.Liberada);
        foreach (var pago in await pagos.ListarPorPedidoAsync(idPedido))
            await pagos.CambiarEstadoAsync(pago.IdPago, EstadoPago.Rechazado, EstadoPago.Pendiente);
    });

    /// <summary>
    /// Tarea de limpieza: pedidos sin pagar cuya reserva venció se cancelan y su stock vuelve a la tienda.
    /// Devuelve cuántos pedidos se cancelaron. Debe ejecutarse periódicamente (ej. cada minuto).
    /// </summary>
    public async Task<int> LiberarVencidasAsync()
    {
        var cancelados = 0;
        foreach (var idPedido in await reservas.PedidosConReservaVencidaAsync())
        {
            await db.TransaccionAsync(async () =>
            {
                await LiberarAsync(idPedido, EstadoReserva.Expirada);
                var filas = await pedidos.CambiarEstadoAsync(idPedido, EstadoPedido.Cancelado,
                    EstadoPedido.PendientePago, EstadoPedido.PagoFallido);
                if (filas > 0) cancelados++;
            });
        }
        return cancelados;
    }
}
