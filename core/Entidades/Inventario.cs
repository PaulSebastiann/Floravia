namespace Floravia.Core.Entidades;

public class Proveedor
{
    public int IdProveedor { get; set; }
    public string Nombre { get; set; } = "";
    public string? Ruc { get; set; }
    public string? Telefono { get; set; }
}

/// <summary>Una fila del kardex.</summary>
public class MovimientoInventario
{
    public int IdMovimiento { get; set; }
    public int IdProducto { get; set; }
    public int? IdPedido { get; set; }
    public int? IdAdmin { get; set; }
    public int? IdProveedor { get; set; }
    public DateTime Fecha { get; set; }
    public string Tipo { get; set; } = TipoMovimiento.Entrada;
    public int Cantidad { get; set; }
    public decimal? CostoUnitario { get; set; }
    public int Saldo { get; set; }
    public string? Motivo { get; set; }

    public string? ProductoNombre { get; set; }
    public string? ProveedorNombre { get; set; }
}

public class ReservaStock
{
    public int IdReserva { get; set; }
    public int IdPedido { get; set; }
    public int IdProducto { get; set; }
    public int Cantidad { get; set; }
    public DateTime ExpiraEn { get; set; }
    public string Estado { get; set; } = EstadoReserva.Activa;
}
