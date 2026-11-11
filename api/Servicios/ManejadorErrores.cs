using Floravia.Core;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Api.Servicios;

/// <summary>
/// Convierte cualquier excepción en una respuesta JSON uniforme (application/problem+json):
/// { status, title, detail, traceId }. Las reglas de negocio llegan al cliente con su mensaje legible;
/// los errores inesperados NUNCA filtran detalles internos (solo se registran en el log).
/// </summary>
public sealed class ManejadorErrores(ILogger<ManejadorErrores> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        // El cliente cerró la conexión: no hay a quién responder.
        if (ex is OperationCanceledException && ctx.RequestAborted.IsCancellationRequested) return true;

        var (estado, titulo, detalle) = ex switch
        {
            NoEncontradoException e => (StatusCodes.Status404NotFound, "No encontrado", e.Message),
            ReglaNegocioException e => (StatusCodes.Status400BadRequest, "Solicitud no válida", e.Message),
            BadHttpRequestException e => (e.StatusCode, "Solicitud no válida",
                "El cuerpo o los parámetros de la solicitud no son válidos."),
            InvalidDataException => (StatusCodes.Status400BadRequest, "Solicitud no válida",
                "El archivo o formulario enviado es demasiado grande o está mal formado."),
            UnauthorizedAccessException e => (StatusCodes.Status403Forbidden, "Acceso denegado", e.Message),
            NpgsqlException and not PostgresException => (StatusCodes.Status503ServiceUnavailable,
                "Servicio no disponible", "No hay conexión con la base de datos. Inténtalo en unos minutos."),
            _ => (StatusCodes.Status500InternalServerError, "Error interno",
                "Ocurrió un error inesperado. Inténtalo de nuevo."),
        };

        if (estado >= 500) log.LogError(ex, "Error no controlado en {Metodo} {Ruta}", ctx.Request.Method, ctx.Request.Path);
        else log.LogInformation("{Titulo}: {Detalle} ({Metodo} {Ruta})", titulo, detalle, ctx.Request.Method, ctx.Request.Path);

        var problema = new ProblemDetails { Status = estado, Title = titulo, Detail = detalle };
        problema.Extensions["traceId"] = ctx.TraceIdentifier;

        ctx.Response.StatusCode = estado;
        await ctx.Response.WriteAsJsonAsync(problema, options: null, contentType: "application/problem+json", cancellationToken: ct);
        return true;
    }
}
