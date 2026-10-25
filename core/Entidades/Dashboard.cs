namespace Floravia.Core.Entidades;

public class ResumenDashboard
{
    /// <summary>Suma de pedidos pagados, en preparación, en camino o entregados.</summary>
    public decimal VentasTotales { get; set; }
    public int PedidosVendidos { get; set; }
    public decimal TicketPromedio { get; set; }
    public int PedidosPendientesPago { get; set; }
    public int PedidosPorPreparar { get; set; }
    public int ClientesTotales { get; set; }
    public int ProductosActivos { get; set; }
    public int ProductosStockBajo { get; set; }
}

public class VentaDiaria
{
    public DateTime Dia { get; set; }
    public decimal Total { get; set; }
    public int Pedidos { get; set; }
}

public class PedidosPorEstado
{
    public string Estado { get; set; } = "";
    public int Cantidad { get; set; }
}

public class ProductoMasVendido
{
    public int IdProducto { get; set; }
    public string Codigo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int Unidades { get; set; }
    public decimal Ingresos { get; set; }
}

public class VentaPorCategoria
{
    public string Categoria { get; set; } = "";
    public int Unidades { get; set; }
    public decimal Ingresos { get; set; }
}

public class DashboardCompleto
{
    public ResumenDashboard Resumen { get; set; } = new();
    public List<VentaDiaria> VentasPorDia { get; set; } = [];
    public List<PedidosPorEstado> PedidosPorEstado { get; set; } = [];
    public List<ProductoMasVendido> MasVendidos { get; set; } = [];
    public List<VentaPorCategoria> VentasPorCategoria { get; set; } = [];
    public List<Producto> StockBajo { get; set; } = [];
}
