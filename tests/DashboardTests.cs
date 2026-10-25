using Floravia.Core.Entidades;

namespace Floravia.Tests;

[Collection("bd")]
public class DashboardTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Dashboard_refleja_ventas_pendientes_mas_vendidos_y_stock_bajo()
    {
        var antes = await f.S.Dashboard.ObtenerAsync();

        var c = await f.NuevoClienteAsync();
        var estrella = await f.NuevoProductoAsync("Planta", precio: 10m, stock: 50, nombre: "Estrella " + BaseDatosFixture.Unico());
        var bajo = await f.NuevoProductoAsync(stock: 1, stockMinimo: 5);
        var pagado = await f.NuevoPedidoPagadoAsync(c, (estrella, 7)); // 70 + 10.50 IVA + 3 envío = 83.50
        await f.NuevoPedidoAsync(c, (estrella, 1));                     // pendiente: no cuenta como venta

        var d = await f.S.Dashboard.ObtenerAsync(dias: 7, top: 100);

        Assert.Equal(antes.Resumen.VentasTotales + pagado.Total, d.Resumen.VentasTotales);
        Assert.Equal(83.50m, pagado.Total);
        Assert.Equal(antes.Resumen.PedidosVendidos + 1, d.Resumen.PedidosVendidos);
        Assert.Equal(antes.Resumen.PedidosPendientesPago + 1, d.Resumen.PedidosPendientesPago);
        Assert.Equal(antes.Resumen.PedidosPorPreparar + 1, d.Resumen.PedidosPorPreparar);
        Assert.Equal(antes.Resumen.ClientesTotales + 1, d.Resumen.ClientesTotales);
        Assert.Equal(antes.Resumen.ProductosActivos + 2, d.Resumen.ProductosActivos);
        Assert.Equal(antes.Resumen.ProductosStockBajo + 1, d.Resumen.ProductosStockBajo);
        Assert.True(d.Resumen.TicketPromedio > 0);

        var top = Assert.Single(d.MasVendidos, m => m.IdProducto == estrella);
        Assert.Equal(7, top.Unidades);          // solo cuenta lo pagado, no el pedido pendiente
        Assert.Equal(70m, top.Ingresos);
        Assert.Contains(d.StockBajo, p => p.IdProducto == bajo);
        Assert.Contains(d.VentasPorCategoria, v => v.Categoria == "Planta" && v.Ingresos >= 70m);
        Assert.Contains(d.PedidosPorEstado, e => e.Estado == EstadoPedido.PendientePago && e.Cantidad >= 1);
    }

    [Fact]
    public async Task Ventas_por_dia_devuelve_todos_los_dias_del_rango_con_ceros()
    {
        var c = await f.NuevoClienteAsync();
        var pagado = await f.NuevoPedidoPagadoAsync(c, (await f.NuevoProductoAsync(precio: 10m), 1));

        var d = await f.S.Dashboard.ObtenerAsync(dias: 10);

        Assert.Equal(10, d.VentasPorDia.Count);
        Assert.Equal(DateTime.Today, d.VentasPorDia[^1].Dia);
        Assert.True(d.VentasPorDia[^1].Total >= pagado.Total);
        Assert.Equal(DateTime.Today.AddDays(-9), d.VentasPorDia[0].Dia);
        Assert.Equal(0m, d.VentasPorDia[0].Total); // días sin ventas salen en 0
    }

    [Fact]
    public async Task Un_pedido_cancelado_no_suma_ventas()
    {
        var antes = await f.S.Dashboard.ObtenerAsync();
        var c = await f.NuevoClienteAsync();
        var pedido = await f.NuevoPedidoAsync(c, (await f.NuevoProductoAsync(), 1));
        await f.S.Pedidos.CancelarAsync(c.IdCliente, pedido.IdPedido);

        var despues = await f.S.Dashboard.ObtenerAsync();
        Assert.Equal(antes.Resumen.VentasTotales, despues.Resumen.VentasTotales);
    }

    [Fact]
    public async Task Admin_lista_y_busca_clientes_y_puede_bloquear_cuentas()
    {
        var c = await f.NuevoClienteAsync();
        var r = await f.S.Usuarios.ListarClientesAsync(c.Correo);
        Assert.Equal(c.IdCliente, Assert.Single(r.Items).IdCliente);

        await f.S.Usuarios.CambiarEstadoUsuarioAsync(c.IdUsuario, EstadoRegistro.Bloqueado);
        Assert.Equal(EstadoRegistro.Bloqueado, (await f.S.Usuarios.ObtenerClienteAsync(c.IdCliente))!.EstadoUsuario);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Usuarios.CambiarEstadoUsuarioAsync(c.IdUsuario, "OTRO"));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Usuarios.CambiarEstadoUsuarioAsync(999999, EstadoRegistro.Activo));
    }
}
