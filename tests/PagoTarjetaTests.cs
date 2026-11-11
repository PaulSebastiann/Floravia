using Floravia.Core.Entidades;

namespace Floravia.Tests;

/// <summary>Pasarela de tarjeta SIMULADA: validación de datos (sin base de datos) y pago de pedidos (con base de datos).</summary>
[Collection("bd")]
public class PagoTarjetaTests(BaseDatosFixture f)
{
    private static DatosTarjeta Visa(string numero = "4242 4242 4242 4242", string cvv = "123") =>
        new(numero, "Ana Prueba", 12, DateTime.Today.Year + 2, cvv);

    // ---------- Validación (no toca la base de datos) ----------

    [Fact]
    public void Tarjeta_valida_se_aprueba_y_solo_expone_marca_y_ultimos_4()
    {
        var r = TarjetaSimulada.Evaluar(Visa());
        Assert.True(r.Aprobada);
        Assert.Equal("Visa", r.Marca);
        Assert.Equal("4242", r.Ultimos4);
    }

    [Theory]
    [InlineData("5555555555554444", "Mastercard", "123")]
    [InlineData("378282246310005", "Amex", "1234")]
    [InlineData("4111-1111-1111-1111", "Visa", "123")]
    public void Detecta_la_marca_y_el_largo_del_cvv(string numero, string marca, string cvv)
    {
        var r = TarjetaSimulada.Evaluar(Visa(numero, cvv));
        Assert.Equal(marca, r.Marca);
        Assert.True(r.Aprobada);
    }

    [Theory]
    [InlineData("4242424242424241")]   // no pasa el algoritmo de Luhn
    [InlineData("4242 4242 abcd 4242")] // letras
    [InlineData("1234")]               // muy corto
    [InlineData("")]
    public void Numero_invalido_se_rechaza_con_mensaje_que_no_repite_el_numero(string numero)
    {
        var e = Assert.Throws<ReglaNegocioException>(() => TarjetaSimulada.Evaluar(Visa(numero)));
        if (numero.Trim().Length > 0) Assert.DoesNotContain(numero.Trim(), e.Message);
    }

    [Fact]
    public void Tarjeta_vencida_se_rechaza_pero_el_mes_en_curso_sigue_vigente()
    {
        var hoy = new DateTime(2026, 11, 15);
        Assert.Throws<ReglaNegocioException>(() =>
            TarjetaSimulada.Evaluar(new("4242424242424242", "Ana Prueba", 10, 2026, "123"), hoy));
        Assert.True(TarjetaSimulada.Evaluar(new("4242424242424242", "Ana Prueba", 11, 2026, "123"), hoy).Aprobada);
        Assert.True(TarjetaSimulada.Evaluar(new("4242424242424242", "Ana Prueba", 11, 26, "123"), hoy).Aprobada); // año de 2 dígitos
    }

    [Theory]
    [InlineData("12")]    // muy corto
    [InlineData("1234")]  // Visa lleva 3
    [InlineData("12a")]
    public void Cvv_invalido_se_rechaza(string cvv) =>
        Assert.Throws<ReglaNegocioException>(() => TarjetaSimulada.Evaluar(Visa(cvv: cvv)));

    [Fact]
    public void Mes_y_titular_invalidos_se_rechazan()
    {
        Assert.Throws<ReglaNegocioException>(() =>
            TarjetaSimulada.Evaluar(new("4242424242424242", "Ana", 13, DateTime.Today.Year + 1, "123")));
        Assert.Throws<ReglaNegocioException>(() =>
            TarjetaSimulada.Evaluar(new("4242424242424242", "  ", 12, DateTime.Today.Year + 1, "123")));
    }

    [Theory]
    [InlineData(TarjetaSimulada.NumeroRechazada, "rechazada")]
    [InlineData(TarjetaSimulada.NumeroSinFondos, "insuficientes")]
    public void Tarjetas_de_prueba_simulan_rechazos(string numero, string textoEsperado)
    {
        var r = TarjetaSimulada.Evaluar(Visa(numero));
        Assert.False(r.Aprobada);
        Assert.Contains(textoEsperado, r.Mensaje, StringComparison.OrdinalIgnoreCase);
    }

