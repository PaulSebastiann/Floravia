using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>Gestión de pedidos desde /admin: revisar pagos, preparar, enviar y entregar.</summary>
public sealed class PedidoAdminMD(
    Db db, PedidoDP pedidos, PagoDP pagos, EntregaDP entregas, ReservaDP reservas, StockMD stock)
{
    // Flujo permitido de un pedido ya pagado
    private static readonly Dictionary<string, string> Siguiente = new()
    {
        [EstadoPedido.Pagado] = EstadoPedido.EnPreparacion,
        [EstadoPedido.EnPreparacion] = EstadoPedido.EnCamino,
        [EstadoPedido.EnCamino] = EstadoPedido.Entregado,
    };

    public Task<ResultadoPagina<Pedido>> ListarAsync(FiltroPedido filtro) => pedidos.BuscarAsync(filtro);

    public async Task<PedidoDetalleVista> ObtenerDetalleAsync(int idPedido)
    {
        var pedido = await pedidos.ObtenerAsync(idPedido) ?? throw new NoEncontradoException("Pedido no encontrado.");
        return new PedidoDetalleVista
        {
            Pedido = pedido,
            Detalles = await pedidos.ListarDetallesAsync(idPedido),
            Pagos = await pagos.ListarPorPedidoAsync(idPedido),
            Entrega = await entregas.ObtenerPorPedidoAsync(idPedido),
        };
    }

    /// <summary>Transferencias (o pagos con tarjeta) esperando revisión.</summary>
    public Task<List<Pago>> ListarPagosPendientesAsync() => pagos.ListarPendientesAsync();

    /// <summary>
    /// Aprueba el pago: el pedido pasa a PAGADO, la reserva se convierte en venta (baja el stock)
    /// y queda la SALIDA en el kardex. Todo en una sola transacción.
    /// </summary>
    public Task<Pedido> AprobarPagoAsync(int idPago) => db.TransaccionAsync(async () =>
    {
        var pago = await pagos.ObtenerAsync(idPago) ?? throw new NoEncontradoException("Pago no encontrado.");
        if (pago.Estado != EstadoPago.Pendiente)
            throw new ReglaNegocioException("Solo se pueden aprobar pagos pendientes.");

        var pedido = (await pedidos.ObtenerAsync(pago.IdPedido))!;
        if (pedido.Estado != EstadoPedido.PendientePago && pedido.Estado != EstadoPedido.PagoFallido)
            throw new ReglaNegocioException("El pedido ya no está esperando pago (fue cancelado o ya está pagado).");

        if (await pagos.CambiarEstadoAsync(idPago, EstadoPago.Aprobado, EstadoPago.Pendiente) == 0)
            throw new ReglaNegocioException("El pago ya fue procesado por otra persona.");

        await pedidos.CambiarEstadoAsync(pedido.IdPedido, EstadoPedido.Pagado,
            EstadoPedido.PendientePago, EstadoPedido.PagoFallido);
        await stock.ConfirmarVentaAsync(pedido.IdPedido);

        return (await pedidos.ObtenerAsync(pedido.IdPedido))!;
    });

    /// <summary>Rechaza el pago (ej. comprobante inválido). El cliente puede reintentar mientras dure la reserva.</summary>
    public Task<Pedido> RechazarPagoAsync(int idPago) => db.TransaccionAsync(async () =>
    {
        var pago = await pagos.ObtenerAsync(idPago) ?? throw new NoEncontradoException("Pago no encontrado.");
        if (await pagos.CambiarEstadoAsync(idPago, EstadoPago.Rechazado, EstadoPago.Pendiente) == 0)
            throw new ReglaNegocioException("Solo se pueden rechazar pagos pendientes.");

        await pedidos.CambiarEstadoAsync(pago.IdPedido, EstadoPedido.PagoFallido, EstadoPedido.PendientePago);
        return (await pedidos.ObtenerAsync(pago.IdPedido))!;
    });

    /// <summary>Avanza el pedido un paso: PAGADO → EN_PREPARACION → EN_CAMINO → ENTREGADO (la entrega se sincroniza).</summary>
    public Task<Pedido> AvanzarEstadoAsync(int idPedido, string nuevoEstado) => db.TransaccionAsync(async () =>
    {
        var pedido = await pedidos.ObtenerAsync(idPedido) ?? throw new NoEncontradoException("Pedido no encontrado.");
        if (!Siguiente.TryGetValue(pedido.Estado, out var esperado) || esperado != nuevoEstado)
            throw new ReglaNegocioException($"No se puede pasar el pedido de {pedido.Estado} a {nuevoEstado}.");

        if (await pedidos.CambiarEstadoAsync(idPedido, nuevoEstado, pedido.Estado) == 0)
            throw new ReglaNegocioException("El pedido cambió de estado mientras se procesaba. Recarga e inténtalo de nuevo.");

        if (nuevoEstado == EstadoPedido.EnCamino) await entregas.CambiarEstadoAsync(idPedido, EstadoEntrega.EnCamino);
        if (nuevoEstado == EstadoPedido.Entregado) await entregas.CambiarEstadoAsync(idPedido, EstadoEntrega.Entregada);

        return (await pedidos.ObtenerAsync(idPedido))!;
    });

    public async Task ProgramarEntregaAsync(int idPedido, DateTime fecha)
    {
        if (fecha.Date < DateTime.Today) throw new ReglaNegocioException("La fecha de entrega no puede estar en el pasado.");
        if (await entregas.ProgramarAsync(idPedido, fecha) == 0) throw new NoEncontradoException("Entrega no encontrada.");
    }

    /// <summary>Cancela un pedido que aún no se pagó y libera su stock.</summary>
    public async Task CancelarAsync(int idPedido)
    {
        if (await pedidos.ObtenerAsync(idPedido) is null) throw new NoEncontradoException("Pedido no encontrado.");
        await stock.CancelarPedidoAsync(idPedido);
    }

    /// <summary>Cancela pedidos sin pagar cuya reserva venció. Pensado para ejecutarse cada pocos minutos.</summary>
    public Task<int> LiberarReservasVencidasAsync() => stock.LiberarVencidasAsync();
}
