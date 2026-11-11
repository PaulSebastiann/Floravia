using Floravia.Application;

namespace Api.Servicios;

/// <summary>
/// Cada minuto cancela los pedidos sin pagar cuya reserva venció y devuelve su stock a la tienda.
/// Sin esta tarea, un pedido abandonado bloquearía unidades para siempre.
/// Intervalo configurable en Reservas:IntervaloSegundos (0 = desactivada, útil en pruebas).
/// </summary>
public sealed class LimpiezaReservasService(
    FloraviaServicios s, IConfiguration cfg, ILogger<LimpiezaReservasService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var segundos = int.TryParse(cfg["Reservas:IntervaloSegundos"], out var v) ? v : 60;
        if (segundos <= 0)
        {
            log.LogInformation("Limpieza automática de reservas desactivada.");
            return;
        }

        using var temporizador = new PeriodicTimer(TimeSpan.FromSeconds(segundos));
        try
        {
            do
            {
                try
                {
                    var cancelados = await s.Stock.LiberarVencidasAsync();
                    if (cancelados > 0)
                        log.LogInformation("{Cantidad} pedido(s) sin pagar cancelado(s) por reserva vencida.", cancelados);
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogError(e, "Falló la limpieza de reservas vencidas; se reintentará en el siguiente ciclo.");
                }
            } while (await temporizador.WaitForNextTickAsync(ct));
        }
        catch (OperationCanceledException)
        {
            // apagado normal de la aplicación
        }
    }
}

/// <summary>
/// Crea el primer administrador al arrancar, solo si todavía no existe ninguno y están definidas las variables
/// Admin:Correo y Admin:Password. (No hay endpoint público para crear administradores.)
/// </summary>
public sealed class SemillaAdmin(FloraviaServicios s, IConfiguration cfg, ILogger<SemillaAdmin> log) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        var correo = cfg["Admin:Correo"];
        var password = cfg["Admin:Password"];
        if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(password)) return;

        try
        {
            var existentes = await s.Db.EscalarAsync<int>("SELECT COUNT(*)::int FROM usuario WHERE rol = 'ADMIN'");
            if (existentes > 0) return;

            await s.Usuarios.CrearAdministradorAsync(
                correo, password,
                cfg["Admin:Nombres"] ?? "Administrador", cfg["Admin:Apellidos"] ?? "Floravia", cfg["Admin:Cargo"] ?? "Propietario");
            log.LogInformation("Se creó el administrador inicial {Correo}. Cambia su contraseña cuanto antes.", correo);
        }
        catch (Exception e)
        {
            log.LogWarning(e, "No se pudo crear el administrador inicial (¿base de datos sin esquema?).");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
