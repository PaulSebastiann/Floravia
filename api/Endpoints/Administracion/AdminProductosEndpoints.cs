using System.Security.Claims;
using Api.Auth;
using Api.Servicios;
using Floravia.Application;
using Floravia.Application.MD.Admin;
using Floravia.Core;
using Floravia.Core.Entidades;

namespace Api.Endpoints.Administracion;

public record ProductoAdminDto(
    int IdCategoria, string Codigo, string Nombre, string? Descripcion, string? Cuidados,
    decimal Precio, int StockMinimo, int? StockInicial, List<int>? IdColores);

public record EstadoProductoDto(bool Activo);
public record ColoresDto(List<int> IdColores);
public record OrdenImagenesDto(List<int> IdImagenes);
public record ImagenAdmin(int IdImagen, int IdProducto, string Ruta, string Url, bool EsPrincipal, int Orden);

/// <summary>Catálogo del admin: productos, colores asignados e imágenes. El stock NO se edita aquí (ver inventario).</summary>
public static class AdminProductosEndpoints
{
    public static void MapAdminProductos(this RouteGroupBuilder admin)
    {
        var g = admin.MapGroup("/productos").WithTags("Admin · Productos");

        g.MapGet("/", async ([AsParameters] ProductosAdminQuery q, FloraviaServicios s) =>
            Results.Ok(await s.Productos.ListarAsync(Mapeos.FiltroAdmin(q), q.IncluirInactivos ?? true)));

        g.MapGet("/{id:int}", async (int id, FloraviaServicios s) =>
            await s.Productos.ObtenerAsync(id) is { } d ? Results.Ok(d) : Results.NotFound());

        g.MapPost("/", async (ProductoAdminDto d, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            var id = await s.Productos.CrearAsync(Datos(d), d.StockInicial ?? 0, d.IdColores, u.IdAdmin());
            return Results.Created($"/api/admin/productos/{id}", await s.Productos.ObtenerAsync(id));
        });

        g.MapPut("/{id:int}", async (int id, ProductoAdminDto d, FloraviaServicios s) =>
        {
            await s.Productos.ActualizarAsync(id, Datos(d), d.IdColores);
            return Results.Ok(await s.Productos.ObtenerAsync(id));
        });

        g.MapPatch("/{id:int}/estado", async (int id, EstadoProductoDto d, FloraviaServicios s) =>
        {
            await s.Productos.CambiarEstadoAsync(id, d.Activo);
            return Results.NoContent();
        });

        g.MapPut("/{id:int}/colores", async (int id, ColoresDto d, FloraviaServicios s) =>
        {
            await s.Productos.AsignarColoresAsync(id, d.IdColores ?? []);
            return Results.NoContent();
        });

        g.MapDelete("/{id:int}", async (int id, FloraviaServicios s) =>
        {
            await s.Productos.EliminarAsync(id);
            return Results.NoContent();
        });

        // ----- Imágenes -----

        g.MapGet("/{id:int}/imagenes", async (int id, FloraviaServicios s) =>
            Results.Ok((await s.Imagenes.ListarAsync(id)).Select(Mapear)));

        // multipart/form-data: campo «archivo» (JPG/PNG/WEBP, máx. 5 MB) y «principal» (true/false, opcional).
        g.MapPost("/{id:int}/imagenes", async (int id, HttpContext ctx, FloraviaServicios s, CancellationToken ct) =>
        {
            if (!ctx.Request.HasFormContentType)
                throw new ReglaNegocioException("Envía la imagen como multipart/form-data (campo «archivo»).");

            var form = await ctx.Request.ReadFormAsync(ct);
            var archivo = form.Files["archivo"] ?? throw new ReglaNegocioException("Adjunta la imagen en el campo «archivo».");
            var esPrincipal = bool.TryParse(form["principal"].ToString(), out var p) && p;

            await using var flujo = archivo.OpenReadStream();
            var imagen = await s.Imagenes.SubirAsync(id, flujo, archivo.FileName, esPrincipal);
            return Results.Created($"/api/admin/productos/{id}/imagenes", Mapear(imagen));
        });

        g.MapPut("/{id:int}/imagenes/orden", async (int id, OrdenImagenesDto d, FloraviaServicios s) =>
        {
            await s.Imagenes.ReordenarAsync(id, d.IdImagenes ?? []);
            return Results.NoContent();
        });

        var imagenes = admin.MapGroup("/imagenes").WithTags("Admin · Productos");

        imagenes.MapPost("/{idImagen:int}/principal", async (int idImagen, FloraviaServicios s) =>
        {
            await s.Imagenes.MarcarPrincipalAsync(idImagen);
            return Results.NoContent();
        });

        imagenes.MapDelete("/{idImagen:int}", async (int idImagen, FloraviaServicios s) =>
        {
            await s.Imagenes.EliminarAsync(idImagen);
            return Results.NoContent();
        });
    }

    private static DatosProducto Datos(ProductoAdminDto d) =>
        new(d.IdCategoria, d.Codigo, d.Nombre, d.Descripcion, d.Cuidados, d.Precio, d.StockMinimo);

    private static ImagenAdmin Mapear(ImagenProducto i) =>
        new(i.IdImagen, i.IdProducto, i.Ruta, Mapeos.PrefijoMedia + i.Ruta, i.EsPrincipal, i.Orden);
}
