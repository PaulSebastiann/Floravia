using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>Zonas de entrega y proveedores. (El IVA y demás parámetros se editan con <see cref="ParametrosMD"/>.)</summary>
public sealed class ConfiguracionAdminMD(ZonaEntregaDP zonas, ProveedorDP proveedores)
{
    // ---------- Zonas de entrega ----------

    public Task<List<ZonaEntrega>> ListarZonasAsync() => zonas.ListarAsync(soloActivas: false);

    public async Task<ZonaEntrega> CrearZonaAsync(string sector, decimal costoEnvio, bool activa = true)
    {
        Validar.NoNegativo(costoEnvio, "El costo de envío");
        var z = new ZonaEntrega { Sector = Validar.Texto(sector, "El sector", 100), CostoEnvio = costoEnvio, Activa = activa };
        try
        {
            var id = await zonas.InsertarAsync(z);
            return (await zonas.ObtenerAsync(id))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ya existe una zona con ese sector.");
        }
    }

    public async Task<ZonaEntrega> ActualizarZonaAsync(int idZona, string sector, decimal costoEnvio, bool activa)
    {
        Validar.NoNegativo(costoEnvio, "El costo de envío");
        var z = new ZonaEntrega { IdZona = idZona, Sector = Validar.Texto(sector, "El sector", 100), CostoEnvio = costoEnvio, Activa = activa };
        try
        {
            if (await zonas.ActualizarAsync(z) == 0) throw new NoEncontradoException("Zona no encontrada.");
            return (await zonas.ObtenerAsync(idZona))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ya existe una zona con ese sector.");
        }
    }

    public async Task EliminarZonaAsync(int idZona)
    {
        try
        {
            if (await zonas.EliminarAsync(idZona) == 0) throw new NoEncontradoException("Zona no encontrada.");
        }
        catch (Exception e) when (Db.EsViolacionForanea(e))
        {
            throw new ReglaNegocioException("No se puede eliminar: hay direcciones en esa zona. Desactívala en su lugar.");
        }
    }

    // ---------- Proveedores ----------

    public Task<List<Proveedor>> ListarProveedoresAsync() => proveedores.ListarAsync();

    public async Task<Proveedor> CrearProveedorAsync(string nombre, string? ruc, string? telefono)
    {
        var p = new Proveedor
        {
            Nombre = Validar.Texto(nombre, "El nombre", 150),
            Ruc = Validar.TextoOpcional(ruc, "El RUC", 13),
            Telefono = Validar.TextoOpcional(telefono, "El teléfono", 20),
        };
        try
        {
            var id = await proveedores.InsertarAsync(p);
            return (await proveedores.ObtenerAsync(id))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ya existe un proveedor con ese RUC.");
        }
    }

    public async Task<Proveedor> ActualizarProveedorAsync(int idProveedor, string nombre, string? ruc, string? telefono)
    {
        var p = new Proveedor
        {
            IdProveedor = idProveedor,
            Nombre = Validar.Texto(nombre, "El nombre", 150),
            Ruc = Validar.TextoOpcional(ruc, "El RUC", 13),
            Telefono = Validar.TextoOpcional(telefono, "El teléfono", 20),
        };
        try
        {
            if (await proveedores.ActualizarAsync(p) == 0) throw new NoEncontradoException("Proveedor no encontrado.");
            return (await proveedores.ObtenerAsync(idProveedor))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ya existe un proveedor con ese RUC.");
        }
    }

    /// <summary>El historial de kardex conserva sus movimientos (el proveedor queda en blanco).</summary>
    public async Task EliminarProveedorAsync(int idProveedor)
    {
        if (await proveedores.EliminarAsync(idProveedor) == 0)
            throw new NoEncontradoException("Proveedor no encontrado.");
    }
}
