using Floravia.Core;
using Floravia.Core.Entidades;

namespace Api.Archivos;

/// <summary>
/// Guarda los comprobantes de transferencia. A diferencia de las fotos de productos, estos archivos son PRIVADOS:
/// viven en otra carpeta que no se sirve como estática y solo se descargan con sesión (el cliente dueño o un admin).
/// </summary>
public sealed class ComprobanteStore
{
    public const long TamanoMaximoBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly Dictionary<string, string> Tipos = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
        [".webp"] = "image/webp", [".pdf"] = "application/pdf",
    };

    private readonly string _raiz;

    public ComprobanteStore(string raiz)
    {
        _raiz = Path.GetFullPath(raiz);
        Directory.CreateDirectory(_raiz);
    }

    /// <summary>Valida (extensión, tamaño y contenido real), guarda con un nombre generado y devuelve la ruta relativa.</summary>
    public async Task<string> GuardarAsync(int idPedido, IFormFile? archivo, CancellationToken ct)
    {
        if (archivo is null || archivo.Length == 0)
            throw new ReglaNegocioException("Adjunta el comprobante de la transferencia (campo «comprobante»).");
        if (archivo.Length > TamanoMaximoBytes)
            throw new ReglaNegocioException("El comprobante supera el máximo de 5 MB.");

        var extension = Path.GetExtension(archivo.FileName ?? "").ToLowerInvariant();
        if (!Tipos.ContainsKey(extension))
            throw new ReglaNegocioException("Formato no permitido. Usa JPG, PNG, WEBP o PDF.");

        byte[] bytes;
        await using (var origen = archivo.OpenReadStream())
        using (var memoria = new MemoryStream())
        {
            await origen.CopyToAsync(memoria, ct);
            bytes = memoria.ToArray();
        }
        if (!FirmaValida(bytes, extension))
            throw new ReglaNegocioException("El archivo no es un comprobante válido.");

        // El nombre original del usuario nunca se usa: se genera uno propio.
        var relativa = $"pedidos/{idPedido}/{Guid.NewGuid():N}{(extension == ".jpeg" ? ".jpg" : extension)}";
        var destino = Resolver(relativa);
        Directory.CreateDirectory(Path.GetDirectoryName(destino)!);
        await File.WriteAllBytesAsync(destino, bytes, ct);
        return relativa;
    }

    public void Eliminar(string relativa)
    {
        var destino = Resolver(relativa);
        if (File.Exists(destino)) File.Delete(destino);
    }

    /// <summary>Responde con el archivo del pago indicado (404 si el pago no existe o no tiene comprobante).</summary>
    public IResult Responder(PedidoDetalleVista pedido, int idPago)
    {
        var ruta = pedido.Pagos.FirstOrDefault(p => p.IdPago == idPago)?.RutaComprobante;
        if (string.IsNullOrEmpty(ruta)) return Results.NotFound();

        var destino = Resolver(ruta);
        if (!File.Exists(destino)) return Results.NotFound();

        var tipo = Tipos.GetValueOrDefault(Path.GetExtension(destino), "application/octet-stream");
        var flujo = new FileStream(destino, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
        return Results.File(flujo, tipo);
    }

    /// <summary>Evita que una ruta con ".." salga de la carpeta raíz.</summary>
    private string Resolver(string relativa)
    {
        var completa = Path.GetFullPath(Path.Combine(_raiz, relativa));
        if (!completa.StartsWith(_raiz + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new ReglaNegocioException("Ruta de archivo no permitida.");
        return completa;
    }

    private static bool FirmaValida(byte[] b, string extension) => extension switch
    {
        ".jpg" or ".jpeg" => b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF,
        ".png" => b.Length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                  && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A,
        ".webp" => b.Length > 12 && b[0] == (byte)'R' && b[1] == (byte)'I' && b[2] == (byte)'F' && b[3] == (byte)'F'
                   && b[8] == (byte)'W' && b[9] == (byte)'E' && b[10] == (byte)'B' && b[11] == (byte)'P',
        ".pdf" => b.Length > 4 && b[0] == 0x25 && b[1] == 0x50 && b[2] == 0x44 && b[3] == 0x46, // %PDF
        _ => false,
    };
}
