using System.Security.Cryptography;
using Api.Auth;
using Floravia.Application;
using Floravia.Core;
using Floravia.Core.Entidades;

namespace Api.Endpoints;

public record ItemDto(int IdProducto, int Cantidad);
public record CantidadDto(int Cantidad);

/// <summary>'Token' solo viene la primera vez que un visitante crea su carrito: el front debe guardarlo (localStorage).</summary>
public record CarritoRespuesta(string? Token, CarritoVista Carrito);

/// <summary>
/// Carrito para visitantes (cabecera X-Carrito-Token) y clientes con sesión (JWT).
/// El token de visitante SIEMPRE lo genera el servidor: nunca se acepta uno inventado por el cliente.
/// </summary>
public static class CarritoEndpoints
{
    private const string Cabecera = "X-Carrito-Token";
    private const int MaximoPorProducto = 99;

    public static void MapCarrito(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/carrito").AllowAnonymous().WithTags("Carrito");

        g.MapGet("/", async (HttpContext ctx, FloraviaServicios s) =>
        {
            var carrito = await Buscar(ctx, s);
            return Results.Ok(carrito is null
                ? new CarritoVista { PorcentajeIva = await s.Parametros.IvaAsync() }
                : await s.Carrito.VerAsync(carrito.IdCarrito));
        });

        g.MapPost("/items", async (ItemDto d, HttpContext ctx, FloraviaServicios s) =>
        {
            if (d.Cantidad is < 1 or > MaximoPorProducto)
                throw new ReglaNegocioException($"La cantidad debe estar entre 1 y {MaximoPorProducto}.");

            string? tokenNuevo = null;
            var carrito = await Buscar(ctx, s);
            if (carrito is null)
            {
                if (ctx.User.IdClienteOpcional() is int cid)
                    carrito = await s.Carrito.ObtenerOCrearAsync(cid, null);
                else
                {
                    tokenNuevo = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
                    carrito = await s.Carrito.ObtenerOCrearAsync(null, tokenNuevo);
                }
            }
            return Results.Ok(new CarritoRespuesta(tokenNuevo, await s.Carrito.AgregarAsync(carrito.IdCarrito, d.IdProducto, d.Cantidad)));
        });

        g.MapPut("/items/{idProducto:int}", async (int idProducto, CantidadDto d, HttpContext ctx, FloraviaServicios s) =>
        {
            if (d.Cantidad > MaximoPorProducto)
                throw new ReglaNegocioException($"La cantidad máxima por producto es {MaximoPorProducto}.");
            var carrito = await Buscar(ctx, s) ?? throw new NoEncontradoException("Aún no tienes un carrito.");
            return Results.Ok(await s.Carrito.EstablecerCantidadAsync(carrito.IdCarrito, idProducto, d.Cantidad));
        });

        g.MapDelete("/items/{idProducto:int}", async (int idProducto, HttpContext ctx, FloraviaServicios s) =>
        {
            var carrito = await Buscar(ctx, s) ?? throw new NoEncontradoException("Aún no tienes un carrito.");
            return Results.Ok(await s.Carrito.QuitarAsync(carrito.IdCarrito, idProducto));
        });

        g.MapDelete("/", async (HttpContext ctx, FloraviaServicios s) =>
        {
            var carrito = await Buscar(ctx, s) ?? throw new NoEncontradoException("Aún no tienes un carrito.");
            return Results.Ok(await s.Carrito.VaciarAsync(carrito.IdCarrito));
        });

        // Fuera del grupo anónimo a propósito: AllowAnonymous gana sobre RequireAuthorization.
        // Se llama justo después de iniciar sesión para unir el carrito de visitante con el del cliente.
        app.MapPost("/api/carrito/fusionar", async (HttpContext ctx, FloraviaServicios s) =>
        {
            var idCliente = ctx.User.IdCliente();
            var token = TokenValido(ctx);
            var carrito = token is null
                ? await s.Carrito.ObtenerOCrearAsync(idCliente, null)
                : await s.Carrito.FusionarAnonimoAsync(token, idCliente);
            return Results.Ok(await s.Carrito.VerAsync(carrito.IdCarrito));
        }).RequireAuthorization("Cliente").WithTags("Carrito");
    }

    private static string? TokenValido(HttpContext ctx)
    {
        var t = ctx.Request.Headers[Cabecera].FirstOrDefault();
        return t is { Length: 48 } && t.All(Uri.IsHexDigit) ? t : null;
    }

    /// <summary>Busca el carrito activo del dueño (sesión o token) sin crear nada.</summary>
    private static async Task<Carrito?> Buscar(HttpContext ctx, FloraviaServicios s)
    {
        if (ctx.User.IdClienteOpcional() is int cid) return await s.Carrito.BuscarActivoAsync(cid, null);
        return TokenValido(ctx) is string token ? await s.Carrito.BuscarActivoAsync(null, token) : null;
    }
}
