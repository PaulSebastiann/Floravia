namespace Floravia.Core.Entidades;

public class Usuario
{
    public int IdUsuario { get; set; }
    public string Correo { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Rol { get; set; } = Roles.Cliente;
    public string Estado { get; set; } = EstadoRegistro.Activo;
    public int IntentosFallidos { get; set; }
    public DateTime? BloqueadoHasta { get; set; }
    public DateTime? UltimoAcceso { get; set; }
    public DateTime CreadoEn { get; set; }

    /// <summary>Calculado en SQL con la hora del servidor de base de datos.</summary>
    public bool BloqueadoTemporalmente { get; set; }
}

public class Cliente
{
    public int IdCliente { get; set; }
    public int IdUsuario { get; set; }
    public string Cedula { get; set; } = "";
    public string Nombres { get; set; } = "";
    public string Apellidos { get; set; } = "";
    public string Telefono { get; set; } = "";

    // Datos del join con usuario (listados del admin)
    public string? Correo { get; set; }
    public string? EstadoUsuario { get; set; }
}

public class Administrador
{
    public int IdAdmin { get; set; }
    public int IdUsuario { get; set; }
    public string Nombres { get; set; } = "";
    public string Apellidos { get; set; } = "";
    public string? Cargo { get; set; }
}

public class TokenRecuperacion
{
    public int IdToken { get; set; }
    public int IdUsuario { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiraEn { get; set; }
    public DateTime? UsadoEn { get; set; }
    public DateTime CreadoEn { get; set; }
}

public class Parametro
{
    public string Clave { get; set; } = "";
    public string Valor { get; set; } = "";
    public string? Descripcion { get; set; }
}

public class Auditoria
{
    public long IdLog { get; set; }
    public int? IdUsuario { get; set; }
    public string Accion { get; set; } = "";
    public string? Entidad { get; set; }
    public string? IdEntidad { get; set; }
    public string? Ip { get; set; }
    public DateTime Fecha { get; set; }
}
