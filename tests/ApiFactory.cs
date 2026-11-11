using Microsoft.AspNetCore.Mvc.Testing;

namespace Floravia.Tests;

/// <summary>
/// Arranca la API REAL en memoria (mismo Program.cs, mismo pipeline) apuntando a la base de pruebas.
/// La configuración se pasa por variables de entorno porque Program.cs la lee antes de construir el host.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public ApiFactory(string conexion, string carpetaArchivos)
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", conexion);
        Environment.SetEnvironmentVariable("Jwt__Key", "PRUEBAS-clave-jwt-de-mas-de-32-caracteres-0123456789");
        Environment.SetEnvironmentVariable("Reservas__IntervaloSegundos", "0");   // sin tarea periódica en pruebas
        Environment.SetEnvironmentVariable("RateLimit__PorMinuto", "100000");     // sin límites de peticiones
        Environment.SetEnvironmentVariable("RateLimit__EstrictoPorMinuto", "100000");
        Environment.SetEnvironmentVariable("Almacen__RutaImagenes", Path.Combine(carpetaArchivos, "imagenes"));
        Environment.SetEnvironmentVariable("Almacen__RutaComprobantes", Path.Combine(carpetaArchivos, "comprobantes"));
    }
}
