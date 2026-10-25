namespace Floravia.Infrastructure;

public sealed class AlmacenLocal : IAlmacenArchivos
{
    private readonly string _raiz;

    public AlmacenLocal(string rutaRaiz)
    {
        _raiz = Path.GetFullPath(rutaRaiz);
        Directory.CreateDirectory(_raiz);
    }

    public async Task<string> GuardarAsync(string carpeta, string nombreArchivo, Stream contenido)
    {
        var relativa = $"{carpeta.Trim('/', '\\')}/{nombreArchivo}";
        var destino = ResolverSeguro(relativa);
        Directory.CreateDirectory(Path.GetDirectoryName(destino)!);
        await using var salida = File.Create(destino);
        await contenido.CopyToAsync(salida);
        return relativa;
    }

    public Task EliminarAsync(string rutaRelativa)
    {
        var destino = ResolverSeguro(rutaRelativa);
        if (File.Exists(destino)) File.Delete(destino);
        return Task.CompletedTask;
    }

    /// <summary>Evita que una ruta con ".." salga de la carpeta raíz.</summary>
    private string ResolverSeguro(string relativa)
    {
        var completa = Path.GetFullPath(Path.Combine(_raiz, relativa));
        if (!completa.StartsWith(_raiz + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new ReglaNegocioException("Ruta de archivo no permitida.");
        return completa;
    }
}
