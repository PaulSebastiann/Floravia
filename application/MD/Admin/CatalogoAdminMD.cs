using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>CRUD de categorías y colores desde /admin.</summary>
public sealed class CatalogoAdminMD(CategoriaDP categorias, ColorDP colores)
{
    // ---------- Categorías ----------

    public Task<List<Categoria>> ListarCategoriasAsync() => categorias.ListarAsync();

    public async Task<Categoria> CrearCategoriaAsync(string nombre, string? descripcion = null, int? idPadre = null)
    {
        var c = new Categoria
        {
            Nombre = Validar.Texto(nombre, "El nombre", 80),
            Descripcion = Validar.TextoOpcional(descripcion, "La descripción", 300),
            IdCategoriaPadre = idPadre,
        };
        try
        {
            var id = await categorias.InsertarAsync(c);
            return (await categorias.ObtenerAsync(id))!;
        }
        catch (Exception e) when (TraducirCategoria(e) is not null)
        {
            throw TraducirCategoria(e)!;
        }
    }

    public async Task<Categoria> ActualizarCategoriaAsync(int idCategoria, string nombre, string? descripcion, int? idPadre)
    {
        _ = await categorias.ObtenerAsync(idCategoria) ?? throw new NoEncontradoException("Categoría no encontrada.");
        if (idPadre is int padre && (await categorias.IdsDelArbolAsync(idCategoria)).Contains(padre))
            throw new ReglaNegocioException("Una categoría no puede ser hija de sí misma ni de sus subcategorías.");

        var c = new Categoria
        {
            IdCategoria = idCategoria,
            Nombre = Validar.Texto(nombre, "El nombre", 80),
            Descripcion = Validar.TextoOpcional(descripcion, "La descripción", 300),
            IdCategoriaPadre = idPadre,
        };
        try
        {
            await categorias.ActualizarAsync(c);
            return (await categorias.ObtenerAsync(idCategoria))!;
        }
        catch (Exception e) when (TraducirCategoria(e) is not null)
        {
            throw TraducirCategoria(e)!;
        }
    }

    public async Task EliminarCategoriaAsync(int idCategoria)
    {
        try
        {
            if (await categorias.EliminarAsync(idCategoria) == 0)
                throw new NoEncontradoException("Categoría no encontrada.");
        }
        catch (Exception e) when (Db.EsViolacionForanea(e))
        {
            throw new ReglaNegocioException("No se puede eliminar: la categoría tiene productos o subcategorías.");
        }
    }

    private static ReglaNegocioException? TraducirCategoria(Exception e) => Db.Restriccion(e) switch
    {
        "uq_categoria_nombre" => new ReglaNegocioException("Ya existe una categoría con ese nombre."),
        "fk_categoria_padre" => new ReglaNegocioException("La categoría padre no existe."),
        _ => null,
    };

    // ---------- Colores ----------

    public Task<List<Color>> ListarColoresAsync() => colores.ListarAsync();

    public async Task<Color> CrearColorAsync(string nombre, string? codigoHex)
    {
        var c = new Color { Nombre = Validar.Texto(nombre, "El nombre", 50), CodigoHex = Validar.ColorHex(codigoHex) };
        try
        {
            var id = await colores.InsertarAsync(c);
            return (await colores.ObtenerAsync(id))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ya existe un color con ese nombre.");
        }
    }

    public async Task<Color> ActualizarColorAsync(int idColor, string nombre, string? codigoHex)
    {
        var c = new Color { IdColor = idColor, Nombre = Validar.Texto(nombre, "El nombre", 50), CodigoHex = Validar.ColorHex(codigoHex) };
        try
        {
            if (await colores.ActualizarAsync(c) == 0) throw new NoEncontradoException("Color no encontrado.");
            return (await colores.ObtenerAsync(idColor))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ya existe un color con ese nombre.");
        }
    }

    public async Task EliminarColorAsync(int idColor)
    {
        try
        {
            if (await colores.EliminarAsync(idColor) == 0) throw new NoEncontradoException("Color no encontrado.");
        }
        catch (Exception e) when (Db.EsViolacionForanea(e))
        {
            throw new ReglaNegocioException("No se puede eliminar: hay productos que usan ese color.");
        }
    }
}
