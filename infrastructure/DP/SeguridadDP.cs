using Floravia.Core.Entidades;

namespace Floravia.Infrastructure.DP;

public sealed class UsuarioDP(Db db)
{
    private const string Cols = """
        id_usuario, correo, password_hash, rol, estado, intentos_fallidos, bloqueado_hasta, ultimo_acceso, creado_en,
        (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado_temporalmente
        """;

    public Task<Usuario?> ObtenerAsync(int id) =>
        db.UnoAsync<Usuario>($"SELECT {Cols} FROM usuario WHERE id_usuario = @id", new { id });

    public Task<Usuario?> ObtenerPorCorreoAsync(string correo) =>
        db.UnoAsync<Usuario>($"SELECT {Cols} FROM usuario WHERE correo = @correo", new { correo });

    public Task<int> InsertarAsync(Usuario u) =>
        db.EscalarAsync<int>("""
            INSERT INTO usuario (correo, password_hash, rol, estado)
            VALUES (@Correo, @PasswordHash, @Rol, @Estado)
            RETURNING id_usuario
            """, u);

    public Task<int> CambiarPasswordAsync(int id, string hash) =>
        db.EjecutarAsync("""
            UPDATE usuario SET password_hash = @hash, intentos_fallidos = 0, bloqueado_hasta = NULL
             WHERE id_usuario = @id
            """, new { id, hash });

    public Task<int> CambiarEstadoAsync(int id, string estado) =>
        db.EjecutarAsync("UPDATE usuario SET estado = @estado WHERE id_usuario = @id", new { id, estado });

    /// <summary>Suma un intento fallido y, si llega al máximo, bloquea la cuenta unos minutos (RN de seguridad).</summary>
    public Task<int> RegistrarIntentoFallidoAsync(int id, int maxIntentos, int minutosBloqueo) =>
        db.EjecutarAsync("""
            UPDATE usuario
               SET intentos_fallidos = intentos_fallidos + 1,
                   bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= @maxIntentos
                                          THEN NOW() + make_interval(mins => @minutosBloqueo)
                                          ELSE bloqueado_hasta END
             WHERE id_usuario = @id
            """, new { id, maxIntentos, minutosBloqueo });

    public Task<int> RegistrarAccesoExitosoAsync(int id) =>
        db.EjecutarAsync("""
            UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW()
             WHERE id_usuario = @id
            """, new { id });

    // ----- Token de recuperación de contraseña (solo se guarda el hash) -----

    public Task<int> InsertarTokenAsync(int idUsuario, string tokenHash, int minutosValidez) =>
        db.EscalarAsync<int>("""
            INSERT INTO token_recuperacion (id_usuario, token_hash, expira_en)
            VALUES (@idUsuario, @tokenHash, NOW() + make_interval(mins => @minutosValidez))
            RETURNING id_token
            """, new { idUsuario, tokenHash, minutosValidez });

    /// <summary>Token que existe, no se ha usado y no ha expirado.</summary>
    public Task<TokenRecuperacion?> ObtenerTokenVigenteAsync(string tokenHash) =>
        db.UnoAsync<TokenRecuperacion>("""
            SELECT id_token, id_usuario, token_hash, expira_en, usado_en, creado_en
              FROM token_recuperacion
             WHERE token_hash = @tokenHash AND usado_en IS NULL AND expira_en > NOW()
            """, new { tokenHash });

    public Task<int> MarcarTokenUsadoAsync(int idToken) =>
        db.EjecutarAsync("UPDATE token_recuperacion SET usado_en = NOW() WHERE id_token = @idToken", new { idToken });

    /// <summary>Invalida los tokens anteriores sin usar al pedir uno nuevo.</summary>
    public Task<int> InvalidarTokensPendientesAsync(int idUsuario) =>
        db.EjecutarAsync(
            "UPDATE token_recuperacion SET usado_en = NOW() WHERE id_usuario = @idUsuario AND usado_en IS NULL", new { idUsuario });
}

public sealed class ClienteDP(Db db)
{
    private const string Cols = "c.id_cliente, c.id_usuario, c.cedula, c.nombres, c.apellidos, c.telefono, u.correo, u.estado AS estado_usuario";
    private const string Desde = "FROM cliente c JOIN usuario u ON u.id_usuario = c.id_usuario";

