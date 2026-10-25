using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Tienda;

/// <summary>Consultas públicas del catálogo (lo que ve el cliente en el front). Solo productos activos.</summary>
public sealed class CatalogoMD(ProductoDP productos, CategoriaDP categorias, ColorDP colores, ImagenDP imagenes)
{
    public Task<ResultadoPagina<Producto>> ListarProductosAsync(FiltroProducto filtro)
    {
        filtro.SoloActivos = true; // la tienda nunca muestra productos inactivos
        return productos.BuscarAsync(filtro);
    }

    public async Task<ProductoDetalle?> ObtenerDetalleAsync(int idProducto) =>
        await ArmarDetalleAsync(await productos.ObtenerAsync(idProducto));

    public async Task<ProductoDetalle?> ObtenerDetallePorCodigoAsync(string codigo) =>
        await ArmarDetalleAsync(await productos.ObtenerPorCodigoAsync(codigo));

    private async Task<ProductoDetalle?> ArmarDetalleAsync(Producto? p)
    {
        if (p is null || p.Estado != EstadoRegistro.Activo) return null;
        return new ProductoDetalle
        {
            Producto = p,
            Imagenes = await imagenes.ListarPorProductoAsync(p.IdProducto),
            Colores = await colores.ListarPorProductoAsync(p.IdProducto),
        };
    }

    public Task<List<Producto>> ListarRelacionadosAsync(int idProducto, int cantidad = 4) =>
        productos.RelacionadosAsync(idProducto, Math.Clamp(cantidad, 1, 20));

    /// <summary>Últimos productos agregados que aún tienen stock (portada).</summary>
    public async Task<List<Producto>> ListarNovedadesAsync(int cantidad = 8) =>
        (await productos.BuscarAsync(new FiltroProducto
        {
            Orden = "recientes", SoloConStock = true, TamanoPagina = Math.Clamp(cantidad, 1, 50),
        })).Items;

    public Task<List<Categoria>> ListarCategoriasAsync() => categorias.ListarAsync();

    public Task<List<Color>> ListarColoresAsync() => colores.ListarAsync();
}
