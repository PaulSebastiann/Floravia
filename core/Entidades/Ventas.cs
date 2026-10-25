namespace Floravia.Core.Entidades;

public class ZonaEntrega
{
    public int IdZona { get; set; }
    public string Sector { get; set; } = "";
    public decimal CostoEnvio { get; set; }
    public bool Activa { get; set; } = true;
}

public class Direccion
{
    public int IdDireccion { get; set; }
    public int IdCliente { get; set; }
    public int IdZona { get; set; }
    public string CallePrincipal { get; set; } = "";
    public string? CalleSecundaria { get; set; }
    public string? Referencia { get; set; }
    public string Ciudad { get; set; } = "Quito";
    public bool EsPrincipal { get; set; }
    public bool Activa { get; set; } = true;

    // Datos del join con zona_entrega
    public string? Sector { get; set; }
    public decimal CostoEnvio { get; set; }
}

public class Carrito
{
    public int IdCarrito { get; set; }
    public int? IdCliente { get; set; }
    public string? TokenSesion { get; set; }
    public string Estado { get; set; } = EstadoCarrito.Activo;
    public DateTime CreadoEn { get; set; }
}

public class ItemCarrito
{
    public int IdItem { get; set; }
    public int IdCarrito { get; set; }
    public int IdProducto { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal => Cantidad * PrecioUnitario;

    // Datos del producto para pintar el carrito
    public string? Codigo { get; set; }
    public string? Nombre { get; set; }
    public int StockDisponible { get; set; }
    public string? Imagen { get; set; }
}

public class CarritoVista
{
    public Carrito Carrito { get; set; } = new();
    public List<ItemCarrito> Items { get; set; } = [];
    public decimal Subtotal { get; set; }
    public decimal PorcentajeIva { get; set; }
    public decimal Iva { get; set; }
    /// <summary>Subtotal + IVA (el envío se calcula al elegir la dirección).</summary>
    public decimal TotalSinEnvio { get; set; }
}

public class Pedido
{
    public int IdPedido { get; set; }
    public string Numero { get; set; } = "";
    public int IdCliente { get; set; }
    public int IdDireccion { get; set; }
    public DateTime Fecha { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Iva { get; set; }
    public decimal CostoEnvio { get; set; }
    public decimal Total { get; set; }
    public string Estado { get; set; } = EstadoPedido.PendientePago;

    // Datos del join (listado del admin)
    public string? ClienteNombre { get; set; }
    public string? ClienteCorreo { get; set; }
}

public class DetallePedido
{
    public int IdDetalle { get; set; }
    public int IdPedido { get; set; }
    public int IdProducto { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }

    public string? CodigoProducto { get; set; }
    public string? NombreProducto { get; set; }
}

public class Pago
{
    public int IdPago { get; set; }
    public int IdPedido { get; set; }
    public string Metodo { get; set; } = MetodoPago.Transferencia;
    public decimal Monto { get; set; }
    public string Estado { get; set; } = EstadoPago.Pendiente;
    public string? ReferenciaExterna { get; set; }
    public string? RutaComprobante { get; set; }
    public DateTime? FechaPago { get; set; }
}

public class Entrega
{
    public int IdEntrega { get; set; }
    public int IdPedido { get; set; }
    public string DireccionEntrega { get; set; } = "";
    public DateTime? FechaProgramada { get; set; }
    public DateTime? FechaEntrega { get; set; }
    public string Estado { get; set; } = EstadoEntrega.Programada;
    public string? Observacion { get; set; }
}

public class PedidoDetalleVista
{
    public Pedido Pedido { get; set; } = new();
    public List<DetallePedido> Detalles { get; set; } = [];
    public List<Pago> Pagos { get; set; } = [];
    public Entrega? Entrega { get; set; }
}

public class FiltroPedido
{
    public string? Estado { get; set; }
    public string? Texto { get; set; }      // número de pedido, correo o nombre del cliente
    public int Pagina { get; set; } = 1;
    public int TamanoPagina { get; set; } = 20;
}