    public Task<Cliente?> ObtenerAsync(int idCliente) =>
        db.UnoAsync<Cliente>($"SELECT {Cols} {Desde} WHERE c.id_cliente = @idCliente", new { idCliente });

    public Task<Cliente?> ObtenerPorUsuarioAsync(int idUsuario) =>
        db.UnoAsync<Cliente>($"SELECT {Cols} {Desde} WHERE c.id_usuario = @idUsuario", new { idUsuario });

    public Task<int> InsertarAsync(Cliente c) =>
        db.EscalarAsync<int>("""
            INSERT INTO cliente (id_usuario, cedula, nombres, apellidos, telefono)
            VALUES (@IdUsuario, @Cedula, @Nombres, @Apellidos, @Telefono)
            RETURNING id_cliente
            """, c);

    public Task<int> ActualizarAsync(Cliente c) =>
        db.EjecutarAsync("""
            UPDATE cliente SET nombres = @Nombres, apellidos = @Apellidos, telefono = @Telefono
             WHERE id_cliente = @IdCliente
            """, c);

    public async Task<ResultadoPagina<Cliente>> ListarAsync(string? texto, int pagina, int tamano)
    {
        pagina = Math.Max(1, pagina);
        tamano = Math.Clamp(tamano, 1, 100);
        var patron = string.IsNullOrWhiteSpace(texto) ? null : "%" + texto.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
        var p = new { patron, limite = tamano, desplazamiento = (pagina - 1) * tamano };
        const string filtro = """
            WHERE (@patron::text IS NULL OR c.nombres ILIKE @patron OR c.apellidos ILIKE @patron
                   OR c.cedula ILIKE @patron OR u.correo ILIKE @patron)
            """;

        var total = await db.EscalarAsync<int>($"SELECT COUNT(*)::int {Desde} {filtro}", p);
        var items = await db.ListarAsync<Cliente>(
            $"SELECT {Cols} {Desde} {filtro} ORDER BY c.apellidos, c.nombres LIMIT @limite OFFSET @desplazamiento", p);
        return new ResultadoPagina<Cliente>(items, total, pagina, tamano);
    }
}

public sealed class AdministradorDP(Db db)
{
    public Task<int> InsertarAsync(Administrador a) =>
        db.EscalarAsync<int>("""
            INSERT INTO administrador (id_usuario, nombres, apellidos, cargo)
            VALUES (@IdUsuario, @Nombres, @Apellidos, @Cargo)
            RETURNING id_admin
            """, a);

    public Task<Administrador?> ObtenerPorUsuarioAsync(int idUsuario) =>
        db.UnoAsync<Administrador>(
            "SELECT id_admin, id_usuario, nombres, apellidos, cargo FROM administrador WHERE id_usuario = @idUsuario",
            new { idUsuario });
}

public sealed class ZonaEntregaDP(Db db)
{
    private const string Cols = "id_zona, sector, costo_envio, activa";

    public Task<List<ZonaEntrega>> ListarAsync(bool soloActivas) =>
        db.ListarAsync<ZonaEntrega>(
            $"SELECT {Cols} FROM zona_entrega WHERE (@soloActivas = FALSE OR activa) ORDER BY sector", new { soloActivas });

    public Task<ZonaEntrega?> ObtenerAsync(int id) =>
        db.UnoAsync<ZonaEntrega>($"SELECT {Cols} FROM zona_entrega WHERE id_zona = @id", new { id });

    public Task<int> InsertarAsync(ZonaEntrega z) =>
        db.EscalarAsync<int>(
            "INSERT INTO zona_entrega (sector, costo_envio, activa) VALUES (@Sector, @CostoEnvio, @Activa) RETURNING id_zona", z);

    public Task<int> ActualizarAsync(ZonaEntrega z) =>
        db.EjecutarAsync(
            "UPDATE zona_entrega SET sector = @Sector, costo_envio = @CostoEnvio, activa = @Activa WHERE id_zona = @IdZona", z);

    public Task<int> EliminarAsync(int id) =>
        db.EjecutarAsync("DELETE FROM zona_entrega WHERE id_zona = @id", new { id });
}

public sealed class DireccionDP(Db db)
{
    private const string Cols = """
        d.id_direccion, d.id_cliente, d.id_zona, d.calle_principal, d.calle_secundaria, d.referencia,
        d.ciudad, d.es_principal, d.activa, z.sector, z.costo_envio
        """;
    private const string Desde = "FROM direccion d JOIN zona_entrega z ON z.id_zona = d.id_zona";

