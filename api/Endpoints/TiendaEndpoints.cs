using Api.Servicios;
using Floravia.Application;

namespace Api.Endpoints;

/// <summary>Catálogo público: categorías, colores, zonas de entrega y productos (solo activos).</summary>
public static class TiendaEndpoints
{
    public static void MapTienda(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api").AllowAnonymous().WithTags("Catálogo");

        g.MapGet("/categorias", async (FloraviaServicios s) => Results.Ok(await s.Catalogo.ListarCategoriasAsync()));

        g.MapGet("/colores", async (FloraviaServicios s) => Results.Ok(await s.Catalogo.ListarColoresAsync()));

        g.MapGet("/zonas-entrega", async (FloraviaServicios s) => Results.Ok(await s.Direcciones.ListarZonasAsync()));

        g.MapGet("/productos", async ([AsParameters] ProductosQuery q, FloraviaServicios s) =>
            Results.Ok(Mapeos.Publico(await s.Catalogo.ListarProductosAsync(Mapeos.Filtro(q)))));

        g.MapGet("/productos/facetas", async ([AsParameters] ProductosQuery q, FloraviaServicios s) =>
            Results.Ok(await s.Catalogo.ListarFacetasAsync(Mapeos.Filtro(q))));

        g.MapGet("/productos/novedades", async (int? cantidad, FloraviaServicios s) =>
            Results.Ok((await s.Catalogo.ListarNovedadesAsync(cantidad ?? 8)).Select(Mapeos.Publico)));

        g.MapGet("/productos/{id:int}", async (int id, FloraviaServicios s) =>
            await s.Catalogo.ObtenerDetalleAsync(id) is { } d ? Results.Ok(Mapeos.Publico(d)) : Results.NotFound());

        g.MapGet("/productos/codigo/{codigo}", async (string codigo, FloraviaServicios s) =>
            await s.Catalogo.ObtenerDetallePorCodigoAsync(codigo) is { } d ? Results.Ok(Mapeos.Publico(d)) : Results.NotFound());

        g.MapGet("/productos/{id:int}/relacionados", async (int id, int? cantidad, FloraviaServicios s) =>
            Results.Ok((await s.Catalogo.ListarRelacionadosAsync(id, cantidad ?? 4)).Select(Mapeos.Publico)));
    }
}
