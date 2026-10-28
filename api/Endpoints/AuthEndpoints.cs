using System.Net.Mail;
using System.Text.RegularExpressions;
using Api.Auth;
using Dapper;
using Floravia.Core;
using Floravia.Core.Entidades;
using Npgsql;

namespace Api.Endpoints;

public record RegistroDto(string Correo, string Password, string Cedula, string Nombres, string Apellidos, string Telefono);
public record LoginDto(string Correo, string Password);

public static class AuthEndpoints
{
    private static readonly string HashFalso = BCrypt.Net.BCrypt.HashPassword("no-existe", 12);

    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth").AllowAnonymous();

        g.MapPost("/registro", async (RegistroDto d, NpgsqlDataSource db, TokenService tokens) =>
        {
            var correo = (d.Correo ?? "").Trim().ToLowerInvariant();
            var errores = new Dictionary<string, string[]>();
            if (!MailAddress.TryCreate(correo, out var m) || m.Address != correo) errores["correo"] = ["Correo inválido"];
            if ((d.Password ?? "").Length < 8) errores["password"] = ["Mínimo 8 caracteres"];
            if (!Regex.IsMatch(d.Cedula ?? "", @"^\d{10}$")) errores["cedula"] = ["Debe tener 10 dígitos"];
            if (string.IsNullOrWhiteSpace(d.Nombres)) errores["nombres"] = ["Requerido"];
            if (string.IsNullOrWhiteSpace(d.Apellidos)) errores["apellidos"] = ["Requerido"];
            if (string.IsNullOrWhiteSpace(d.Telefono)) errores["telefono"] = ["Requerido"];
            if (errores.Count > 0) return Results.ValidationProblem(errores);

            var hash = BCrypt.Net.BCrypt.HashPassword(d.Password, 12);
            await using var conn = await db.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();
            try
            {
                var idUsuario = await conn.ExecuteScalarAsync<int>(
                    "INSERT INTO usuario (correo, password_hash, rol) VALUES (@correo, @hash, 'CLIENTE') RETURNING id_usuario",
                    new { correo, hash }, tx);
                var idCliente = await conn.ExecuteScalarAsync<int>(
                    @"INSERT INTO cliente (id_usuario, cedula, nombres, apellidos, telefono)
                      VALUES (@idUsuario, @cedula, @nombres, @apellidos, @telefono) RETURNING id_cliente",
                    new { idUsuario, cedula = d.Cedula, nombres = d.Nombres.Trim(),
                          apellidos = d.Apellidos.Trim(), telefono = d.Telefono.Trim() }, tx);
                await tx.CommitAsync();

                var (token, expira) = tokens.Crear(idUsuario, correo, Roles.Cliente, idCliente);
                return Results.Created("/api/auth/login", new { token, expiraEn = expira, rol = Roles.Cliente });
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { error = "El correo o la cédula ya están registrados" });
            }
        });

        g.MapPost("/login", async (LoginDto d, NpgsqlDataSource db, TokenService tokens, HttpContext ctx) =>
        {
            var correo = (d.Correo ?? "").Trim().ToLowerInvariant();
            await using var conn = await db.OpenConnectionAsync();

            var u = await conn.QuerySingleOrDefaultAsync<Usuario>(
                @"SELECT *, (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado_temporalmente
                  FROM usuario WHERE correo = @correo", new { correo });

            if (u is null)
            {
                BCrypt.Net.BCrypt.Verify(d.Password ?? "", HashFalso);   // iguala tiempos de respuesta
                return Invalidas();
            }
            if (u.BloqueadoTemporalmente)
                return Results.Json(new { error = "Cuenta bloqueada temporalmente. Intenta más tarde." },
                                    statusCode: StatusCodes.Status423Locked);
            if (u.Estado != EstadoRegistro.Activo)
                return Results.Json(new { error = "Cuenta no disponible" }, statusCode: StatusCodes.Status403Forbidden);

            if (!BCrypt.Net.BCrypt.Verify(d.Password ?? "", u.PasswordHash))
            {
                var max = await ParamInt(conn, "MAX_INTENTOS_LOGIN", 5);
                var minutos = await ParamInt(conn, "MINUTOS_BLOQUEO_LOGIN", 15);
                await conn.ExecuteAsync(
                    @"UPDATE usuario SET
                        bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= @max
                                                 THEN NOW() + make_interval(mins => @minutos) ELSE bloqueado_hasta END,
                        intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= @max THEN 0 ELSE intentos_fallidos + 1 END
                      WHERE id_usuario = @id", new { max, minutos, id = u.IdUsuario });
                await Auditar(conn, u.IdUsuario, "LOGIN_FALLIDO", ctx);
                return Invalidas();
            }

            await conn.ExecuteAsync(
                "UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id_usuario = @id",
                new { id = u.IdUsuario });
            int? idCliente = u.Rol == Roles.Cliente
                ? await conn.ExecuteScalarAsync<int?>("SELECT id_cliente FROM cliente WHERE id_usuario = @id", new { id = u.IdUsuario })
                : null;
            await Auditar(conn, u.IdUsuario, "LOGIN", ctx);

            var (token, expira) = tokens.Crear(u.IdUsuario, u.Correo, u.Rol, idCliente);
            return Results.Ok(new { token, expiraEn = expira, rol = u.Rol });
        });
    }

    private static IResult Invalidas() =>
        Results.Json(new { error = "Credenciales inválidas" }, statusCode: StatusCodes.Status401Unauthorized);

    private static async Task<int> ParamInt(NpgsqlConnection c, string clave, int porDefecto) =>
        int.TryParse(await c.ExecuteScalarAsync<string?>("SELECT valor FROM parametro WHERE clave = @clave", new { clave }), out var v)
            ? v : porDefecto;

    private static Task Auditar(NpgsqlConnection c, int idUsuario, string accion, HttpContext ctx) =>
        c.ExecuteAsync(
            "INSERT INTO auditoria (id_usuario, accion, entidad, ip) VALUES (@idUsuario, @accion, 'usuario', @ip)",
            new { idUsuario, accion, ip = ctx.Connection.RemoteIpAddress?.ToString() });
}