using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Api.Auth;

public class TokenService(IConfiguration cfg)
{
    public const string Issuer = "floravia";
    public const string Audience = "floravia-web";

    public static SymmetricSecurityKey Clave(IConfiguration cfg) =>
        new(Encoding.UTF8.GetBytes(cfg["Jwt:Key"] ?? throw new InvalidOperationException("Falta Jwt:Key")));

    public (string token, DateTime expira) Crear(int idUsuario, string correo, string rol, int? idCliente)
    {
        var expira = DateTime.UtcNow.AddHours(8);
        var claims = new List<Claim> { new("sub", idUsuario.ToString()), new("email", correo), new("role", rol) };
        if (idCliente is int cid) claims.Add(new Claim("cid", cid.ToString()));

        var jwt = new JwtSecurityToken(
            issuer: Issuer, audience: Audience, claims: claims, expires: expira,
            signingCredentials: new SigningCredentials(Clave(cfg), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expira);
    }
}