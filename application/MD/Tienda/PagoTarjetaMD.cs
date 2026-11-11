using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;
using Floravia.Application.MD.Admin;

namespace Floravia.Application.MD.Tienda;

/// <summary>Datos que el cliente teclea en el formulario de tarjeta. NUNCA se guardan en la base de datos.</summary>
public sealed record DatosTarjeta(string Numero, string Titular, int MesVencimiento, int AnioVencimiento, string Cvv);

public sealed record ResultadoTarjeta(bool Aprobada, string Marca, string Ultimos4, string Mensaje);

public sealed record ResultadoPagoTarjeta(
    bool Aprobado, string Mensaje, string Marca, string Ultimos4, PedidoDetalleVista Pedido);

/// <summary>
/// PASARELA SIMULADA (práctica académica): valida los datos de la tarjeta como lo haría un formulario real
/// (formato, algoritmo de Luhn, vencimiento, CVV) pero NO cobra ni se conecta a ningún banco.
/// Tarjetas de prueba: cualquier número válido se aprueba; 4000 0000 0000 0002 se rechaza;
/// 4000 0000 0000 9995 simula fondos insuficientes.
/// </summary>
public static class TarjetaSimulada
{
    public const string NumeroRechazada = "4000000000000002";
    public const string NumeroSinFondos = "4000000000009995";

    public static ResultadoTarjeta Evaluar(DatosTarjeta d, DateTime? hoy = null)
    {
        var ahora = hoy ?? DateTime.Today;

        var numero = (d.Numero ?? "").Replace(" ", "").Replace("-", "");
        if (numero.Length is < 13 or > 19 || !numero.All(char.IsAsciiDigit) || !PasaLuhn(numero))
            throw new ReglaNegocioException("El número de tarjeta no es válido.");

        var titular = Validar.Texto(d.Titular, "El nombre del titular", 100);
        if (titular.Length < 3) throw new ReglaNegocioException("El nombre del titular no es válido.");

        if (d.MesVencimiento is < 1 or > 12)
            throw new ReglaNegocioException("El mes de vencimiento no es válido.");
        var anio = d.AnioVencimiento < 100 ? 2000 + d.AnioVencimiento : d.AnioVencimiento;
        if (anio is < 2000 or > 2100)
            throw new ReglaNegocioException("El año de vencimiento no es válido.");
        if (ahora >= new DateTime(anio, d.MesVencimiento, 1).AddMonths(1))
            throw new ReglaNegocioException("La tarjeta está vencida.");

        var marca = DetectarMarca(numero);
        var cvv = (d.Cvv ?? "").Trim();
        var largoCvv = marca == "Amex" ? 4 : 3;
        if (cvv.Length != largoCvv || !cvv.All(char.IsAsciiDigit))
            throw new ReglaNegocioException("El código de seguridad (CVV) no es válido.");

        var ultimos4 = numero[^4..];
        return numero switch
        {
            NumeroRechazada => new ResultadoTarjeta(false, marca, ultimos4, "Tarjeta rechazada por el emisor (simulación)."),
            NumeroSinFondos => new ResultadoTarjeta(false, marca, ultimos4, "Fondos insuficientes (simulación)."),
            _ => new ResultadoTarjeta(true, marca, ultimos4, "Pago aprobado (simulación: no se realizó ningún cobro)."),
        };
    }

    /// <summary>Algoritmo de Luhn: el dígito de control que usan todas las tarjetas reales.</summary>
    private static bool PasaLuhn(string numero)
    {
        var suma = 0;
        var doblar = false;
        for (var i = numero.Length - 1; i >= 0; i--)
        {
            var digito = numero[i] - '0';
            if (doblar)
            {
                digito *= 2;
                if (digito > 9) digito -= 9;
            }
            suma += digito;
            doblar = !doblar;
        }
        return suma % 10 == 0;
    }

    private static string DetectarMarca(string n)
    {
        if (n[0] == '4') return "Visa";
        var dos = int.Parse(n[..2]);
        var cuatro = int.Parse(n[..4]);
        if (dos is >= 51 and <= 55 || cuatro is >= 2221 and <= 2720) return "Mastercard";
        if (dos is 34 or 37) return "Amex";
        if (dos is 36 or 38 || (n.StartsWith("30") && n[2] is >= '0' and <= '5')) return "Diners";
        if (cuatro == 6011 || dos == 65) return "Discover";
        return "Tarjeta";
    }
}

/// <summary>
/// Paga un pedido con tarjeta simulada. El pago se registra y se aprueba (o rechaza) en UNA sola transacción:
/// no pueden quedar pagos "colgados" a medias. Del número de tarjeta solo se conservan marca y últimos 4 dígitos
/// dentro de la referencia del pago.
/// </summary>
public sealed class PagoTarjetaMD(Db db, PedidoMD pedidos, PedidoAdminMD admin)
{
    public async Task<ResultadoPagoTarjeta> PagarAsync(int idCliente, int idPedido, DatosTarjeta tarjeta)
    {
        var r = TarjetaSimulada.Evaluar(tarjeta); // si el formato es inválido falla aquí, sin tocar la BD
        var referencia = $"SIM-{r.Marca}-{r.Ultimos4}-{Guid.NewGuid():N}";

        await db.TransaccionAsync(async () =>
        {
            var pago = await pedidos.RegistrarPagoAsync(idCliente, idPedido, MetodoPago.Tarjeta, referencia);
            if (r.Aprobada) await admin.AprobarPagoAsync(pago.IdPago);
            else await admin.RechazarPagoAsync(pago.IdPago);
        });

        return new ResultadoPagoTarjeta(
            r.Aprobada, r.Mensaje, r.Marca, r.Ultimos4, await pedidos.ObtenerDetalleAsync(idCliente, idPedido));
    }
}
