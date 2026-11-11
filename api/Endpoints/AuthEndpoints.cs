using System.Net;
using System.Security.Claims;
using Api.Auth;
using Api.Servicios;
using Floravia.Application;
using Floravia.Application.MD.Tienda;
using Floravia.Core;

namespace Api.Endpoints;

public record RegistroDto(string Correo, string Password, string Cedula, string Nombres, string Apellidos, string Telefono);
public record LoginDto(string Correo, string Password);
public record RecuperarDto(string Correo);
public record RestablecerDto(string Token, string Password);
public record CambiarPasswordDto(string PasswordActual, string PasswordNueva);
public record SesionDto(string Token, DateTime ExpiraEn, string Rol, string Nombre);

/// <summary>Registro, login, recuperación y cambio de contraseña. Toda la lógica vive en CuentaMD.</summary>
public static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        // Rutas públicas con límite estricto de intentos por IP (frena la fuerza bruta).
        var publico = app.MapGroup("/api/auth").AllowAnonymous().RequireRateLimiting("estricta").WithTags("Autenticación");

        publico.MapPost("/registro", async (RegistroDto d, FloraviaServicios s, TokenService tokens) =>
        {
            var cliente = await s.Cuenta.RegistrarClienteAsync(
                new RegistroCliente(d.Correo, d.Password, d.Cedula, d.Nombres, d.Apellidos, d.Telefono));
            var (token, expira) = tokens.Crear(cliente.IdUsuario, Validar.Correo(d.Correo), Roles.Cliente, cliente.IdCliente);
            return Results.Created("/api/auth/me",
                new SesionDto(token, expira, Roles.Cliente, $"{cliente.Nombres} {cliente.Apellidos}"));
        });

        publico.MapPost("/login", async (LoginDto d, FloraviaServicios s, TokenService tokens, HttpContext ctx) =>
        {
            try
            {
                var sesion = await s.Cuenta.IniciarSesionAsync(d.Correo, d.Password, ctx.Connection.RemoteIpAddress?.ToString());
                var (token, expira) = tokens.Crear(sesion.IdUsuario, sesion.Correo, sesion.Rol, sesion.IdCliente, sesion.IdAdmin);
                return Results.Ok(new SesionDto(token, expira, sesion.Rol, sesion.Nombre));
            }
            catch (ReglaNegocioException e)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "No se pudo iniciar sesión", detail: e.Message);
            }
        });

        // Responde SIEMPRE lo mismo exista o no el correo: no se puede usar para averiguar quién tiene cuenta.
        publico.MapPost("/recuperar", async (
            RecuperarDto d, FloraviaServicios s, IServicioCorreo correo, IConfiguration cfg,
            HttpContext ctx, ILogger<Program> log, CancellationToken ct) =>
        {
            var destino = (d.Correo ?? "").Trim();
            var token = await s.Cuenta.SolicitarRecuperacionAsync(destino, ctx.Connection.RemoteIpAddress?.ToString());
            if (token is not null)
            {
                var enlace = $"{(cfg["Frontend:Url"] ?? "http://localhost:5173").TrimEnd('/')}/restablecer?token={WebUtility.UrlEncode(token)}";
                var cuerpo = $"<p>Recibimos una solicitud para restablecer tu contraseña de Floravia.</p>" +
                             $"<p><a href=\"{enlace}\">Crear una contraseña nueva</a></p>" +
                             "<p>El enlace vence en 1 hora. Si no fuiste tú, ignora este mensaje.</p>";
                try { await correo.EnviarAsync(destino, "Recupera tu contraseña de Floravia", cuerpo, ct); }
                catch (Exception e) { log.LogError(e, "No se pudo enviar el correo de recuperación."); }
            }
            return Results.Accepted(value: new { mensaje = "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña." });
        });

        publico.MapPost("/restablecer", async (RestablecerDto d, FloraviaServicios s) =>
        {
            await s.Cuenta.RestablecerPasswordAsync(d.Token, d.Password);
            return Results.Ok(new { mensaje = "Contraseña actualizada. Ya puedes iniciar sesión." });
        });

        // Estas dos exigen sesión (por eso NO están en el grupo anónimo).
        app.MapGet("/api/auth/me", (ClaimsPrincipal u) => Results.Ok(new
        {
            idUsuario = u.IdUsuario(),
            correo = u.FindFirst("email")?.Value,
            rol = u.FindFirst("role")?.Value,
            idCliente = u.IdClienteOpcional(),
            esAdmin = u.IsInRole(Roles.Admin),
        })).WithTags("Autenticación");

        app.MapPost("/api/auth/cambiar-password", async (CambiarPasswordDto d, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            await s.Cuenta.CambiarPasswordAsync(u.IdUsuario(), d.PasswordActual, d.PasswordNueva);
            return Results.NoContent();
        }).RequireRateLimiting("estricta").WithTags("Autenticación");
    }
}