    public Task<List<Direccion>> ListarPorClienteAsync(int idCliente) =>
        db.ListarAsync<Direccion>(
            $"SELECT {Cols} {Desde} WHERE d.id_cliente = @idCliente AND d.activa ORDER BY d.es_principal DESC, d.id_direccion",
            new { idCliente });

    public Task<Direccion?> ObtenerAsync(int id) =>
        db.UnoAsync<Direccion>($"SELECT {Cols} {Desde} WHERE d.id_direccion = @id", new { id });

    public Task<int> InsertarAsync(Direccion d) =>
        db.EscalarAsync<int>("""
            INSERT INTO direccion (id_cliente, id_zona, calle_principal, calle_secundaria, referencia, ciudad, es_principal)
            VALUES (@IdCliente, @IdZona, @CallePrincipal, @CalleSecundaria, @Referencia, @Ciudad, @EsPrincipal)
            RETURNING id_direccion
            """, d);

    public Task<int> ActualizarAsync(Direccion d) =>
        db.EjecutarAsync("""
            UPDATE direccion
               SET id_zona = @IdZona, calle_principal = @CallePrincipal, calle_secundaria = @CalleSecundaria,
                   referencia = @Referencia, ciudad = @Ciudad
             WHERE id_direccion = @IdDireccion AND id_cliente = @IdCliente
            """, d);

    public Task<int> ContarActivasAsync(int idCliente) =>
        db.EscalarAsync<int>("SELECT COUNT(*)::int FROM direccion WHERE id_cliente = @idCliente AND activa", new { idCliente });

    /// <summary>Índice único: solo una principal activa por cliente, así que primero se quita la actual.</summary>
    public Task<int> QuitarPrincipalAsync(int idCliente) =>
        db.EjecutarAsync(
            "UPDATE direccion SET es_principal = FALSE WHERE id_cliente = @idCliente AND es_principal", new { idCliente });

    public Task<int> MarcarPrincipalAsync(int idDireccion) =>
        db.EjecutarAsync("UPDATE direccion SET es_principal = TRUE WHERE id_direccion = @idDireccion AND activa", new { idDireccion });

    /// <summary>Baja lógica: la dirección puede estar en pedidos viejos, por eso no se borra.</summary>
    public Task<int> DarDeBajaAsync(int idDireccion, int idCliente) =>
        db.EjecutarAsync("""
            UPDATE direccion SET activa = FALSE, es_principal = FALSE
             WHERE id_direccion = @idDireccion AND id_cliente = @idCliente
            """, new { idDireccion, idCliente });

    public Task<int?> PrimeraActivaAsync(int idCliente) =>
        db.UnoAsync<int?>(
            "SELECT id_direccion FROM direccion WHERE id_cliente = @idCliente AND activa ORDER BY id_direccion LIMIT 1",
            new { idCliente });
}

public sealed class ParametroDP(Db db)
{
    public Task<List<Parametro>> ListarAsync() =>
        db.ListarAsync<Parametro>("SELECT clave, valor, descripcion FROM parametro ORDER BY clave");

    public Task<string?> ObtenerValorAsync(string clave) =>
        db.UnoAsync<string>("SELECT valor FROM parametro WHERE clave = @clave", new { clave });

    public Task<int> ActualizarAsync(string clave, string valor) =>
        db.EjecutarAsync("UPDATE parametro SET valor = @valor WHERE clave = @clave", new { clave, valor });
}

public sealed class AuditoriaDP(Db db)
{
    public Task<int> RegistrarAsync(int? idUsuario, string accion, string? entidad = null, string? idEntidad = null, string? ip = null) =>
        db.EjecutarAsync("""
            INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, ip)
            VALUES (@idUsuario, @accion, @entidad, @idEntidad, @ip)
            """, new { idUsuario, accion, entidad, idEntidad, ip });

    public Task<List<Auditoria>> ListarRecientesAsync(int limite) =>
        db.ListarAsync<Auditoria>(
            "SELECT id_log, id_usuario, accion, entidad, id_entidad, ip, fecha FROM auditoria ORDER BY fecha DESC, id_log DESC LIMIT @limite",
            new { limite });
}
