namespace Floravia.Core;

/// <summary>Dónde se guardan físicamente las imágenes. La base de datos solo guarda la ruta relativa.</summary>
public interface IAlmacenArchivos
{
    /// <summary>Guarda el archivo y devuelve su ruta relativa (con "/"), por ejemplo "productos/5/abc.jpg".</summary>
    Task<string> GuardarAsync(string carpeta, string nombreArchivo, Stream contenido);
    Task EliminarAsync(string rutaRelativa);
}
