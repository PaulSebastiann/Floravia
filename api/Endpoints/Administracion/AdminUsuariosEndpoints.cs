using System.Security.Claims;
using Api.Auth;
using Floravia.Application;
using Floravia.Core;

namespace Api.Endpoints.Administracion;

public record EstadoUsuarioDto(string Estado);
public record NuevoAdminDto(string Correo, string Password, string Nombres, string Apellidos, string? Cargo);

/// <summary>Dashboard, clientes y cuentas de administrador.</summary>
public static class AdminUsuariosEndpoints
{
    public static void MapAdminUsuarios(this RouteGroupBuilder admin)
    {
        admin.MapGet("/dashboard", async (int? dias, int? top, FloraviaServicios s) =>
            Results.Ok(await s.Dashboard.ObtenerAsync(Math.Clamp(dias ?? 30, 1, 366), top ?? 5)))
            .WithTags("Admin · Dashboard");

        var g = admin.MapGroup("").WithTags("Admin · Usuarios");

        g.MapGet("/clientes", async (string? texto, int? pagina, int? tamano, FloraviaServicios s) =>
            Results.Ok(await s.Usuarios.ListarClientesAsync(
                string.IsNullOrWhiteSpace(texto) ? null : texto.Trim(), Math.Max(1, pagina ?? 1), Math.Clamp(tamano ?? 20, 1, 100))));

        g.MapGet("/clientes/{id:int}", async (int id, FloraviaServicios s) =>
            await s.Usuarios.ObtenerClienteAsync(id) is { } c ? Results.Ok(c) : Results.NotFound());

        // Activar / inactivar / bloquear una cuenta. Un admin no puede modificar la suya (evita quedarse fuera).
        g.MapPut("/usuarios/{idUsuario:int}/estado", async (int idUsuario, EstadoUsuarioDto d, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            if (idUsuario == u.IdUsuario())
                throw new ReglaNegocioException("No puedes cambiar el estado de tu propia cuenta.");
            await s.Usuarios.CambiarEstadoUsuarioAsync(idUsuario, d.Estado);
            return Results.NoContent();
        });

        g.MapPost("/administradores", async (NuevoAdminDto d, FloraviaServicios s) =>
        {
            var a = await s.Usuarios.CrearAdministradorAsync(d.Correo, d.Password, d.Nombres, d.Apellidos, d.Cargo);
            return Results.Created($"/api/admin/administradores/{a.IdAdmin}", new { a.IdAdmin, a.IdUsuario, a.Nombres, a.Apellidos, a.Cargo });
        });
    }
}
