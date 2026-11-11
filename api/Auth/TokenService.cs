using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Api.Auth;

/// <summary>Emite los JWT. Claims: sub (id usuario), email, role, cid (id cliente) y aid (id administrador).</summary>
public class TokenService(IConfiguration cfg)
{
    public const string Issuer = "floravia";
    public const string Audience = "floravia-web";

    public static SymmetricSecurityKey Clave(IConfiguration cfg)
    {
        var clave = cfg["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(clave) || clave.Length < 32)
            throw new InvalidOperationException("Jwt:Key es obligatoria y debe tener al menos 32 caracteres.");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(clave));
    }

    public (string token, DateTime expira) Crear(int idUsuario, string correo, string rol, int? idCliente, int? idAdmin = null)
    {
        var horas = int.TryParse(cfg["Jwt:HorasValidez"], out var h) && h > 0 ? h : 8;
        var expira = DateTime.UtcNow.AddHours(horas);

        var claims = new List<Claim> { new("sub", idUsuario.ToString()), new("email", correo), new("role", rol) };
        if (idCliente is int cid) claims.Add(new Claim("cid", cid.ToString()));
        if (idAdmin is int aid) claims.Add(new Claim("aid", aid.ToString()));

        var jwt = new JwtSecurityToken(
            issuer: Issuer, audience: Audience, claims: claims, expires: expira,
            signingCredentials: new SigningCredentials(Clave(cfg), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expira);
    }
}
