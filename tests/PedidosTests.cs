using Floravia.Core.Entidades;

namespace Floravia.Tests;

/// <summary>Flujo completo: carrito → pedido → reserva → pago → aprobación → entrega. Es el corazón del negocio.</summary>
[Collection("bd")]
public class PedidosTests(BaseDatosFixture f)
{
    private async Task<Producto> ProductoAsync(int id) => (await f.S.Productos.ObtenerAsync(id))!.Producto;

    [Fact]
    public async Task Crear_pedido_calcula_totales_numero_reserva_y_entrega()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(precio: 20m, stock: 10);
        var dir = await f.NuevaDireccionAsync(c.IdCliente, "Norte"); // envío 3.00

        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p, 2);
        var pedido = await f.S.Pedidos.CrearDesdeCarritoAsync(c.IdCliente, carrito.IdCarrito, dir.IdDireccion);

        Assert.Equal(40m, pedido.Subtotal);
        Assert.Equal(6m, pedido.Iva);
        Assert.Equal(3m, pedido.CostoEnvio);
        Assert.Equal(49m, pedido.Total);
        Assert.Equal(EstadoPedido.PendientePago, pedido.Estado);
        Assert.Matches(@"^FLV-\d{8}-\d{6}$", pedido.Numero);

        var prod = await ProductoAsync(p);
        Assert.Equal(10, prod.Stock);            // el stock real aún no baja
        Assert.Equal(2, prod.StockReservado);    // pero 2 unidades quedan apartadas
        Assert.Equal(8, prod.StockDisponible);

        var det = await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, pedido.IdPedido);
        Assert.Single(det.Detalles);
        Assert.Contains("Av. Amazonas N10 y Naciones Unidas, Norte, Quito", det.Entrega!.DireccionEntrega);

        // El carrito quedó convertido: pedir uno nuevo devuelve otro vacío
        var nuevo = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        Assert.NotEqual(carrito.IdCarrito, nuevo.IdCarrito);
    }

    [Fact]
    public async Task El_precio_del_pedido_no_cambia_si_el_producto_sube_despues()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(precio: 10m, stock: 5);
        var pedido = await f.NuevoPedidoAsync(c, (p, 1));
        var datos = await ProductoAsync(p);

        await f.S.Productos.ActualizarAsync(p, new DatosProducto(datos.IdCategoria, datos.Codigo, datos.Nombre, null, null, 99m, 0));

        var det = await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, pedido.IdPedido);
        Assert.Equal(10m, det.Detalles.Single().PrecioUnitario); // RN-04
    }

    [Fact]
    public async Task Si_falta_stock_no_queda_nada_a_medias()
    {
        var c = await f.NuevoClienteAsync();
        var abundante = await f.NuevoProductoAsync(stock: 10);
        var escaso = await f.NuevoProductoAsync(stock: 2);
        var dir = await f.NuevaDireccionAsync(c.IdCliente);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, abundante, 3);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, escaso, 2);

        // Mientras tanto, otro cliente se lleva el stock del producto escaso
        await f.NuevoPedidoAsync(await f.NuevoClienteAsync(), (escaso, 2));

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Pedidos.CrearDesdeCarritoAsync(c.IdCliente, carrito.IdCarrito, dir.IdDireccion));
        Assert.Contains("stock suficiente", ex.Message);

        // Todo se revirtió: sin pedido, sin reservas del primer producto y carrito aún activo
        Assert.Equal(0, (await ProductoAsync(abundante)).StockReservado);
        Assert.Empty((await f.S.Pedidos.ListarMisPedidosAsync(c.IdCliente)).Items);
        Assert.Equal(EstadoCarrito.Activo, (await f.S.Carrito.VerAsync(carrito.IdCarrito)).Carrito.Estado);
    }

    [Fact]
    public async Task Dos_clientes_comprando_la_ultima_unidad_solo_uno_gana()
    {
        var p = await f.NuevoProductoAsync(stock: 1);
        var clientes = new[] { await f.NuevoClienteAsync(), await f.NuevoClienteAsync(), await f.NuevoClienteAsync() };
        var preparados = new List<(Cliente C, int Carrito, int Dir)>();
        foreach (var c in clientes)
        {
            var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
            await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p, 1);
            preparados.Add((c, carrito.IdCarrito, (await f.NuevaDireccionAsync(c.IdCliente)).IdDireccion));
        }

        var resultados = await Task.WhenAll(preparados.Select(async x =>
        {
            try { await f.S.Pedidos.CrearDesdeCarritoAsync(x.C.IdCliente, x.Carrito, x.Dir); return true; }
            catch (ReglaNegocioException) { return false; }
        }));

        Assert.Equal(1, resultados.Count(ok => ok));
        Assert.Equal(1, (await ProductoAsync(p)).StockReservado); // nunca se sobrevende
    }

    [Fact]
    public async Task No_se_puede_crear_pedido_con_carrito_vacio_ajeno_o_direccion_ajena()
    {
        var c = await f.NuevoClienteAsync();
        var otro = await f.NuevoClienteAsync();
        var dir = await f.NuevaDireccionAsync(c.IdCliente);
        var dirAjena = await f.NuevaDireccionAsync(otro.IdCliente);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.CrearDesdeCarritoAsync(c.IdCliente, carrito.IdCarrito, dir.IdDireccion)); // vacío

        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, await f.NuevoProductoAsync(), 1);
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Pedidos.CrearDesdeCarritoAsync(c.IdCliente, carrito.IdCarrito, dirAjena.IdDireccion));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Pedidos.CrearDesdeCarritoAsync(otro.IdCliente, carrito.IdCarrito, dirAjena.IdDireccion));
    }

    [Fact]
    public async Task Flujo_completo_pago_aprobado_baja_stock_y_deja_kardex()
    {
        var admin = await f.NuevoAdminAsync();
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 10);
        var pedido = await f.NuevoPedidoAsync(c, (p, 3));

        var pago = await f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Transferencia, "REF-1", "comprobantes/a.jpg");
        Assert.Equal(EstadoPago.Pendiente, pago.Estado);
        Assert.Equal(pedido.Total, pago.Monto);
        Assert.Contains(await f.S.PedidosAdmin.ListarPagosPendientesAsync(), x => x.IdPago == pago.IdPago);

        var pagado = await f.S.PedidosAdmin.AprobarPagoAsync(pago.IdPago);
        Assert.Equal(EstadoPedido.Pagado, pagado.Estado);

        var prod = await ProductoAsync(p);
        Assert.Equal(7, prod.Stock);
        Assert.Equal(0, prod.StockReservado);
        var salida = Assert.Single(await f.S.Inventario.ObtenerKardexAsync(p), m => m.Tipo == TipoMovimiento.Salida);
        Assert.Equal(3, salida.Cantidad);
        Assert.Equal(7, salida.Saldo);
        Assert.Equal(pedido.IdPedido, salida.IdPedido);

        // Doble clic en "aprobar": el segundo intento falla y el stock no baja dos veces
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.AprobarPagoAsync(pago.IdPago));
        Assert.Equal(7, (await ProductoAsync(p)).Stock);

        // Avance: PAGADO → EN_PREPARACION → EN_CAMINO → ENTREGADO
        await f.S.PedidosAdmin.AvanzarEstadoAsync(pedido.IdPedido, EstadoPedido.EnPreparacion);
        await f.S.PedidosAdmin.AvanzarEstadoAsync(pedido.IdPedido, EstadoPedido.EnCamino);
        var entregado = await f.S.PedidosAdmin.AvanzarEstadoAsync(pedido.IdPedido, EstadoPedido.Entregado);
        Assert.Equal(EstadoPedido.Entregado, entregado.Estado);
        var detalle = await f.S.PedidosAdmin.ObtenerDetalleAsync(pedido.IdPedido);
        Assert.Equal(EstadoEntrega.Entregada, detalle.Entrega!.Estado);
        Assert.NotNull(detalle.Entrega.FechaEntrega);
        _ = admin;
    }

    [Fact]
    public async Task No_se_puede_saltar_pasos_ni_retroceder_el_estado()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 5);
        var pagado = await f.NuevoPedidoPagadoAsync(c, (p, 1));

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.AvanzarEstadoAsync(pagado.IdPedido, EstadoPedido.Entregado));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.AvanzarEstadoAsync(pagado.IdPedido, EstadoPedido.Pagado));

        var pendiente = await f.NuevoPedidoAsync(c, (p, 1));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.AvanzarEstadoAsync(pendiente.IdPedido, EstadoPedido.EnPreparacion));
    }

    [Fact]
    public async Task Pago_rechazado_permite_reintentar_mientras_dure_la_reserva()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 5);
        var pedido = await f.NuevoPedidoAsync(c, (p, 1));

        var pago1 = await f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Transferencia, null, "comprobantes/mal.jpg");
        // No puede haber dos pagos en revisión a la vez
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Transferencia, null, "comprobantes/otro.jpg"));

        var fallido = await f.S.PedidosAdmin.RechazarPagoAsync(pago1.IdPago);
        Assert.Equal(EstadoPedido.PagoFallido, fallido.Estado);

        var pago2 = await f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Transferencia, null, "comprobantes/bien.jpg");
        var det = await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, pedido.IdPedido);
        Assert.Equal(EstadoPedido.PendientePago, det.Pedido.Estado);

        await f.S.PedidosAdmin.AprobarPagoAsync(pago2.IdPago);
        Assert.Equal(2, (await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, pedido.IdPedido)).Pagos.Count);
    }

    [Fact]
    public async Task Validaciones_del_pago()
    {
        var c = await f.NuevoClienteAsync();
        var otro = await f.NuevoClienteAsync();
        var pedido = await f.NuevoPedidoAsync(c, (await f.NuevoProductoAsync(), 1));

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, "EFECTIVO"));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Transferencia)); // sin comprobante
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Tarjeta));        // sin referencia
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Pedidos.RegistrarPagoAsync(otro.IdCliente, pedido.IdPedido, MetodoPago.Tarjeta, "TX-1"));
    }

    [Fact]
    public async Task La_referencia_de_la_pasarela_no_se_puede_reutilizar()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 9);
        var a = await f.NuevoPedidoAsync(c, (p, 1));
        var b = await f.NuevoPedidoAsync(c, (p, 1));
        var tx = "TX-" + BaseDatosFixture.Unico();

        await f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, a.IdPedido, MetodoPago.Tarjeta, tx);
        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, b.IdPedido, MetodoPago.Tarjeta, tx));
        Assert.Contains("referencia", ex.Message);
    }

    [Fact]
    public async Task Cancelar_pedido_sin_pagar_libera_el_stock_pero_uno_pagado_no_se_cancela()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 5);
        var pedido = await f.NuevoPedidoAsync(c, (p, 4));
        Assert.Equal(4, (await ProductoAsync(p)).StockReservado);

        await f.S.Pedidos.CancelarAsync(c.IdCliente, pedido.IdPedido);

        var prod = await ProductoAsync(p);
        Assert.Equal(0, prod.StockReservado);
        Assert.Equal(5, prod.Stock);
        Assert.Equal(EstadoPedido.Cancelado, (await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, pedido.IdPedido)).Pedido.Estado);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.CancelarAsync(c.IdCliente, pedido.IdPedido)); // ya cancelado

        var pagado = await f.NuevoPedidoPagadoAsync(c, (p, 1));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Pedidos.CancelarAsync(c.IdCliente, pagado.IdPedido));
        var ajeno1 = await f.NuevoClienteAsync();
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Pedidos.CancelarAsync(ajeno1.IdCliente, pagado.IdPedido));
    }

    [Fact]
    public async Task Cancelar_deja_sin_efecto_un_pago_pendiente_y_el_admin_ya_no_puede_aprobarlo()
    {
        var c = await f.NuevoClienteAsync();
        var pedido = await f.NuevoPedidoAsync(c, (await f.NuevoProductoAsync(), 1));
        var pago = await f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Tarjeta, "TX-" + BaseDatosFixture.Unico());

        await f.S.PedidosAdmin.CancelarAsync(pedido.IdPedido);

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.AprobarPagoAsync(pago.IdPago));
    }

    [Fact]
    public async Task Reservas_vencidas_se_cancelan_y_devuelven_el_stock()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 5);
        var vencido = await f.NuevoPedidoAsync(c, (p, 2));
        var vigente = await f.NuevoPedidoAsync(c, (p, 1));
        await f.S.Db.EjecutarAsync("UPDATE reserva_stock SET expira_en = NOW() - interval '1 minute' WHERE id_pedido = @id", new { id = vencido.IdPedido });

        // Un pedido con reserva vencida ya no admite pago
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, vencido.IdPedido, MetodoPago.Tarjeta, "TX-" + BaseDatosFixture.Unico()));

        var cancelados = await f.S.PedidosAdmin.LiberarReservasVencidasAsync();

        Assert.True(cancelados >= 1);
        Assert.Equal(EstadoPedido.Cancelado, (await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, vencido.IdPedido)).Pedido.Estado);
        Assert.Equal(EstadoPedido.PendientePago, (await f.S.Pedidos.ObtenerDetalleAsync(c.IdCliente, vigente.IdPedido)).Pedido.Estado);
        var prod = await ProductoAsync(p);
        Assert.Equal(1, prod.StockReservado); // solo queda la del pedido vigente
    }

    [Fact]
    public async Task Aprobar_un_pago_con_la_reserva_vencida_falla_y_no_toca_el_stock()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 5);
        var pedido = await f.NuevoPedidoAsync(c, (p, 2));
        var pago = await f.S.Pedidos.RegistrarPagoAsync(c.IdCliente, pedido.IdPedido, MetodoPago.Tarjeta, "TX-" + BaseDatosFixture.Unico());
        await f.S.PedidosAdmin.LiberarReservasVencidasAsync(); // no hace nada: aún vigente
        await f.S.Db.EjecutarAsync("UPDATE reserva_stock SET estado = 'EXPIRADA' WHERE id_pedido = @id", new { id = pedido.IdPedido });
        await f.S.Db.EjecutarAsync("UPDATE producto SET stock_reservado = 0 WHERE id_producto = @id", new { id = p });

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.AprobarPagoAsync(pago.IdPago));

        // Todo se revirtió: el pago sigue pendiente y el stock intacto
        Assert.Equal(EstadoPago.Pendiente, (await f.S.PedidosAdmin.ObtenerDetalleAsync(pedido.IdPedido)).Pagos.Single().Estado);
        Assert.Equal(5, (await ProductoAsync(p)).Stock);
    }

    [Fact]
    public async Task Historial_del_cliente_y_listado_del_admin_con_filtros()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 20);
        var a = await f.NuevoPedidoAsync(c, (p, 1));
        var b = await f.NuevoPedidoPagadoAsync(c, (p, 1));

        var mios = await f.S.Pedidos.ListarMisPedidosAsync(c.IdCliente);
        Assert.Equal(2, mios.Total);
        Assert.Equal(b.IdPedido, mios.Items[0].IdPedido); // el más reciente primero

        var porNumero = await f.S.PedidosAdmin.ListarAsync(new FiltroPedido { Texto = a.Numero });
        var unico = Assert.Single(porNumero.Items);
        Assert.Equal(a.IdPedido, unico.IdPedido);
        Assert.Equal(c.Correo, unico.ClienteCorreo);

        var porEstado = await f.S.PedidosAdmin.ListarAsync(new FiltroPedido { Estado = EstadoPedido.Pagado, Texto = c.Correo });
        Assert.Equal(b.IdPedido, Assert.Single(porEstado.Items).IdPedido);

        // Un cliente no ve pedidos de otro
        var ajeno2 = await f.NuevoClienteAsync();
        await Assert.ThrowsAsync<NoEncontradoException>(() =>
            f.S.Pedidos.ObtenerDetalleAsync(ajeno2.IdCliente, a.IdPedido));
    }

    [Fact]
    public async Task Programar_entrega_no_acepta_fechas_pasadas()
    {
        var c = await f.NuevoClienteAsync();
        var pedido = await f.NuevoPedidoAsync(c, (await f.NuevoProductoAsync(), 1));

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.PedidosAdmin.ProgramarEntregaAsync(pedido.IdPedido, DateTime.Today.AddDays(-1)));
        await f.S.PedidosAdmin.ProgramarEntregaAsync(pedido.IdPedido, DateTime.Today.AddDays(2));
        var e = (await f.S.PedidosAdmin.ObtenerDetalleAsync(pedido.IdPedido)).Entrega!;
        Assert.Equal(DateTime.Today.AddDays(2), e.FechaProgramada);
    }
}