    // ---------- Pago de pedidos (con base de datos) ----------

    [Fact]
    public async Task Pago_aprobado_deja_el_pedido_pagado_y_descuenta_el_stock()
    {
        var cliente = await f.NuevoClienteAsync();
        var producto = await f.NuevoProductoAsync(precio: 10m, stock: 10);
        var pedido = await f.NuevoPedidoAsync(cliente, (producto, 2));

        var r = await f.S.PagosTarjeta.PagarAsync(cliente.IdCliente, pedido.IdPedido, Visa());

        Assert.True(r.Aprobado);
        Assert.Equal(EstadoPedido.Pagado, r.Pedido.Pedido.Estado);
        var pago = Assert.Single(r.Pedido.Pagos);
        Assert.Equal(EstadoPago.Aprobado, pago.Estado);
        Assert.Equal(MetodoPago.Tarjeta, pago.Metodo);
        Assert.StartsWith("SIM-Visa-4242-", pago.ReferenciaExterna);
        Assert.DoesNotContain("4242424242424242", pago.ReferenciaExterna);

        var p = (await f.S.Productos.ObtenerAsync(producto))!.Producto;
        Assert.Equal(8, p.Stock);
        Assert.Equal(0, p.StockReservado);
    }

    [Fact]
    public async Task Pago_rechazado_deja_pago_fallido_y_permite_reintentar_con_otra_tarjeta()
    {
        var cliente = await f.NuevoClienteAsync();
        var producto = await f.NuevoProductoAsync(precio: 10m, stock: 5);
        var pedido = await f.NuevoPedidoAsync(cliente, (producto, 1));

        var fallo = await f.S.PagosTarjeta.PagarAsync(cliente.IdCliente, pedido.IdPedido, Visa(TarjetaSimulada.NumeroRechazada));
        Assert.False(fallo.Aprobado);
        Assert.Equal(EstadoPedido.PagoFallido, fallo.Pedido.Pedido.Estado);
        Assert.Equal(EstadoPago.Rechazado, Assert.Single(fallo.Pedido.Pagos).Estado);
        Assert.Equal(1, (await f.S.Productos.ObtenerAsync(producto))!.Producto.StockReservado); // sigue reservado

        var ok = await f.S.PagosTarjeta.PagarAsync(cliente.IdCliente, pedido.IdPedido, Visa());
        Assert.True(ok.Aprobado);
        Assert.Equal(EstadoPedido.Pagado, ok.Pedido.Pedido.Estado);
        Assert.Equal(2, ok.Pedido.Pagos.Count);
    }

    [Fact]
    public async Task Tarjeta_con_formato_invalido_no_registra_ningun_pago()
    {
        var cliente = await f.NuevoClienteAsync();
        var producto = await f.NuevoProductoAsync(precio: 10m, stock: 5);
        var pedido = await f.NuevoPedidoAsync(cliente, (producto, 1));

        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.PagosTarjeta.PagarAsync(cliente.IdCliente, pedido.IdPedido, Visa("4242424242424241")));

        var detalle = await f.S.Pedidos.ObtenerDetalleAsync(cliente.IdCliente, pedido.IdPedido);
        Assert.Empty(detalle.Pagos);
        Assert.Equal(EstadoPedido.PendientePago, detalle.Pedido.Estado);
    }

    [Fact]
    public async Task No_se_puede_pagar_el_pedido_de_otro_cliente()
    {
        var dueno = await f.NuevoClienteAsync();
        var intruso = await f.NuevoClienteAsync();
        var producto = await f.NuevoProductoAsync(precio: 10m, stock: 5);
        var pedido = await f.NuevoPedidoAsync(dueno, (producto, 1));

        await Assert.ThrowsAsync<NoEncontradoException>(() =>
            f.S.PagosTarjeta.PagarAsync(intruso.IdCliente, pedido.IdPedido, Visa()));
    }
}
