using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Admin;

/// <summary>Cuentas de administradores y consulta/bloqueo de clientes.</summary>
public sealed class UsuariosAdminMD(Db db, UsuarioDP usuarios, AdministradorDP administradores, ClienteDP clientes)
{
    public async Task<Administrador> CrearAdministradorAsync(
        string correo, string password, string nombres, string apellidos, string? cargo = null)
    {
        correo = Validar.Correo(correo);
        Validar.Password(password);
        var admin = new Administrador
        {
            Nombres = Validar.Texto(nombres, "Los nombres", 100),
            Apellidos = Validar.Texto(apellidos, "Los apellidos", 100),
            Cargo = Validar.TextoOpcional(cargo, "El cargo", 80),
        };
        var hash = BCrypt.Net.BCrypt.HashPassword(password);

        try
        {
            return await db.TransaccionAsync(async () =>
            {
                admin.IdUsuario = await usuarios.InsertarAsync(new Usuario { Correo = correo, PasswordHash = hash, Rol = Roles.Admin });
                admin.IdAdmin = await administradores.InsertarAsync(admin);
                return admin;
            });
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            throw new ReglaNegocioException("Ese correo ya está registrado.");
        }
    }

    public Task<ResultadoPagina<Cliente>> ListarClientesAsync(string? texto = null, int pagina = 1, int tamano = 20) =>
        clientes.ListarAsync(texto, pagina, tamano);

    public Task<Cliente?> ObtenerClienteAsync(int idCliente) => clientes.ObtenerAsync(idCliente);

    /// <summary>Activa, inactiva o bloquea una cuenta. Al reactivarla se limpian los intentos fallidos.</summary>
    public async Task CambiarEstadoUsuarioAsync(int idUsuario, string estado)
    {
        if (estado != EstadoRegistro.Activo && estado != EstadoRegistro.Inactivo && estado != EstadoRegistro.Bloqueado)
            throw new ReglaNegocioException("Estado de cuenta no válido.");
        if (await usuarios.CambiarEstadoAsync(idUsuario, estado) == 0)
            throw new NoEncontradoException("Usuario no encontrado.");
    }
}

/// <summary>Todo lo que muestra el dashboard del admin.</summary>
public sealed class DashboardMD(DashboardDP dashboard, ProductoDP productos)
{
    /// <param name="dias">Rango de la gráfica de ventas diarias (1 a 366).</param>
    /// <param name="top">Cuántos productos mostrar en "más vendidos".</param>
    public async Task<DashboardCompleto> ObtenerAsync(int dias = 30, int top = 5) => new()
    {
        Resumen = await dashboard.ResumenAsync() ?? new ResumenDashboard(),
        VentasPorDia = await dashboard.VentasPorDiaAsync(dias),
        PedidosPorEstado = await dashboard.PedidosPorEstadoAsync(),
        MasVendidos = await dashboard.MasVendidosAsync(Math.Clamp(top, 1, 50)),
        VentasPorCategoria = await dashboard.VentasPorCategoriaAsync(),
        StockBajo = (await productos.BuscarAsync(new FiltroProducto
        {
            StockBajo = true, SoloActivos = true, Orden = "nombre", TamanoPagina = 10,
        })).Items,
    };
}
