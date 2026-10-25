using Dapper;
using Npgsql;

namespace Floravia.Infrastructure.DP;

/// <summary>
/// Acceso a PostgreSQL. Todas las clases DP lo usan para ejecutar sus scripts SQL.
/// Si hay una transacción abierta con <see cref="TransaccionAsync{T}"/>, las consultas se ejecutan dentro de ella
/// (sin tener que pasar la conexión de método en método).
/// </summary>
public sealed class Db
{
    static Db() => DefaultTypeMap.MatchNamesWithUnderscores = true; // id_producto -> IdProducto

    private readonly NpgsqlDataSource _origen;
    private readonly AsyncLocal<Ambiente?> _ambiente = new();

    private sealed record Ambiente(NpgsqlConnection Conexion, NpgsqlTransaction Transaccion);

    public Db(string cadenaConexion)
    {
        var b = new NpgsqlConnectionStringBuilder(cadenaConexion);
        if (string.IsNullOrWhiteSpace(b.SearchPath)) b.SearchPath = "floravia";
        _origen = NpgsqlDataSource.Create(b.ConnectionString);
    }

    // ---------- Transacciones ----------

    public async Task<T> TransaccionAsync<T>(Func<Task<T>> trabajo)
    {
        if (_ambiente.Value is not null) return await trabajo(); // ya hay una: se une a ella

        await using var conexion = await _origen.OpenConnectionAsync();
        await using var tx = await conexion.BeginTransactionAsync();
        _ambiente.Value = new Ambiente(conexion, tx);
        try
        {
            var resultado = await trabajo();
            await tx.CommitAsync();
            return resultado;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
        finally
        {
            _ambiente.Value = null;
        }
    }

    public Task TransaccionAsync(Func<Task> trabajo) =>
        TransaccionAsync<bool>(async () => { await trabajo(); return true; });

    // ---------- Consultas ----------

    private async Task<R> UsarAsync<R>(Func<NpgsqlConnection, NpgsqlTransaction?, Task<R>> accion)
    {
        var a = _ambiente.Value;
        if (a is not null) return await accion(a.Conexion, a.Transaccion);

        await using var conexion = await _origen.OpenConnectionAsync();
        return await accion(conexion, null);
    }

    public Task<List<T>> ListarAsync<T>(string sql, object? parametros = null) =>
        UsarAsync(async (c, t) => (await c.QueryAsync<T>(new CommandDefinition(sql, parametros, t))).ToList());

    public Task<T?> UnoAsync<T>(string sql, object? parametros = null) =>
        UsarAsync<T?>(async (c, t) => await c.QueryFirstOrDefaultAsync<T>(new CommandDefinition(sql, parametros, t)));

    public Task<T?> EscalarAsync<T>(string sql, object? parametros = null) =>
        UsarAsync<T?>(async (c, t) => await c.ExecuteScalarAsync<T>(new CommandDefinition(sql, parametros, t)));

    /// <summary>Ejecuta INSERT/UPDATE/DELETE y devuelve las filas afectadas.</summary>
    public Task<int> EjecutarAsync(string sql, object? parametros = null) =>
        UsarAsync(async (c, t) => await c.ExecuteAsync(new CommandDefinition(sql, parametros, t)));

    // ---------- Errores de PostgreSQL ----------

    private static PostgresException? Postgres(Exception e) =>
        e as PostgresException ?? e.InnerException as PostgresException;

    public static bool EsViolacionUnica(Exception e) => Postgres(e)?.SqlState == PostgresErrorCodes.UniqueViolation;
    public static bool EsViolacionForanea(Exception e) => Postgres(e)?.SqlState == PostgresErrorCodes.ForeignKeyViolation;
    public static bool EsViolacionCheck(Exception e) => Postgres(e)?.SqlState == PostgresErrorCodes.CheckViolation;

    /// <summary>Nombre de la restricción o índice que falló (ej. "uq_producto_codigo").</summary>
    public static string? Restriccion(Exception e) => Postgres(e)?.ConstraintName;
}
