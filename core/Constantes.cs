namespace Floravia.Core;

public static class Roles
{
    public const string Admin = "ADMIN";
    public const string Cliente = "CLIENTE";
}

public static class EstadoRegistro
{
    public const string Activo = "ACTIVO";
    public const string Inactivo = "INACTIVO";
    public const string Bloqueado = "BLOQUEADO";
}

public static class EstadoPedido
{
    public const string PendientePago = "PENDIENTE_PAGO";
    public const string Pagado = "PAGADO";
    public const string EnPreparacion = "EN_PREPARACION";
    public const string EnCamino = "EN_CAMINO";
    public const string Entregado = "ENTREGADO";
    public const string Cancelado = "CANCELADO";
    public const string PagoFallido = "PAGO_FALLIDO";
}

public static class EstadoPago
{
    public const string Pendiente = "PENDIENTE";
    public const string Aprobado = "APROBADO";
    public const string Rechazado = "RECHAZADO";
    public const string Reembolsado = "REEMBOLSADO";
}

public static class MetodoPago
{
    public const string Transferencia = "TRANSFERENCIA";
    public const string Tarjeta = "TARJETA";
}

public static class EstadoReserva
{
    public const string Activa = "ACTIVA";
    public const string Confirmada = "CONFIRMADA";
    public const string Expirada = "EXPIRADA";
    public const string Liberada = "LIBERADA";
}

public static class EstadoEntrega
{
    public const string Programada = "PROGRAMADA";
    public const string EnCamino = "EN_CAMINO";
    public const string Entregada = "ENTREGADA";
    public const string Fallida = "FALLIDA";
}

public static class EstadoCarrito
{
    public const string Activo = "ACTIVO";
    public const string Convertido = "CONVERTIDO";
    public const string Abandonado = "ABANDONADO";
}

public static class TipoMovimiento
{
    public const string Entrada = "ENTRADA";
    public const string Salida = "SALIDA";
    public const string Ajuste = "AJUSTE";
}

/// <summary>Claves de la tabla parametro.</summary>
public static class Parametros
{
    public const string IvaPorcentaje = "IVA_PORCENTAJE";
    public const string ReservaStockMinutos = "RESERVA_STOCK_MINUTOS";
    public const string MaxIntentosLogin = "MAX_INTENTOS_LOGIN";
    public const string MinutosBloqueoLogin = "MINUTOS_BLOQUEO_LOGIN";
}

/// <summary>Error de regla de negocio o de validación: el mensaje es apto para mostrarse al usuario.</summary>
public class ReglaNegocioException(string mensaje) : Exception(mensaje) { }

public sealed class NoEncontradoException(string mensaje) : ReglaNegocioException(mensaje) { }
