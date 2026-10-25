using System.Security.Cryptography;
using System.Text;
using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Tienda;

public sealed record RegistroCliente(
    string Correo, string Password, string Cedula, string Nombres, string Apellidos, string Telefono);

/// <summary>Datos de quien inició sesión. La capa API los usará para emitir el token (JWT, cookie, etc.).</summary>
public sealed record SesionUsuario(int IdUsuario, string Correo, string Rol, int? IdCliente, int? IdAdmin, string Nombre);

/// <summary>Registro, inicio de sesión, recuperación de contraseña y perfil del cliente.</summary>
public sealed class CuentaMD(
    Db db, UsuarioDP usuarios, ClienteDP clientes, AdministradorDP administradores,
    AuditoriaDP auditoria, ParametrosMD parametros)
{
    private const int MinutosValidezToken = 60;
    private const string MensajeCredenciales = "Correo o contraseña incorrectos.";

    public async Task<Cliente> RegistrarClienteAsync(RegistroCliente r)
    {
        var correo = Validar.Correo(r.Correo);
        Validar.Password(r.Password);
        var cedula = Validar.Cedula(r.Cedula);
        var nombres = Validar.Texto(r.Nombres, "Los nombres", 100);
        var apellidos = Validar.Texto(r.Apellidos, "Los apellidos", 100);
        var telefono = Validar.Texto(r.Telefono, "El teléfono", 20);
        var hash = BCrypt.Net.BCrypt.HashPassword(r.Password);

        try
        {
            return await db.TransaccionAsync(async () =>
            {
                var idUsuario = await usuarios.InsertarAsync(new Usuario { Correo = correo, PasswordHash = hash, Rol = Roles.Cliente });
                var idCliente = await clientes.InsertarAsync(new Cliente
                {
                    IdUsuario = idUsuario, Cedula = cedula, Nombres = nombres, Apellidos = apellidos, Telefono = telefono,
                });
                await auditoria.RegistrarAsync(idUsuario, "REGISTRO_CLIENTE", "cliente", idCliente.ToString());
                return (await clientes.ObtenerAsync(idCliente))!;
            });
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException(Db.Restriccion(e) switch
            {
                "uq_usuario_correo" => "Ese correo ya está registrado.",
                "uq_cliente_cedula" => "Esa cédula ya está registrada.",
                _ => "Ya existe una cuenta con esos datos.",
            });
        }
    }

    public async Task<SesionUsuario> IniciarSesionAsync(string correo, string password, string? ip = null)
    {
        var usuario = await usuarios.ObtenerPorCorreoAsync((correo ?? "").Trim().ToLowerInvariant());
        if (usuario is null) throw new ReglaNegocioException(MensajeCredenciales);

        if (usuario.Estado != EstadoRegistro.Activo)
            throw new ReglaNegocioException("La cuenta no está activa. Contacta con la tienda.");
        if (usuario.BloqueadoTemporalmente)
            throw new ReglaNegocioException("Cuenta bloqueada temporalmente por demasiados intentos. Inténtalo más tarde.");

        if (!BCrypt.Net.BCrypt.Verify(password ?? "", usuario.PasswordHash))
        {
            await usuarios.RegistrarIntentoFallidoAsync(
                usuario.IdUsuario, await parametros.MaxIntentosLoginAsync(), await parametros.MinutosBloqueoLoginAsync());
            await auditoria.RegistrarAsync(usuario.IdUsuario, "LOGIN_FALLIDO", "usuario", usuario.IdUsuario.ToString(), ip);
            throw new ReglaNegocioException(MensajeCredenciales);
        }

        await usuarios.RegistrarAccesoExitosoAsync(usuario.IdUsuario);
        await auditoria.RegistrarAsync(usuario.IdUsuario, "LOGIN_OK", "usuario", usuario.IdUsuario.ToString(), ip);

        if (usuario.Rol == Roles.Admin)
        {
            var admin = await administradores.ObtenerPorUsuarioAsync(usuario.IdUsuario);
            return new SesionUsuario(usuario.IdUsuario, usuario.Correo, usuario.Rol, null, admin?.IdAdmin,
                admin is null ? usuario.Correo : $"{admin.Nombres} {admin.Apellidos}");
        }

        var cliente = await clientes.ObtenerPorUsuarioAsync(usuario.IdUsuario);
        return new SesionUsuario(usuario.IdUsuario, usuario.Correo, usuario.Rol, cliente?.IdCliente, null,
            cliente is null ? usuario.Correo : $"{cliente.Nombres} {cliente.Apellidos}");
    }

    public async Task CambiarPasswordAsync(int idUsuario, string passwordActual, string passwordNueva)
    {
        var usuario = await usuarios.ObtenerAsync(idUsuario) ?? throw new NoEncontradoException("Usuario no encontrado.");
        if (!BCrypt.Net.BCrypt.Verify(passwordActual ?? "", usuario.PasswordHash))
            throw new ReglaNegocioException("La contraseña actual no es correcta.");
        Validar.Password(passwordNueva);
        await usuarios.CambiarPasswordAsync(idUsuario, BCrypt.Net.BCrypt.HashPassword(passwordNueva));
        await auditoria.RegistrarAsync(idUsuario, "CAMBIO_PASSWORD", "usuario", idUsuario.ToString());
    }

    // ---------- Recuperación de contraseña (el correo lo envía la capa API) ----------

    /// <summary>
    /// Genera un token de un solo uso (válido 60 min) y devuelve el texto que va en el enlace del correo.
    /// Devuelve null si el correo no existe: la API debe responder igual en ambos casos para no revelar cuentas.
    /// </summary>
    public async Task<string?> SolicitarRecuperacionAsync(string correo, string? ip = null)
    {
        var usuario = await usuarios.ObtenerPorCorreoAsync((correo ?? "").Trim().ToLowerInvariant());
        if (usuario is null || usuario.Estado != EstadoRegistro.Activo) return null;

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        await db.TransaccionAsync(async () =>
        {
            await usuarios.InvalidarTokensPendientesAsync(usuario.IdUsuario);
            await usuarios.InsertarTokenAsync(usuario.IdUsuario, Hash(token), MinutosValidezToken);
            await auditoria.RegistrarAsync(usuario.IdUsuario, "SOLICITUD_RECUPERACION", "usuario", usuario.IdUsuario.ToString(), ip);
        });
        return token;
    }

    public async Task RestablecerPasswordAsync(string token, string passwordNueva)
    {
        Validar.Password(passwordNueva);
        var hashNuevo = BCrypt.Net.BCrypt.HashPassword(passwordNueva);

        await db.TransaccionAsync(async () =>
        {
            var registro = await usuarios.ObtenerTokenVigenteAsync(Hash(token ?? ""))
                ?? throw new ReglaNegocioException("El enlace no es válido o ya expiró. Solicita uno nuevo.");
            await usuarios.CambiarPasswordAsync(registro.IdUsuario, hashNuevo);
            await usuarios.MarcarTokenUsadoAsync(registro.IdToken);
            await auditoria.RegistrarAsync(registro.IdUsuario, "RESTABLECER_PASSWORD", "usuario", registro.IdUsuario.ToString());
        });
    }

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    // ---------- Perfil ----------

    public Task<Cliente?> ObtenerPerfilAsync(int idCliente) => clientes.ObtenerAsync(idCliente);

    public async Task<Cliente> ActualizarPerfilAsync(int idCliente, string nombres, string apellidos, string telefono)
    {
        var cliente = await clientes.ObtenerAsync(idCliente) ?? throw new NoEncontradoException("Cliente no encontrado.");
        cliente.Nombres = Validar.Texto(nombres, "Los nombres", 100);
        cliente.Apellidos = Validar.Texto(apellidos, "Los apellidos", 100);
        cliente.Telefono = Validar.Texto(telefono, "El teléfono", 20);
        await clientes.ActualizarAsync(cliente);
        return (await clientes.ObtenerAsync(idCliente))!;
    }
}
