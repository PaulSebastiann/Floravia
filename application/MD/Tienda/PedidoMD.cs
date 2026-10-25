using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Tienda;

/// <summary>Pedidos del cliente: crear desde el carrito, ver su historial, pagar y cancelar.</summary>
public sealed class PedidoMD(
    Db db, CarritoDP carritos, DireccionDP direcciones, ZonaEntregaDP zonas, PedidoDP pedidos,
    PagoDP pagos, EntregaDP entregas, ReservaDP reservas, StockMD stock, ParametrosMD parametros)
{
    /// <summary>
    /// Convierte el carrito en pedido: calcula IVA y envío, reserva el stock y deja el pedido PENDIENTE_PAGO.
    /// Todo ocurre en una transacción: si algo falla (ej. falta stock) no queda nada a medias.
    /// </summary>
    public Task<Pedido> CrearDesdeCarritoAsync(int idCliente, int idCarrito, int idDireccion) =>
        db.TransaccionAsync(async () =>
        {
            var carrito = await carritos.ObtenerAsync(idCarrito);
            if (carrito is null || carrito.IdCliente != idCliente)
                throw new NoEncontradoException("Carrito no encontrado.");
            if (carrito.Estado != EstadoCarrito.Activo)
                throw new ReglaNegocioException("El carrito ya no está activo.");

            var direccion = await direcciones.ObtenerAsync(idDireccion);
            if (direccion is null || direccion.IdCliente != idCliente || !direccion.Activa)
                throw new NoEncontradoException("Dirección de entrega no encontrada.");
            var zona = await zonas.ObtenerAsync(direccion.IdZona);
            if (zona is null || !zona.Activa)
                throw new ReglaNegocioException("No hacemos entregas en ese sector por ahora.");

            await carritos.SincronizarPreciosAsync(idCarrito);
            var items = await carritos.ListarItemsAsync(idCarrito);
            if (items.Count == 0) throw new ReglaNegocioException("El carrito está vacío.");

            var subtotal = items.Sum(i => i.Subtotal);
            var iva = Montos.CalcularIva(subtotal, await parametros.IvaAsync());
            var envio = zona.CostoEnvio;

            var pedido = new Pedido
            {
                IdCliente = idCliente,
                IdDireccion = idDireccion,
                Subtotal = subtotal,
                Iva = iva,
                CostoEnvio = envio,
                Total = subtotal + iva + envio,
                Estado = EstadoPedido.PendientePago,
            };
            pedido.IdPedido = await pedidos.InsertarAsync(pedido);
            await pedidos.AsignarNumeroAsync(pedido.IdPedido);

            foreach (var i in items)
            {
                await pedidos.InsertarDetalleAsync(new DetallePedido
                {
                    IdPedido = pedido.IdPedido,
                    IdProducto = i.IdProducto,
                    Cantidad = i.Cantidad,
                    PrecioUnitario = i.PrecioUnitario,   // copia del precio al comprar (RN-04)
                    Subtotal = i.Subtotal,
                });
            }

            await stock.ReservarAsync(pedido.IdPedido, items.Select(i => (i.IdProducto, i.Cantidad)));
            await entregas.InsertarAsync(pedido.IdPedido, TextoDireccion(direccion));
            await carritos.CambiarEstadoAsync(idCarrito, EstadoCarrito.Convertido);

            return (await pedidos.ObtenerAsync(pedido.IdPedido))!;
        });

    public Task<ResultadoPagina<Pedido>> ListarMisPedidosAsync(int idCliente, int pagina = 1, int tamano = 10) =>
        pedidos.ListarPorClienteAsync(idCliente, pagina, tamano);

    public async Task<PedidoDetalleVista> ObtenerDetalleAsync(int idCliente, int idPedido)
    {
        var pedido = await ObtenerPropioAsync(idCliente, idPedido);
        return new PedidoDetalleVista
        {
            Pedido = pedido,
            Detalles = await pedidos.ListarDetallesAsync(idPedido),
            Pagos = await pagos.ListarPorPedidoAsync(idPedido),
            Entrega = await entregas.ObtenerPorPedidoAsync(idPedido),
        };
    }

    /// <summary>
    /// El cliente informa su pago. Transferencia: necesita la ruta del comprobante subido.
    /// Tarjeta: necesita la referencia de la transacción de la pasarela. El pago queda PENDIENTE hasta que se apruebe.
    /// </summary>
    public async Task<Pago> RegistrarPagoAsync(
        int idCliente, int idPedido, string metodo, string? referenciaExterna = null, string? rutaComprobante = null)
    {
        if (metodo != MetodoPago.Transferencia && metodo != MetodoPago.Tarjeta)
            throw new ReglaNegocioException("Método de pago no válido.");

        if (metodo == MetodoPago.Transferencia)
        {
            rutaComprobante = Validar.Texto(rutaComprobante, "El comprobante de transferencia", 300);
            referenciaExterna = Validar.TextoOpcional(referenciaExterna, "La referencia", 100);
        }
        else
        {
            referenciaExterna = Validar.Texto(referenciaExterna, "La referencia de la transacción", 100);
            rutaComprobante = null;
        }

        try
        {
            return await db.TransaccionAsync(async () =>
            {
                var pedido = await ObtenerPropioAsync(idCliente, idPedido);
                if (pedido.Estado != EstadoPedido.PendientePago && pedido.Estado != EstadoPedido.PagoFallido)
                    throw new ReglaNegocioException("Este pedido no admite pagos en su estado actual.");
                if (!await reservas.TieneReservaVigenteAsync(idPedido))
                    throw new ReglaNegocioException("El tiempo de reserva del pedido venció. Realiza un nuevo pedido.");

                var existentes = await pagos.ListarPorPedidoAsync(idPedido);
                if (existentes.Any(p => p.Estado == EstadoPago.Pendiente))
                    throw new ReglaNegocioException("Ya tienes un pago en revisión para este pedido.");

                var idPago = await pagos.InsertarAsync(new Pago
                {
                    IdPedido = idPedido,
                    Metodo = metodo,
                    Monto = pedido.Total,
                    ReferenciaExterna = referenciaExterna,
                    RutaComprobante = rutaComprobante,
                });

                if (pedido.Estado == EstadoPedido.PagoFallido)
                    await pedidos.CambiarEstadoAsync(idPedido, EstadoPedido.PendientePago, EstadoPedido.PagoFallido);

                return (await pagos.ObtenerAsync(idPago))!;
            });
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Esa referencia de pago ya fue utilizada.");
        }
    }

    /// <summary>El cliente cancela su pedido mientras no esté pagado; el stock reservado vuelve a la tienda.</summary>
    public async Task CancelarAsync(int idCliente, int idPedido)
    {
        await ObtenerPropioAsync(idCliente, idPedido);
        await stock.CancelarPedidoAsync(idPedido);
    }

    private async Task<Pedido> ObtenerPropioAsync(int idCliente, int idPedido)
    {
        var pedido = await pedidos.ObtenerAsync(idPedido);
        if (pedido is null || pedido.IdCliente != idCliente)
            throw new NoEncontradoException("Pedido no encontrado.");
        return pedido;
    }

    private static string TextoDireccion(Direccion d)
    {
        var calles = string.IsNullOrWhiteSpace(d.CalleSecundaria) ? d.CallePrincipal : $"{d.CallePrincipal} y {d.CalleSecundaria}";
        var texto = $"{calles}, {d.Sector}, {d.Ciudad}";
        if (!string.IsNullOrWhiteSpace(d.Referencia)) texto += $". Ref: {d.Referencia}";
        return texto.Length > 600 ? texto[..600] : texto;
    }
}
