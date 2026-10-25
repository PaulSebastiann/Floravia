namespace Floravia.Core.Entidades;

public class Categoria
{
    public int IdCategoria { get; set; }
    public int? IdCategoriaPadre { get; set; }
    public string Nombre { get; set; } = "";
    public string? Descripcion { get; set; }
}

public class Producto
{
    public int IdProducto { get; set; }
    public int IdCategoria { get; set; }
    public string Codigo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string? Descripcion { get; set; }
    public string? Cuidados { get; set; }
    public decimal Precio { get; set; }
    public int Stock { get; set; }
    public int StockReservado { get; set; }
    public int StockMinimo { get; set; }
    public string Estado { get; set; } = EstadoRegistro.Activo;
    public DateTime CreadoEn { get; set; }
    public DateTime ActualizadoEn { get; set; }

    /// <summary>Unidades que realmente se pueden vender ahora.</summary>
    public int StockDisponible => Stock - StockReservado;

    // Datos del join (listados)
    public string? CategoriaNombre { get; set; }
    public string? ImagenPrincipal { get; set; }
}

public class Color
{
    public int IdColor { get; set; }
    public string Nombre { get; set; } = "";
    public string? CodigoHex { get; set; }
}

public class ImagenProducto
{
    public int IdImagen { get; set; }
    public int IdProducto { get; set; }
    public string Ruta { get; set; } = "";
    public bool EsPrincipal { get; set; }
    public int Orden { get; set; }
}

/// <summary>Producto con todo lo que necesita la ficha de detalle.</summary>
public class ProductoDetalle
{
    public Producto Producto { get; set; } = new();
    public List<ImagenProducto> Imagenes { get; set; } = [];
    public List<Color> Colores { get; set; } = [];
}

public class FiltroProducto
{
    public int? IdCategoria { get; set; }          // incluye subcategorías
    public string? Texto { get; set; }             // nombre o código
    public decimal? PrecioMin { get; set; }
    public decimal? PrecioMax { get; set; }
    public int? IdColor { get; set; }
    public bool SoloActivos { get; set; } = true;  // la tienda solo ve activos
    public bool SoloConStock { get; set; }
    public bool StockBajo { get; set; }            // disponible <= stock mínimo
    public string Orden { get; set; } = "recientes"; // recientes | precio_asc | precio_desc | nombre
    public int Pagina { get; set; } = 1;
    public int TamanoPagina { get; set; } = 12;
}

public record ResultadoPagina<T>(List<T> Items, int Total, int Pagina, int TamanoPagina)
{
    public int TotalPaginas => (int)Math.Ceiling(Total / (double)Math.Max(1, TamanoPagina));
}
