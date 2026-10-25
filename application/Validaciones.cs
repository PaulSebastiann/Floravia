using System.Text.RegularExpressions;

namespace Floravia.Application;

/// <summary>Validaciones simples que lanzan <see cref="ReglaNegocioException"/> con un mensaje legible.</summary>
public static partial class Validar
{
    public static string Texto(string? valor, string campo, int max, bool requerido = true)
    {
        var v = valor?.Trim() ?? "";
        if (requerido && v.Length == 0) throw new ReglaNegocioException($"{campo} es obligatorio.");
        if (v.Length > max) throw new ReglaNegocioException($"{campo} no puede superar {max} caracteres.");
        return v;
    }

    public static string? TextoOpcional(string? valor, string campo, int max)
    {
        var v = Texto(valor, campo, max, requerido: false);
        return v.Length == 0 ? null : v;
    }

    public static void Positivo(int valor, string campo)
    {
        if (valor <= 0) throw new ReglaNegocioException($"{campo} debe ser mayor que cero.");
    }

    public static void NoNegativo(decimal valor, string campo)
    {
        if (valor < 0) throw new ReglaNegocioException($"{campo} no puede ser negativo.");
    }

    public static string Correo(string? correo)
    {
        var v = (correo ?? "").Trim().ToLowerInvariant();
        if (v.Length == 0 || v.Length > 150 || !CorreoRegex().IsMatch(v))
            throw new ReglaNegocioException("El correo no es válido.");
        return v;
    }

    public static string Cedula(string? cedula)
    {
        var v = (cedula ?? "").Trim();
        if (!CedulaRegex().IsMatch(v)) throw new ReglaNegocioException("La cédula debe tener 10 dígitos.");
        return v;
    }

    public static void Password(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8
            || !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            throw new ReglaNegocioException("La contraseña debe tener al menos 8 caracteres, con letras y números.");
    }

    public static string? ColorHex(string? hex)
    {
        var v = hex?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        if (!HexRegex().IsMatch(v)) throw new ReglaNegocioException("El color debe tener formato #RRGGBB.");
        return v;
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")] private static partial Regex CorreoRegex();
    [GeneratedRegex(@"^[0-9]{10}$")] private static partial Regex CedulaRegex();
    [GeneratedRegex(@"^#[0-9A-Fa-f]{6}$")] private static partial Regex HexRegex();
}

public static class Montos
{
    public static decimal CalcularIva(decimal subtotal, decimal porcentaje) =>
        Math.Round(subtotal * porcentaje / 100m, 2, MidpointRounding.AwayFromZero);
}
