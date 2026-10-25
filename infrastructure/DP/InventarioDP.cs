using Floravia.Core.Entidades;

namespace Floravia.Infrastructure.DP;

public sealed class MovimientoDP(Db db)
{
    private const string Cols = """
        m.id_movimiento, m.id_producto, m.id_pedido, m.id_admin, m.id_proveedor, m.fecha, m.tipo,
        m.cantidad, m.costo_unitario, m.saldo, m.motivo,
        p.nombre AS producto_nombre, v.nombre AS proveedor_nombre
        """;
    private const string Desde = """
        FROM movimiento_inventario m
        JOIN producto p ON p.id_producto = m.id_producto
        LEFT JOIN proveedor v ON v.id_proveedor = m.id_proveedor
        """;

    public Task<int> InsertarAsync(MovimientoInventario m) =>
        db.EscalarAsync<int>("""
            INSERT INTO movimiento_inventario
                   (id_producto, id_pedido, id_admin, id_proveedor, tipo, cantidad, costo_unitario, saldo, motivo)
            VALUES (@IdProducto, @IdPedido, @IdAdmin, @IdProveedor, @Tipo, @Cantidad, @CostoUnitario, @Saldo, @Motivo)
            RETURNING id_movimiento
            """, m);

    public Task<List<MovimientoInventario>> ListarPorProductoAsync(int idProducto, int limite) =>
        db.ListarAsync<MovimientoInventario>(
            $"SELECT {Cols} {Desde} WHERE m.id_producto = @idProducto ORDER BY m.fecha DESC, m.id_movimiento DESC LIMIT @limite",
            new { idProducto, limite });

    public Task<List<MovimientoInventario>> ListarRecientesAsync(int limite) =>
        db.ListarAsync<MovimientoInventario>(
            $"SELECT {Cols} {Desde} ORDER BY m.fecha DESC, m.id_movimiento DESC LIMIT @limite", new { limite });
}

public sealed class ProveedorDP(Db db)
{
    private const string Cols = "id_proveedor, nombre, ruc, telefono";

    public Task<List<Proveedor>> ListarAsync() =>
        db.ListarAsync<Proveedor>($"SELECT {Cols} FROM proveedor ORDER BY nombre");

    public Task<Proveedor?> ObtenerAsync(int id) =>
        db.UnoAsync<Proveedor>($"SELECT {Cols} FROM proveedor WHERE id_proveedor = @id", new { id });

    public Task<int> InsertarAsync(Proveedor p) =>
        db.EscalarAsync<int>(
            "INSERT INTO proveedor (nombre, ruc, telefono) VALUES (@Nombre, @Ruc, @Telefono) RETURNING id_proveedor", p);

    public Task<int> ActualizarAsync(Proveedor p) =>
        db.EjecutarAsync(
            "UPDATE proveedor SET nombre = @Nombre, ruc = @Ruc, telefono = @Telefono WHERE id_proveedor = @IdProveedor", p);

    public Task<int> EliminarAsync(int id) =>
        db.EjecutarAsync("DELETE FROM proveedor WHERE id_proveedor = @id", new { id });
}

/// <summary>Consultas del dashboard del admin. Solo lectura.</summary>
public sealed class DashboardDP(Db db)
{
    // Pedidos que cuentan como venta realizada (ya pagados)
    private const string EstadosVenta = "('PAGADO','EN_PREPARACION','EN_CAMINO','ENTREGADO')";

    public Task<ResumenDashboard?> ResumenAsync() =>
        db.UnoAsync<ResumenDashboard>($"""
            SELECT
              COALESCE((SELECT SUM(total) FROM pedido WHERE estado IN {EstadosVenta}), 0)           AS ventas_totales,
              (SELECT COUNT(*)::int FROM pedido WHERE estado IN {EstadosVenta})                      AS pedidos_vendidos,
              COALESCE((SELECT ROUND(AVG(total), 2) FROM pedido WHERE estado IN {EstadosVenta}), 0)  AS ticket_promedio,
              (SELECT COUNT(*)::int FROM pedido WHERE estado = 'PENDIENTE_PAGO')                     AS pedidos_pendientes_pago,
              (SELECT COUNT(*)::int FROM pedido WHERE estado IN ('PAGADO','EN_PREPARACION'))         AS pedidos_por_preparar,
              (SELECT COUNT(*)::int FROM cliente)                                                    AS clientes_totales,
              (SELECT COUNT(*)::int FROM producto WHERE estado = 'ACTIVO')                           AS productos_activos,
              (SELECT COUNT(*)::int FROM producto
                WHERE estado = 'ACTIVO' AND stock - stock_reservado <= stock_minimo)                 AS productos_stock_bajo
            """);

    /// <summary>Ventas por día de los últimos N días; los días sin ventas salen con 0.</summary>
    public Task<List<VentaDiaria>> VentasPorDiaAsync(int dias) =>
        db.ListarAsync<VentaDiaria>($"""
            SELECT d::date::timestamp AS dia,
                   COALESCE(SUM(p.total), 0) AS total,
                   COUNT(p.id_pedido)::int   AS pedidos
              FROM generate_series((CURRENT_DATE - (@dias - 1))::timestamp, CURRENT_DATE::timestamp, interval '1 day') AS d
              LEFT JOIN pedido p ON p.fecha::date = d::date AND p.estado IN {EstadosVenta}
             GROUP BY d
             ORDER BY d
            """, new { dias = Math.Clamp(dias, 1, 366) });

    public Task<List<PedidosPorEstado>> PedidosPorEstadoAsync() =>
        db.ListarAsync<PedidosPorEstado>(
            "SELECT estado, COUNT(*)::int AS cantidad FROM pedido GROUP BY estado ORDER BY estado");

    public Task<List<ProductoMasVendido>> MasVendidosAsync(int top) =>
        db.ListarAsync<ProductoMasVendido>($"""
            SELECT pr.id_producto, pr.codigo, pr.nombre,
                   SUM(d.cantidad)::int AS unidades, SUM(d.subtotal) AS ingresos
              FROM detalle_pedido d
              JOIN pedido pe ON pe.id_pedido = d.id_pedido AND pe.estado IN {EstadosVenta}
              JOIN producto pr ON pr.id_producto = d.id_producto
             GROUP BY pr.id_producto, pr.codigo, pr.nombre
             ORDER BY unidades DESC, ingresos DESC, pr.id_producto
             LIMIT @top
            """, new { top });

    public Task<List<VentaPorCategoria>> VentasPorCategoriaAsync() =>
        db.ListarAsync<VentaPorCategoria>($"""
            SELECT c.nombre AS categoria, SUM(d.cantidad)::int AS unidades, SUM(d.subtotal) AS ingresos
              FROM detalle_pedido d
              JOIN pedido pe ON pe.id_pedido = d.id_pedido AND pe.estado IN {EstadosVenta}
              JOIN producto pr ON pr.id_producto = d.id_producto
              JOIN categoria c ON c.id_categoria = pr.id_categoria
             GROUP BY c.nombre
             ORDER BY ingresos DESC
            """);
}
