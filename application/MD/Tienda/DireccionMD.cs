using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Tienda;

/// <summary>Libreta de direcciones del cliente y zonas de entrega disponibles.</summary>
public sealed class DireccionMD(Db db, DireccionDP direcciones, ZonaEntregaDP zonas)
{
    public Task<List<ZonaEntrega>> ListarZonasAsync() => zonas.ListarAsync(soloActivas: true);

    public Task<List<Direccion>> ListarAsync(int idCliente) => direcciones.ListarPorClienteAsync(idCliente);

    public async Task<Direccion> AgregarAsync(Direccion d)
    {
        d.CallePrincipal = Validar.Texto(d.CallePrincipal, "La calle principal", 150);
        d.CalleSecundaria = Validar.TextoOpcional(d.CalleSecundaria, "La calle secundaria", 150);
        d.Referencia = Validar.TextoOpcional(d.Referencia, "La referencia", 250);
        d.Ciudad = Validar.Texto(d.Ciudad, "La ciudad", 80);
        await ValidarZonaAsync(d.IdZona);

        return await db.TransaccionAsync(async () =>
        {
            // La primera dirección del cliente es la principal automáticamente
            if (await direcciones.ContarActivasAsync(d.IdCliente) == 0) d.EsPrincipal = true;
            if (d.EsPrincipal) await direcciones.QuitarPrincipalAsync(d.IdCliente);

            var id = await direcciones.InsertarAsync(d);
            return (await direcciones.ObtenerAsync(id))!;
        });
    }

    public async Task<Direccion> ActualizarAsync(Direccion d)
    {
        var actual = await ObtenerPropiaAsync(d.IdCliente, d.IdDireccion);
        actual.CallePrincipal = Validar.Texto(d.CallePrincipal, "La calle principal", 150);
        actual.CalleSecundaria = Validar.TextoOpcional(d.CalleSecundaria, "La calle secundaria", 150);
        actual.Referencia = Validar.TextoOpcional(d.Referencia, "La referencia", 250);
        actual.Ciudad = Validar.Texto(d.Ciudad, "La ciudad", 80);
        await ValidarZonaAsync(d.IdZona);
        actual.IdZona = d.IdZona;

        await direcciones.ActualizarAsync(actual);
        return (await direcciones.ObtenerAsync(d.IdDireccion))!;
    }

    public Task MarcarPrincipalAsync(int idCliente, int idDireccion) => db.TransaccionAsync(async () =>
    {
        await ObtenerPropiaAsync(idCliente, idDireccion);
        await direcciones.QuitarPrincipalAsync(idCliente);
        await direcciones.MarcarPrincipalAsync(idDireccion);
    });

    /// <summary>Baja lógica. Si era la principal, otra dirección activa toma su lugar.</summary>
    public Task EliminarAsync(int idCliente, int idDireccion) => db.TransaccionAsync(async () =>
    {
        var d = await ObtenerPropiaAsync(idCliente, idDireccion);
        await direcciones.DarDeBajaAsync(idDireccion, idCliente);

        if (d.EsPrincipal && await direcciones.PrimeraActivaAsync(idCliente) is int siguiente)
            await direcciones.MarcarPrincipalAsync(siguiente);
    });

    private async Task<Direccion> ObtenerPropiaAsync(int idCliente, int idDireccion)
    {
        var d = await direcciones.ObtenerAsync(idDireccion);
        if (d is null || d.IdCliente != idCliente || !d.Activa)
            throw new NoEncontradoException("Dirección no encontrada.");
        return d;
    }

    private async Task ValidarZonaAsync(int idZona)
    {
        var zona = await zonas.ObtenerAsync(idZona);
        if (zona is null || !zona.Activa)
            throw new ReglaNegocioException("No hacemos entregas en ese sector por ahora.");
    }
}
