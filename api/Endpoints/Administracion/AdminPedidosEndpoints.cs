using Api.Archivos;
using Floravia.Application;
using Floravia.Core.Entidades;

namespace Api.Endpoints.Administracion;

public record EstadoPedidoDto(string Estado);
public record EntregaDto(DateOnly Fecha);
public record PedidosAdminQuery(string? Estado, string? Texto, int? Pagina, int? TamanoPagina);

/// <summary>Pedidos: revisar pagos (aprobar/rechazar), avanzar el estado, programar la entrega y cancelar.</summary>
public static class AdminPedidosEndpoints
{
    public static void MapAdminPedidos(this RouteGroupBuilder admin)
    {
        var g = admin.MapGroup("/pedidos").WithTags("Admin · Pedidos");

        g.MapGet("/", async ([AsParameters] PedidosAdminQuery q, FloraviaServicios s) =>
            Results.Ok(await s.PedidosAdmin.ListarAsync(new FiltroPedido
            {
                Estado = string.IsNullOrWhiteSpace(q.Estado) ? null : q.Estado.Trim(),
                Texto = string.IsNullOrWhiteSpace(q.Texto) ? null : q.Texto.Trim(),
                Pagina = Math.Max(1, q.Pagina ?? 1),
                TamanoPagina = Math.Clamp(q.TamanoPagina ?? 20, 1, 100),
            })));

        g.MapGet("/{id:int}", async (int id, FloraviaServicios s) =>
            Results.Ok(await s.PedidosAdmin.ObtenerDetalleAsync(id)));

        // Flujo: PAGADO → EN_PREPARACION → EN_CAMINO → ENTREGADO (un paso a la vez).
        g.MapPost("/{id:int}/estado", async (int id, EstadoPedidoDto d, FloraviaServicios s) =>
            Results.Ok(await s.PedidosAdmin.AvanzarEstadoAsync(id, d.Estado)));

        g.MapPut("/{id:int}/entrega", async (int id, EntregaDto d, FloraviaServicios s) =>
        {
            await s.PedidosAdmin.ProgramarEntregaAsync(id, d.Fecha.ToDateTime(TimeOnly.MinValue));
            return Results.NoContent();
        });

        g.MapPost("/{id:int}/cancelar", async (int id, FloraviaServicios s) =>
        {
            await s.PedidosAdmin.CancelarAsync(id);
            return Results.NoContent();
        });

        g.MapGet("/{id:int}/pagos/{idPago:int}/comprobante", async (int id, int idPago, FloraviaServicios s, ComprobanteStore archivos) =>
            archivos.Responder(await s.PedidosAdmin.ObtenerDetalleAsync(id), idPago));

        var pagos = admin.MapGroup("/pagos").WithTags("Admin · Pedidos");

        pagos.MapGet("/pendientes", async (FloraviaServicios s) => Results.Ok(await s.PedidosAdmin.ListarPagosPendientesAsync()));

        pagos.MapPost("/{idPago:int}/aprobar", async (int idPago, FloraviaServicios s) =>
            Results.Ok(await s.PedidosAdmin.AprobarPagoAsync(idPago)));

        pagos.MapPost("/{idPago:int}/rechazar", async (int idPago, FloraviaServicios s) =>
            Results.Ok(await s.PedidosAdmin.RechazarPagoAsync(idPago)));

        // Ya se ejecuta sola cada minuto; este botón permite forzarla desde el panel.
        admin.MapPost("/reservas/liberar-vencidas", async (FloraviaServicios s) =>
            Results.Ok(new { cancelados = await s.PedidosAdmin.LiberarReservasVencidasAsync() }))
            .WithTags("Admin · Pedidos");
    }
}
