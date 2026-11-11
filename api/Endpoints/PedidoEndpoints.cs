using System.Security.Claims;
using Api.Archivos;
using Api.Auth;
using Floravia.Application;
using Floravia.Application.MD.Tienda;
using Floravia.Core;

namespace Api.Endpoints;

public record CrearPedidoDto(int IdDireccion);
public record TarjetaDto(string Numero, string Titular, int MesVencimiento, int AnioVencimiento, string Cvv);

/// <summary>
/// Compra: crear pedido desde el carrito, ver historial, cancelar y pagar.
/// Métodos de pago: transferencia (se sube el comprobante y un admin lo aprueba) y tarjeta SIMULADA
/// (se validan los datos, pero no se cobra nada ni se guardan).
/// </summary>
public static class PedidoEndpoints
{
    public static void MapPedidos(this IEndpointRouteBuilder app)
    {
        // Público: el front lo usa para armar la pantalla de pago.
        app.MapGet("/api/pagos/metodos", (IConfiguration cfg) => Results.Ok(new
        {
            metodos = new object[]
            {
                new
                {
                    codigo = MetodoPago.Transferencia,
                    nombre = "Transferencia bancaria",
                    requiereComprobante = true,
                    datos = new
                    {
                        banco = cfg["Pagos:Transferencia:Banco"],
                        tipoCuenta = cfg["Pagos:Transferencia:TipoCuenta"],
                        numeroCuenta = cfg["Pagos:Transferencia:NumeroCuenta"],
                        titular = cfg["Pagos:Transferencia:Titular"],
                        identificacion = cfg["Pagos:Transferencia:Identificacion"],
                    },
                },
                new
                {
                    codigo = MetodoPago.Tarjeta,
                    nombre = "Tarjeta de crédito / débito",
                    simulado = true,
                    aviso = "Pasarela de práctica: no se realiza ningún cobro y los datos de la tarjeta no se guardan.",
                    tarjetasDePrueba = new[]
                    {
                        new { numero = "4242 4242 4242 4242", resultado = "aprobada" },
                        new { numero = TarjetaSimulada.NumeroRechazada, resultado = "rechazada" },
                        new { numero = TarjetaSimulada.NumeroSinFondos, resultado = "fondos insuficientes" },
                    },
                },
            },
        })).AllowAnonymous().WithTags("Pagos");

        var g = app.MapGroup("/api/pedidos").RequireAuthorization("Cliente").WithTags("Pedidos");

        g.MapPost("/", async (CrearPedidoDto d, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            var idCliente = u.IdCliente();
            var carrito = await s.Carrito.BuscarActivoAsync(idCliente, null)
                ?? throw new ReglaNegocioException("Tu carrito está vacío.");
            var pedido = await s.Pedidos.CrearDesdeCarritoAsync(idCliente, carrito.IdCarrito, d.IdDireccion);
            return Results.Created($"/api/pedidos/{pedido.IdPedido}", pedido);
        });

        g.MapGet("/", async (int? pagina, int? tamano, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Pedidos.ListarMisPedidosAsync(
                u.IdCliente(), Math.Max(1, pagina ?? 1), Math.Clamp(tamano ?? 10, 1, 50))));

        g.MapGet("/{id:int}", async (int id, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Pedidos.ObtenerDetalleAsync(u.IdCliente(), id)));

        g.MapPost("/{id:int}/cancelar", async (int id, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            await s.Pedidos.CancelarAsync(u.IdCliente(), id);
            return Results.Ok(await s.Pedidos.ObtenerDetalleAsync(u.IdCliente(), id));
        });

        // multipart/form-data: campo «comprobante» (archivo) y «referencia» (opcional).
        g.MapPost("/{id:int}/pagos/transferencia", async (
            int id, HttpContext ctx, FloraviaServicios s, ComprobanteStore archivos, CancellationToken ct) =>
        {
            if (!ctx.Request.HasFormContentType)
                throw new ReglaNegocioException("Envía el comprobante como multipart/form-data (campo «comprobante»).");

            var idCliente = ctx.User.IdCliente();
            await s.Pedidos.ObtenerDetalleAsync(idCliente, id); // 404 si el pedido no es suyo, ANTES de guardar nada

            var form = await ctx.Request.ReadFormAsync(ct);
            var ruta = await archivos.GuardarAsync(id, form.Files["comprobante"], ct);
            try
            {
                var referencia = form["referencia"].ToString();
                await s.Pedidos.RegistrarPagoAsync(idCliente, id, MetodoPago.Transferencia,
                    string.IsNullOrWhiteSpace(referencia) ? null : referencia, ruta);
            }
            catch
            {
                archivos.Eliminar(ruta); // no dejar archivos huérfanos si el pago fue rechazado por una regla
                throw;
            }
            return Results.Created($"/api/pedidos/{id}", await s.Pedidos.ObtenerDetalleAsync(idCliente, id));
        });

        // Tarjeta simulada: 200 si se aprueba, 402 (Payment Required) si se rechaza.
        g.MapPost("/{id:int}/pagos/tarjeta", async (int id, TarjetaDto d, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            var r = await s.PagosTarjeta.PagarAsync(
                u.IdCliente(), id, new DatosTarjeta(d.Numero, d.Titular, d.MesVencimiento, d.AnioVencimiento, d.Cvv));
            var cuerpo = new { aprobado = r.Aprobado, mensaje = r.Mensaje, marca = r.Marca, ultimos4 = r.Ultimos4, pedido = r.Pedido };
            return r.Aprobado
                ? Results.Ok(cuerpo)
                : Results.Json(cuerpo, statusCode: StatusCodes.Status402PaymentRequired);
        }).RequireRateLimiting("estricta");

        g.MapGet("/{id:int}/pagos/{idPago:int}/comprobante", async (
            int id, int idPago, ClaimsPrincipal u, FloraviaServicios s, ComprobanteStore archivos) =>
            archivos.Responder(await s.Pedidos.ObtenerDetalleAsync(u.IdCliente(), id), idPago));
    }
}
