using System.Security.Claims;
using Api.Auth;
using Floravia.Application;

namespace Api.Endpoints.Administracion;

public record EntradaStockDto(int Cantidad, int? IdProveedor, decimal? CostoUnitario, string? Motivo);
public record SalidaStockDto(int Cantidad, string Motivo);
public record AjusteStockDto(int StockReal, string Motivo);

/// <summary>Movimientos de stock. Cada uno queda en el kardex con su saldo y el administrador que lo hizo.</summary>
public static class AdminInventarioEndpoints
{
    public static void MapAdminInventario(this RouteGroupBuilder admin)
    {
        var p = admin.MapGroup("/productos").WithTags("Admin · Inventario");

        p.MapPost("/{id:int}/stock/entrada", async (int id, EntradaStockDto d, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Inventario.AumentarStockAsync(id, d.Cantidad, u.IdAdmin(), d.IdProveedor, d.CostoUnitario, d.Motivo)));

        p.MapPost("/{id:int}/stock/salida", async (int id, SalidaStockDto d, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Inventario.DisminuirStockAsync(id, d.Cantidad, u.IdAdmin(), d.Motivo)));

        p.MapPost("/{id:int}/stock/ajuste", async (int id, AjusteStockDto d, ClaimsPrincipal u, FloraviaServicios s) =>
            Results.Ok(await s.Inventario.AjustarStockAsync(id, d.StockReal, u.IdAdmin(), d.Motivo)));

        p.MapGet("/{id:int}/kardex", async (int id, int? limite, FloraviaServicios s) =>
            Results.Ok(await s.Inventario.ObtenerKardexAsync(id, limite ?? 100)));

        var i = admin.MapGroup("/inventario").WithTags("Admin · Inventario");

        i.MapGet("/movimientos", async (int? limite, FloraviaServicios s) =>
            Results.Ok(await s.Inventario.ListarMovimientosRecientesAsync(limite ?? 50)));

        i.MapGet("/stock-bajo", async (FloraviaServicios s) => Results.Ok(await s.Inventario.ListarStockBajoAsync()));
    }
}
