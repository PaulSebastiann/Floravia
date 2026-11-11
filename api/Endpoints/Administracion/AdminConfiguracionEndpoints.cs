using Floravia.Application;

namespace Api.Endpoints.Administracion;

public record CategoriaDto(string Nombre, string? Descripcion, int? IdCategoriaPadre);
public record ColorDto(string Nombre, string? CodigoHex);
public record ZonaDto(string Sector, decimal CostoEnvio, bool? Activa);
public record ProveedorDto(string Nombre, string? Ruc, string? Telefono);
public record ParametroDto(string Valor);

/// <summary>Datos maestros: categorías, colores, zonas de entrega, proveedores y parámetros (IVA, minutos de reserva...).</summary>
public static class AdminConfiguracionEndpoints
{
    public static void MapAdminConfiguracion(this RouteGroupBuilder admin)
    {
        // ----- Categorías -----
        var cat = admin.MapGroup("/categorias").WithTags("Admin · Configuración");
        cat.MapGet("/", async (FloraviaServicios s) => Results.Ok(await s.CategoriasYColores.ListarCategoriasAsync()));
        cat.MapPost("/", async (CategoriaDto d, FloraviaServicios s) =>
        {
            var c = await s.CategoriasYColores.CrearCategoriaAsync(d.Nombre, d.Descripcion, d.IdCategoriaPadre);
            return Results.Created($"/api/admin/categorias/{c.IdCategoria}", c);
        });
        cat.MapPut("/{id:int}", async (int id, CategoriaDto d, FloraviaServicios s) =>
            Results.Ok(await s.CategoriasYColores.ActualizarCategoriaAsync(id, d.Nombre, d.Descripcion, d.IdCategoriaPadre)));
        cat.MapDelete("/{id:int}", async (int id, FloraviaServicios s) =>
        {
            await s.CategoriasYColores.EliminarCategoriaAsync(id);
            return Results.NoContent();
        });

        // ----- Colores -----
        var col = admin.MapGroup("/colores").WithTags("Admin · Configuración");
        col.MapGet("/", async (FloraviaServicios s) => Results.Ok(await s.CategoriasYColores.ListarColoresAsync()));
        col.MapPost("/", async (ColorDto d, FloraviaServicios s) =>
        {
            var c = await s.CategoriasYColores.CrearColorAsync(d.Nombre, d.CodigoHex);
            return Results.Created($"/api/admin/colores/{c.IdColor}", c);
        });
        col.MapPut("/{id:int}", async (int id, ColorDto d, FloraviaServicios s) =>
            Results.Ok(await s.CategoriasYColores.ActualizarColorAsync(id, d.Nombre, d.CodigoHex)));
        col.MapDelete("/{id:int}", async (int id, FloraviaServicios s) =>
        {
            await s.CategoriasYColores.EliminarColorAsync(id);
            return Results.NoContent();
        });

        // ----- Zonas de entrega -----
        var zon = admin.MapGroup("/zonas-entrega").WithTags("Admin · Configuración");
        zon.MapGet("/", async (FloraviaServicios s) => Results.Ok(await s.Configuracion.ListarZonasAsync()));
        zon.MapPost("/", async (ZonaDto d, FloraviaServicios s) =>
        {
            var z = await s.Configuracion.CrearZonaAsync(d.Sector, d.CostoEnvio, d.Activa ?? true);
            return Results.Created($"/api/admin/zonas-entrega/{z.IdZona}", z);
        });
        zon.MapPut("/{id:int}", async (int id, ZonaDto d, FloraviaServicios s) =>
            Results.Ok(await s.Configuracion.ActualizarZonaAsync(id, d.Sector, d.CostoEnvio, d.Activa ?? true)));
        zon.MapDelete("/{id:int}", async (int id, FloraviaServicios s) =>
        {
            await s.Configuracion.EliminarZonaAsync(id);
            return Results.NoContent();
        });

        // ----- Proveedores -----
        var prov = admin.MapGroup("/proveedores").WithTags("Admin · Configuración");
        prov.MapGet("/", async (FloraviaServicios s) => Results.Ok(await s.Configuracion.ListarProveedoresAsync()));
        prov.MapPost("/", async (ProveedorDto d, FloraviaServicios s) =>
        {
            var p = await s.Configuracion.CrearProveedorAsync(d.Nombre, d.Ruc, d.Telefono);
            return Results.Created($"/api/admin/proveedores/{p.IdProveedor}", p);
        });
        prov.MapPut("/{id:int}", async (int id, ProveedorDto d, FloraviaServicios s) =>
            Results.Ok(await s.Configuracion.ActualizarProveedorAsync(id, d.Nombre, d.Ruc, d.Telefono)));
        prov.MapDelete("/{id:int}", async (int id, FloraviaServicios s) =>
        {
            await s.Configuracion.EliminarProveedorAsync(id);
            return Results.NoContent();
        });

        // ----- Parámetros del sistema -----
        var par = admin.MapGroup("/parametros").WithTags("Admin · Configuración");
        par.MapGet("/", async (FloraviaServicios s) => Results.Ok(await s.Parametros.ListarAsync()));
        par.MapPut("/{clave}", async (string clave, ParametroDto d, FloraviaServicios s) =>
        {
            await s.Parametros.ActualizarAsync(clave, d.Valor);
            return Results.Ok(await s.Parametros.ListarAsync());
        });
    }
}
