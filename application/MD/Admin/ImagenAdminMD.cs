using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>Subida y gestión de las imágenes de cada producto.</summary>
public sealed class ImagenAdminMD(Db db, ImagenDP imagenes, ProductoDP productos, IAlmacenArchivos almacen)
{
    public const long TamanoMaximoBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly string[] Extensiones = [".jpg", ".jpeg", ".png", ".webp"];

    public Task<List<ImagenProducto>> ListarAsync(int idProducto) => imagenes.ListarPorProductoAsync(idProducto);

    /// <summary>
    /// Valida (extensión, tamaño y contenido real del archivo), lo guarda en disco y registra la ruta en la BD.
    /// La primera imagen de un producto es siempre la principal.
    /// </summary>
    public async Task<ImagenProducto> SubirAsync(int idProducto, Stream contenido, string nombreArchivo, bool esPrincipal = false)
    {
        if (await productos.ObtenerAsync(idProducto) is null)
            throw new NoEncontradoException("Producto no encontrado.");

        var extension = Path.GetExtension(nombreArchivo ?? "").ToLowerInvariant();
        if (!Extensiones.Contains(extension))
            throw new ReglaNegocioException("Formato no permitido. Usa JPG, PNG o WEBP.");

        var bytes = await LeerConLimiteAsync(contenido);
        if (!FirmaValida(bytes, extension))
            throw new ReglaNegocioException("El archivo no es una imagen válida.");

        // El nombre original del usuario nunca se usa: se genera uno propio
        var nombre = $"{Guid.NewGuid():N}{(extension == ".jpeg" ? ".jpg" : extension)}";
        string ruta;
        using (var memoria = new MemoryStream(bytes))
            ruta = await almacen.GuardarAsync($"productos/{idProducto}", nombre, memoria);

        try
        {
            return await db.TransaccionAsync(async () =>
            {
                var principal = esPrincipal || await imagenes.ContarAsync(idProducto) == 0;
                if (principal) await imagenes.QuitarPrincipalAsync(idProducto);

                var id = await imagenes.InsertarAsync(new ImagenProducto
                {
                    IdProducto = idProducto,
                    Ruta = ruta,
                    EsPrincipal = principal,
                    Orden = await imagenes.SiguienteOrdenAsync(idProducto),
                });
                return (await imagenes.ObtenerAsync(id))!;
            });
        }
        catch
        {
            await almacen.EliminarAsync(ruta); // no dejar archivos huérfanos si falló la BD
            throw;
        }
    }

    public async Task MarcarPrincipalAsync(int idImagen)
    {
        var imagen = await imagenes.ObtenerAsync(idImagen) ?? throw new NoEncontradoException("Imagen no encontrada.");
        await db.TransaccionAsync(async () =>
        {
            await imagenes.QuitarPrincipalAsync(imagen.IdProducto);
            await imagenes.MarcarPrincipalAsync(idImagen);
        });
    }

    /// <summary>Define el orden de la galería: la lista trae los id de imagen en el orden deseado.</summary>
    public async Task ReordenarAsync(int idProducto, IReadOnlyList<int> idImagenesEnOrden)
    {
        var propias = (await imagenes.ListarPorProductoAsync(idProducto)).Select(i => i.IdImagen).ToHashSet();
        if (idImagenesEnOrden.Any(id => !propias.Contains(id)))
            throw new ReglaNegocioException("Alguna imagen no pertenece a este producto.");

        await db.TransaccionAsync(async () =>
        {
            for (var i = 0; i < idImagenesEnOrden.Count; i++)
                await imagenes.ActualizarOrdenAsync(idImagenesEnOrden[i], i);
        });
    }

    /// <summary>Borra la imagen (BD y archivo). Si era la principal, la siguiente de la galería ocupa su lugar.</summary>
    public async Task EliminarAsync(int idImagen)
    {
        var imagen = await imagenes.ObtenerAsync(idImagen) ?? throw new NoEncontradoException("Imagen no encontrada.");

        await db.TransaccionAsync(async () =>
        {
            await imagenes.EliminarAsync(idImagen);
            if (imagen.EsPrincipal && await imagenes.PrimeraDeProductoAsync(imagen.IdProducto) is int siguiente)
                await imagenes.MarcarPrincipalAsync(siguiente);
        });
        await almacen.EliminarAsync(imagen.Ruta);
    }

    private static async Task<byte[]> LeerConLimiteAsync(Stream contenido)
    {
        using var memoria = new MemoryStream();
        var buffer = new byte[81920];
        int leidos;
        while ((leidos = await contenido.ReadAsync(buffer)) > 0)
        {
            memoria.Write(buffer, 0, leidos);
            if (memoria.Length > TamanoMaximoBytes)
                throw new ReglaNegocioException("La imagen supera el máximo de 5 MB.");
        }
        if (memoria.Length == 0) throw new ReglaNegocioException("El archivo está vacío.");
        return memoria.ToArray();
    }

    /// <summary>Comprueba los primeros bytes del archivo para que no se pueda subir otro tipo de archivo renombrado.</summary>
    private static bool FirmaValida(byte[] b, string extension) => extension switch
    {
        ".jpg" or ".jpeg" => b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF,
        ".png" => b.Length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                  && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A,
        ".webp" => b.Length > 12 && b[0] == (byte)'R' && b[1] == (byte)'I' && b[2] == (byte)'F' && b[3] == (byte)'F'
                   && b[8] == (byte)'W' && b[9] == (byte)'E' && b[10] == (byte)'B' && b[11] == (byte)'P',
        _ => false,
    };
}
