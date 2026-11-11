using System.Net;
using System.Net.Mail;

namespace Api.Servicios;

/// <summary>Envío de correos (hoy solo la recuperación de contraseña). Se elige la implementación según la configuración.</summary>
public interface IServicioCorreo
{
    Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default);
}

/// <summary>Sin SMTP configurado: en desarrollo imprime el correo en el log (así puedes copiar el enlace); en producción avisa.</summary>
public sealed class CorreoConsola(ILogger<CorreoConsola> log, IHostEnvironment env) : IServicioCorreo
{
    public Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        if (env.IsDevelopment())
            log.LogInformation("[CORREO SIMULADO] Para: {Para} | Asunto: {Asunto}{Nueva}{Cuerpo}", para, asunto, Environment.NewLine, cuerpoHtml);
        else
            log.LogWarning("SMTP no configurado: no se envió el correo «{Asunto}». Define Smtp:Host para habilitarlo.", asunto);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Envío real por SMTP. Configuración: Smtp:Host, Smtp:Puerto (587), Smtp:Usuario, Smtp:Password,
/// Smtp:Remitente y Smtp:UsarSsl (true).
/// </summary>
public sealed class CorreoSmtp(IConfiguration cfg) : IServicioCorreo
{
    public async Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        var host = cfg["Smtp:Host"] ?? throw new InvalidOperationException("Falta Smtp:Host.");
        var puerto = int.TryParse(cfg["Smtp:Puerto"], out var p) ? p : 587;
        var usuario = cfg["Smtp:Usuario"];
        var remitente = cfg["Smtp:Remitente"] ?? usuario
            ?? throw new InvalidOperationException("Falta Smtp:Remitente.");

        using var cliente = new SmtpClient(host, puerto)
        {
            EnableSsl = !string.Equals(cfg["Smtp:UsarSsl"], "false", StringComparison.OrdinalIgnoreCase),
        };
        if (!string.IsNullOrEmpty(usuario))
            cliente.Credentials = new NetworkCredential(usuario, cfg["Smtp:Password"]);

        using var mensaje = new MailMessage
        {
            From = new MailAddress(remitente, "Floravia"),
            Subject = asunto,
            Body = cuerpoHtml,
            IsBodyHtml = true,
        };
        mensaje.To.Add(para);
        await cliente.SendMailAsync(mensaje, ct);
    }
}
