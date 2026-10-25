using Floravia.Core.Entidades;
using Floravia.Application.MD.Admin;
using Floravia.Application.MD.Tienda;
using Npgsql;

namespace Floravia.Tests;

/// <summary>
/// Crea (si no existe) una base de datos de PRUEBAS, le aplica el esquema completo y expone los servicios.
/// Usa la variable de entorno FLORAVIA_TEST_CONN; por defecto: localhost / postgres / postgres / floravia_test.
/// Por seguridad exige que el nombre de la base contenga "test": el script del esquema borra y recrea todo.
/// </summary>
public sealed class BaseDatosFixture : IAsyncLifetime
{
    public const string PasswordPrueba = "Clave1234";

    public FloraviaServicios S { get; private set; } = null!;
    public string CarpetaImagenes { get; } =
        Path.Combine(Path.GetTempPath(), "floravia_test_" + Guid.NewGuid().ToString("N"));

    public async Task InitializeAsync()
    {
        var conexion = Environment.GetEnvironmentVariable("FLORAVIA_TEST_CONN")
            ?? "Host=localhost;Port=5432;Username=postgres;Password=postgres;Database=floravia_test";
        var b = new NpgsqlConnectionStringBuilder(conexion);
        var nombreBd = b.Database ?? "";
        if (!nombreBd.Contains("test", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"Por seguridad, la base de pruebas debe llevar «test» en su nombre (recibido: «{nombreBd}»). " +
                "El esquema borra y recrea todas las tablas.");

        // 1) Crear la base de pruebas si no existe (conectando a la base "postgres")
        var admin = new NpgsqlConnectionStringBuilder(b.ConnectionString) { Database = "postgres", Pooling = false };
        await using (var c = new NpgsqlConnection(admin.ConnectionString))
        {
            await c.OpenAsync();
            await using var existe = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @n", c);
            existe.Parameters.AddWithValue("n", nombreBd);
            if (await existe.ExecuteScalarAsync() is null)
            {
                await using var crear = new NpgsqlCommand($"CREATE DATABASE \"{nombreBd.Replace("\"", "\"\"")}\"", c);
                await crear.ExecuteNonQueryAsync();
            }
        }

        // 2) Aplicar el esquema (borra y recrea el esquema "floravia" con sus datos semilla)
        var script = await File.ReadAllTextAsync(BuscarEsquema());
        var directa = new NpgsqlConnectionStringBuilder(b.ConnectionString) { Pooling = false };
        await using (var c = new NpgsqlConnection(directa.ConnectionString))
        {
            await c.OpenAsync();
            await using var cmd = new NpgsqlCommand(script, c);
            await cmd.ExecuteNonQueryAsync();
        }

        S = new FloraviaServicios(b.ConnectionString, new AlmacenLocal(CarpetaImagenes));
    }

    /// <summary>Sube desde la carpeta de salida hasta encontrar database/01_schema.sql en la raíz del repositorio.</summary>
    private static string BuscarEsquema()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var ruta = Path.Combine(dir.FullName, "database", "01_schema.sql");
            if (File.Exists(ruta)) return ruta;
        }
        throw new FileNotFoundException("No se encontró database/01_schema.sql subiendo desde " + AppContext.BaseDirectory);
    }

    public Task DisposeAsync()
    {
        try { if (Directory.Exists(CarpetaImagenes)) Directory.Delete(CarpetaImagenes, recursive: true); }
        catch { /* limpieza best-effort */ }
        return Task.CompletedTask;
    }

    // ---------- Ayudantes para armar datos de prueba ----------

    public static string Unico(string prefijo = "T") => prefijo + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant();

    public Task<int> IdCategoriaAsync(string nombre) =>
        S.Db.EscalarAsync<int>("SELECT id_categoria FROM categoria WHERE nombre = @nombre", new { nombre });

    public Task<int> IdColorAsync(string nombre) =>
        S.Db.EscalarAsync<int>("SELECT id_color FROM color WHERE nombre = @nombre", new { nombre });

    public Task<int> IdZonaAsync(string sector) =>
        S.Db.EscalarAsync<int>("SELECT id_zona FROM zona_entrega WHERE sector = @sector", new { sector });

    public async Task<int> NuevoProductoAsync(
        string categoria = "Flor", decimal precio = 10m, int stock = 10, int stockMinimo = 0,
        string? nombre = null, IReadOnlyList<int>? colores = null)
    {
        var codigo = Unico();
        return await S.Productos.CrearAsync(
            new DatosProducto(await IdCategoriaAsync(categoria), codigo, nombre ?? $"Producto {codigo}",
                "Descripción de prueba", "Cuidados de prueba", precio, stockMinimo),
            stock, colores);
    }

    public Task<Cliente> NuevoClienteAsync() =>
        S.Cuenta.RegistrarClienteAsync(new RegistroCliente(
            $"{Unico("c").ToLowerInvariant()}@prueba.com", PasswordPrueba,
            Random.Shared.NextInt64(1_000_000_000, 10_000_000_000).ToString(),
            "Ana", "Prueba", "0999999999"));

    public async Task<Direccion> NuevaDireccionAsync(int idCliente, string sector = "Norte") =>
        await S.Direcciones.AgregarAsync(new Direccion
        {
            IdCliente = idCliente, IdZona = await IdZonaAsync(sector),
            CallePrincipal = "Av. Amazonas N10", CalleSecundaria = "Naciones Unidas", Referencia = "Edificio azul",
        });

    public async Task<Administrador> NuevoAdminAsync() =>
        await S.Usuarios.CrearAdministradorAsync(
            $"{Unico("a").ToLowerInvariant()}@floravia.com", PasswordPrueba, "Admin", "Prueba", "Gerente");

    /// <summary>Crea un pedido completo (carrito → dirección → pedido) para el cliente indicado.</summary>
    public async Task<Pedido> NuevoPedidoAsync(Cliente cliente, params (int IdProducto, int Cantidad)[] items)
    {
        var carrito = await S.Carrito.ObtenerOCrearAsync(cliente.IdCliente, null);
        foreach (var (idProducto, cantidad) in items)
            await S.Carrito.AgregarAsync(carrito.IdCarrito, idProducto, cantidad);
        var direccion = (await S.Direcciones.ListarAsync(cliente.IdCliente)).FirstOrDefault()
            ?? await NuevaDireccionAsync(cliente.IdCliente);
        return await S.Pedidos.CrearDesdeCarritoAsync(cliente.IdCliente, carrito.IdCarrito, direccion.IdDireccion);
    }

    /// <summary>Pedido con un pago de transferencia ya aprobado.</summary>
    public async Task<Pedido> NuevoPedidoPagadoAsync(Cliente cliente, params (int IdProducto, int Cantidad)[] items)
    {
        var pedido = await NuevoPedidoAsync(cliente, items);
        var pago = await S.Pedidos.RegistrarPagoAsync(
            cliente.IdCliente, pedido.IdPedido, MetodoPago.Transferencia, null, $"comprobantes/{Unico()}.jpg");
        return await S.PedidosAdmin.AprobarPagoAsync(pago.IdPago);
    }

    /// <summary>Bytes mínimos con firma de PNG: suficiente para pasar la validación de contenido.</summary>
    public static byte[] PngFalso(int extra = 0)
    {
        var b = new byte[16 + extra];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.CopyTo(b, 0);
        return b;
    }
}

[CollectionDefinition("bd")]
public sealed class ColeccionBd : ICollectionFixture<BaseDatosFixture> { }
