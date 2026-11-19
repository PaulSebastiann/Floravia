using Floravia.Core.Entidades;

namespace Api.Servicios;

/// <summary>Parámetros de búsqueda del catálogo público (?texto=rosa&amp;idCategoria=1&amp;orden=precio_asc&amp;pagina=2...).</summary>
public record ProductosQuery(
    int? IdCategoria, string? Texto, decimal? PrecioMin, decimal? PrecioMax, int? IdColor,
    bool? SoloConStock, string? Orden, int? Pagina, int? TamanoPagina, string[]? Filtro);

/// <summary>Igual que el público, más los filtros propios del panel de administración.</summary>
public record ProductosAdminQuery(
    int? IdCategoria, string? Texto, decimal? PrecioMin, decimal? PrecioMax, int? IdColor,
    bool? SoloConStock, bool? StockBajo, bool? IncluirInactivos, string? Orden, int? Pagina, int? TamanoPagina);

/// <summary>Lo que ve el público de un producto: nunca incluye stock mínimo ni stock reservado.</summary>
public record ProductoPublico(
    int IdProducto, int IdCategoria, string Codigo, string Nombre, string? Descripcion, string? Cuidados,
    decimal Precio, int StockDisponible, string? CategoriaNombre, string? ImagenUrl,
    IReadOnlyDictionary<string, string[]> Atributos);

public record ImagenPublica(int IdImagen, string Url, bool EsPrincipal, int Orden);

public record ProductoDetallePublico(ProductoPublico Producto, List<ImagenPublica> Imagenes, List<Color> Colores);

public record PaginaProductos(List<ProductoPublico> Items, int Total, int Pagina, int TamanoPagina, int TotalPaginas);

/// <summary>Conversión entre entidades del dominio y lo que se expone por la API.</summary>
public static class Mapeos
{
    /// <summary>Las imágenes se sirven como archivos estáticos bajo /media.</summary>
    public const string PrefijoMedia = "/media/";

    public static string? UrlImagen(string? ruta)
    {
        if (string.IsNullOrWhiteSpace(ruta)) return null;
        // Las imágenes del catálogo inicial ya viven en public/images del frontend.
        // Las que sube un administrador son rutas relativas del almacén de la API.
        return ruta.StartsWith('/') ? ruta : PrefijoMedia + ruta;
    }

    public static ProductoPublico Publico(Producto p) => new(
        p.IdProducto, p.IdCategoria, p.Codigo, p.Nombre, p.Descripcion, p.Cuidados,
        p.Precio, p.StockDisponible, p.CategoriaNombre, UrlImagen(p.ImagenPrincipal), AtributosDe(p));

    public static PaginaProductos Publico(ResultadoPagina<Producto> r) => new(
        r.Items.Select(Publico).ToList(), r.Total, r.Pagina, r.TamanoPagina, r.TotalPaginas);

    public static ProductoDetallePublico Publico(ProductoDetalle d) => new(
        Publico(d.Producto),
        d.Imagenes.Select(i => new ImagenPublica(i.IdImagen, UrlImagen(i.Ruta)!, i.EsPrincipal, i.Orden)).ToList(),
        d.Colores);

    public static FiltroProducto Filtro(ProductosQuery q) => new()
    {
        IdCategoria = q.IdCategoria,
        Texto = TextoLimpio(q.Texto),
        PrecioMin = q.PrecioMin,
        PrecioMax = q.PrecioMax,
        IdColor = q.IdColor,
        Atributos = AtributosValidos(q.Filtro),
        SoloConStock = q.SoloConStock ?? false,
        Orden = OrdenValido(q.Orden),
        Pagina = Math.Max(1, q.Pagina ?? 1),
        TamanoPagina = Math.Clamp(q.TamanoPagina ?? 12, 1, 50),
    };

    public static FiltroProducto FiltroAdmin(ProductosAdminQuery q) => new()
    {
        IdCategoria = q.IdCategoria,
        Texto = TextoLimpio(q.Texto),
        PrecioMin = q.PrecioMin,
        PrecioMax = q.PrecioMax,
        IdColor = q.IdColor,
        SoloConStock = q.SoloConStock ?? false,
        StockBajo = q.StockBajo ?? false,
        Orden = OrdenValido(q.Orden),
        Pagina = Math.Max(1, q.Pagina ?? 1),
        TamanoPagina = Math.Clamp(q.TamanoPagina ?? 20, 1, 100),
    };

    private static string? TextoLimpio(string? texto)
    {
        var t = texto?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        return t.Length > 100 ? t[..100] : t;
    }

    private static string OrdenValido(string? orden) =>
        orden is "precio_asc" or "precio_desc" or "nombre" ? orden : "recientes";

    private static readonly IReadOnlyDictionary<string, ISet<string>> ValoresAtributo =
        new Dictionary<string, ISet<string>>(StringComparer.Ordinal)
        {
            ["ocasion"] = new HashSet<string>(["aniversario", "cumpleanos", "amor", "agradecimiento", "condolencias"], StringComparer.Ordinal),
            ["color"] = new HashSet<string>(["rojo", "rosa", "blanco", "amarillo", "naranja", "morado", "multicolor"], StringComparer.Ordinal),
            ["flor"] = new HashSet<string>(["rosas", "girasoles", "lirios", "gerberas", "tulipanes", "mixtas"], StringComparer.Ordinal),
            ["cuidado"] = new HashSet<string>(["facil", "medio", "experto"], StringComparer.Ordinal),
            ["luz"] = new HashSet<string>(["sombra", "luz-indirecta", "sol-directo"], StringComparer.Ordinal),
            ["ubicacion"] = new HashSet<string>(["interior", "exterior", "ambos"], StringComparer.Ordinal),
            ["pet"] = new HashSet<string>(["si"], StringComparer.Ordinal),
            ["cultivo"] = new HashSet<string>(["flores", "huerto", "aromaticas"], StringComparer.Ordinal),
            ["uso"] = new HashSet<string>(["comestible", "ornamental"], StringComparer.Ordinal),
            ["mes"] = new HashSet<string>(Enumerable.Range(1, 12).Select(x => x.ToString()), StringComparer.Ordinal),
        };

    /** Solo acepta la misma taxonomía que la UI: nunca convierte query strings arbitrarios en filtros de BD. */
    private static Dictionary<string, List<string>> AtributosValidos(IEnumerable<string>? filtros)
    {
        var resultado = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var filtro in filtros ?? [])
        {
            var partes = filtro.Split(':', 2, StringSplitOptions.TrimEntries);
            if (partes.Length != 2 || !ValoresAtributo.TryGetValue(partes[0], out var permitidos) || !permitidos.Contains(partes[1])) continue;
            if (!resultado.TryGetValue(partes[0], out var valores)) resultado[partes[0]] = valores = [];
            if (!valores.Contains(partes[1], StringComparer.Ordinal)) valores.Add(partes[1]);
        }
        return resultado;
    }

    private static IReadOnlyDictionary<string, string[]> AtributosDe(Producto p) =>
        p.Atributos
            .Select(a => a.Split(':', 2))
            .Where(a => a.Length == 2 && ValoresAtributo.TryGetValue(a[0], out var permitidos) && permitidos.Contains(a[1]))
            .GroupBy(a => a[0], StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Select(a => a[1]).ToArray(), StringComparer.Ordinal);
}
