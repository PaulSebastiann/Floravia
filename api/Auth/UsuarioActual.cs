using System.Security.Claims;

namespace Api.Auth;

/// <summary>Lee los ids de la sesión (JWT). Si el token no trae el dato necesario responde 403.</summary>
public static class UsuarioActual
{
    public static int IdUsuario(this ClaimsPrincipal u) => Entero(u, "sub");
    public static int IdCliente(this ClaimsPrincipal u) => Entero(u, "cid");
    public static int IdAdmin(this ClaimsPrincipal u) => Entero(u, "aid");

    public static int? IdClienteOpcional(this ClaimsPrincipal u) =>
        int.TryParse(u.FindFirst("cid")?.Value, out var v) ? v : null;

    private static int Entero(ClaimsPrincipal u, string claim) =>
        int.TryParse(u.FindFirst(claim)?.Value, out var v)
            ? v
            : throw new UnauthorizedAccessException("Tu sesión no tiene permiso para esta operación.");
}
