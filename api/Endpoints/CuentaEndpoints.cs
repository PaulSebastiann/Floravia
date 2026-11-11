using System.Security.Claims;
using Api.Auth;
using Floravia.Application;
using Floravia.Core.Entidades;

namespace Api.Endpoints;

public record PerfilDto(string Nombres, string Apellidos, string Telefono);

public record DireccionDto(
    int IdZona, string CallePrincipal, string? CalleSecundaria, string? Referencia, string? Ciudad, bool EsPrincipal);

/// <summary>Perfil y libreta de direcciones del cliente con sesión. Siempre opera sobre SUS propios datos (id del token).</summary>
public static class CuentaEndpoints
{
    public static void MapCuenta(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/cuenta").RequireAuthorization("Cliente").WithTags("Mi cuenta");

        g.MapGet("/perfil", async (ClaimsPrincipal u, FloraviaServicios s) =>
            await s.Cuenta.ObtenerPerfilAsync(u.IdCliente()) is { } c ? Results.Ok(c) : Results.NotFound());

        g.MapPut("/perfil", async (PerfilDto d, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Cuenta.ActualizarPerfilAsync(u.IdCliente(), d.Nombres, d.Apellidos, d.Telefono)));

        g.MapGet("/direcciones", async (ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Direcciones.ListarAsync(u.IdCliente())));

        g.MapPost("/direcciones", async (DireccionDto d, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            var creada = await s.Direcciones.AgregarAsync(Armar(d, u.IdCliente(), 0));
            return Results.Created($"/api/cuenta/direcciones/{creada.IdDireccion}", creada);
        });

        g.MapPut("/direcciones/{id:int}", async (int id, DireccionDto d, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Direcciones.ActualizarAsync(Armar(d, u.IdCliente(), id))));

        g.MapPost("/direcciones/{id:int}/principal", async (int id, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            await s.Direcciones.MarcarPrincipalAsync(u.IdCliente(), id);
            return Results.NoContent();
        });

        g.MapDelete("/direcciones/{id:int}", async (int id, ClaimsPrincipal u, FloraviaServicios s) =>
        {
            await s.Direcciones.EliminarAsync(u.IdCliente(), id);
            return Results.NoContent();
        });
    }

    private static Direccion Armar(DireccionDto d, int idCliente, int idDireccion) => new()
    {
        IdDireccion = idDireccion,
        IdCliente = idCliente,
        IdZona = d.IdZona,
        CallePrincipal = d.CallePrincipal,
        CalleSecundaria = d.CalleSecundaria,
        Referencia = d.Referencia,
        Ciudad = string.IsNullOrWhiteSpace(d.Ciudad) ? "Quito" : d.Ciudad,
        EsPrincipal = d.EsPrincipal,
    };
}
