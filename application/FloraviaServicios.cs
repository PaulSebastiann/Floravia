using Floravia.Infrastructure.DP;
using Floravia.Application.MD;
using Floravia.Application.MD.Admin;
using Floravia.Application.MD.Tienda;

namespace Floravia.Application;

/// <summary>
/// Arma todas las capas (Db → DP → MD) en un solo lugar. En la API se registrará una vez (ver README).
/// Las propiedades de "Tienda" son para el front público; las de "Admin" para /admin.
/// </summary>
public sealed class FloraviaServicios
{
    public Db Db { get; }

    // ----- Tienda (front) -----
    public CatalogoMD Catalogo { get; }
    public CarritoMD Carrito { get; }
    public CuentaMD Cuenta { get; }
    public DireccionMD Direcciones { get; }
    public PedidoMD Pedidos { get; }

    // ----- Admin (/admin) -----
    public ProductoAdminMD Productos { get; }
    public ImagenAdminMD Imagenes { get; }
    public InventarioAdminMD Inventario { get; }
    public CatalogoAdminMD CategoriasYColores { get; }
    public ConfiguracionAdminMD Configuracion { get; }
    public PedidoAdminMD PedidosAdmin { get; }
    public UsuariosAdminMD Usuarios { get; }
    public DashboardMD Dashboard { get; }

    // ----- Compartido -----
    public ParametrosMD Parametros { get; }
    public StockMD Stock { get; }

    public FloraviaServicios(string cadenaConexion, IAlmacenArchivos almacen)
    {
        Db = new Db(cadenaConexion);

        // DP: acceso a datos
        var categoriaDP = new CategoriaDP(Db);
        var colorDP = new ColorDP(Db);
        var productoDP = new ProductoDP(Db);
        var imagenDP = new ImagenDP(Db);
        var usuarioDP = new UsuarioDP(Db);
        var clienteDP = new ClienteDP(Db);
        var adminDP = new AdministradorDP(Db);
        var zonaDP = new ZonaEntregaDP(Db);
        var direccionDP = new DireccionDP(Db);
        var parametroDP = new ParametroDP(Db);
        var auditoriaDP = new AuditoriaDP(Db);
        var carritoDP = new CarritoDP(Db);
        var pedidoDP = new PedidoDP(Db);
        var pagoDP = new PagoDP(Db);
        var entregaDP = new EntregaDP(Db);
        var reservaDP = new ReservaDP(Db);
        var movimientoDP = new MovimientoDP(Db);
        var proveedorDP = new ProveedorDP(Db);
        var dashboardDP = new DashboardDP(Db);

        // MD compartido
        Parametros = new ParametrosMD(parametroDP);
        Stock = new StockMD(Db, productoDP, reservaDP, movimientoDP, pedidoDP, pagoDP, Parametros);

        // MD tienda
        Catalogo = new CatalogoMD(productoDP, categoriaDP, colorDP, imagenDP);
        Carrito = new CarritoMD(Db, carritoDP, productoDP, Parametros);
        Cuenta = new CuentaMD(Db, usuarioDP, clienteDP, adminDP, auditoriaDP, Parametros);
        Direcciones = new DireccionMD(Db, direccionDP, zonaDP);
        Pedidos = new PedidoMD(Db, carritoDP, direccionDP, zonaDP, pedidoDP, pagoDP, entregaDP, reservaDP, Stock, Parametros);

        // MD admin
        Productos = new ProductoAdminMD(Db, productoDP, colorDP, movimientoDP, imagenDP, almacen);
        Imagenes = new ImagenAdminMD(Db, imagenDP, productoDP, almacen);
        Inventario = new InventarioAdminMD(Db, productoDP, movimientoDP, proveedorDP);
        CategoriasYColores = new CatalogoAdminMD(categoriaDP, colorDP);
        Configuracion = new ConfiguracionAdminMD(zonaDP, proveedorDP);
        PedidosAdmin = new PedidoAdminMD(Db, pedidoDP, pagoDP, entregaDP, reservaDP, Stock);
        Usuarios = new UsuariosAdminMD(Db, usuarioDP, adminDP, clienteDP);
        Dashboard = new DashboardMD(dashboardDP, productoDP);
    }
}
