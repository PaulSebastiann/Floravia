namespace Api.Endpoints.Administracion;

/// <summary>
/// TODO el panel de administración cuelga de este único grupo (/api/admin) protegido con la política "Admin":
/// ninguna ruta puede quedar pública por descuido, porque no se declara la seguridad endpoint por endpoint.
/// </summary>
public static class AdminEndpoints
{
    public static void MapAdmin(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization("Admin");

        admin.MapAdminProductos();
        admin.MapAdminInventario();
        admin.MapAdminPedidos();
        admin.MapAdminConfiguracion();
        admin.MapAdminUsuarios();
    }
}
