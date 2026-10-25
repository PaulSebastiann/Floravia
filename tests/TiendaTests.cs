using Floravia.Core.Entidades;
using Floravia.Application.MD.Tienda;

namespace Floravia.Tests;

[Collection("bd")]
public class CuentaTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Registrar_cliente_e_iniciar_sesion()
    {
        var c = await f.NuevoClienteAsync();
        Assert.Equal("Ana", c.Nombres);

        var sesion = await f.S.Cuenta.IniciarSesionAsync(c.Correo!, BaseDatosFixture.PasswordPrueba);
        Assert.Equal(Roles.Cliente, sesion.Rol);
        Assert.Equal(c.IdCliente, sesion.IdCliente);
    }

    [Fact]
    public async Task La_contrasena_se_guarda_con_hash_nunca_en_claro()
    {
        var c = await f.NuevoClienteAsync();
        var hash = await f.S.Db.EscalarAsync<string>("SELECT password_hash FROM usuario WHERE id_usuario = @id", new { id = c.IdUsuario });
        Assert.NotEqual(BaseDatosFixture.PasswordPrueba, hash);
        Assert.StartsWith("$2", hash);
    }

    [Fact]
    public async Task Correo_o_cedula_repetidos_se_rechazan_con_mensaje_claro()
    {
        var c = await f.NuevoClienteAsync();
        var ex1 = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.RegistrarClienteAsync(
            new RegistroCliente(c.Correo!.ToUpperInvariant(), "Clave1234", "1234567890", "A", "B", "099")));
        Assert.Contains("correo", ex1.Message);

        var ex2 = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.RegistrarClienteAsync(
            new RegistroCliente("otro" + BaseDatosFixture.Unico() + "@x.com", "Clave1234", c.Cedula, "A", "B", "099")));
        Assert.Contains("cédula", ex2.Message);
    }

    [Theory]
    [InlineData("sin-arroba", "Clave1234", "1234567890")]
    [InlineData("a@b.com", "corta1", "1234567890")]
    [InlineData("a@b.com", "sinnumeros", "1234567890")]
    [InlineData("a@b.com", "Clave1234", "123")]
    public async Task Datos_invalidos_se_rechazan(string correo, string clave, string cedula)
    {
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Cuenta.RegistrarClienteAsync(new RegistroCliente(correo, clave, cedula, "A", "B", "099")));
    }

    [Fact]
    public async Task Un_registro_fallido_no_deja_el_usuario_a_medias()
    {
        var correo = $"{BaseDatosFixture.Unico("r").ToLowerInvariant()}@x.com";
        var existente = await f.NuevoClienteAsync();
        // La cédula ya existe: falla al insertar el cliente, y el usuario creado antes debe revertirse
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.RegistrarClienteAsync(
            new RegistroCliente(correo, "Clave1234", existente.Cedula, "A", "B", "099")));

        Assert.Null(await f.S.Db.UnoAsync<int?>("SELECT id_usuario FROM usuario WHERE correo = @correo", new { correo }));
    }

    [Fact]
    public async Task Cinco_intentos_fallidos_bloquean_la_cuenta_incluso_con_la_clave_correcta()
    {
        var c = await f.NuevoClienteAsync();
        for (var i = 0; i < 5; i++)
            await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.IniciarSesionAsync(c.Correo!, "incorrecta1"));

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Cuenta.IniciarSesionAsync(c.Correo!, BaseDatosFixture.PasswordPrueba));
        Assert.Contains("bloqueada", ex.Message);

        // El admin puede reactivarla (limpia el bloqueo al cambiar la contraseña)
        await f.S.Db.EjecutarAsync("UPDATE usuario SET bloqueado_hasta = NULL, intentos_fallidos = 0 WHERE id_usuario = @id", new { id = c.IdUsuario });
        Assert.NotNull(await f.S.Cuenta.IniciarSesionAsync(c.Correo!, BaseDatosFixture.PasswordPrueba));
    }

    [Fact]
    public async Task Un_login_correcto_reinicia_los_intentos()
    {
        var c = await f.NuevoClienteAsync();
        for (var i = 0; i < 3; i++)
            await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.IniciarSesionAsync(c.Correo!, "incorrecta1"));
        await f.S.Cuenta.IniciarSesionAsync(c.Correo!, BaseDatosFixture.PasswordPrueba);

        var intentos = await f.S.Db.EscalarAsync<int>("SELECT intentos_fallidos FROM usuario WHERE id_usuario = @id", new { id = c.IdUsuario });
        Assert.Equal(0, intentos);
    }

    [Fact]
    public async Task Cuenta_inactiva_o_inexistente_no_puede_entrar_y_el_mensaje_no_revela_cual()
    {
        var c = await f.NuevoClienteAsync();
        await f.S.Usuarios.CambiarEstadoUsuarioAsync(c.IdUsuario, EstadoRegistro.Inactivo);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.IniciarSesionAsync(c.Correo!, BaseDatosFixture.PasswordPrueba));

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.IniciarSesionAsync("nadie@nada.com", "Clave1234"));
        Assert.Contains("incorrectos", ex.Message);
    }

    [Fact]
    public async Task Admin_inicia_sesion_con_su_rol()
    {
        var a = await f.NuevoAdminAsync();
        var correo = await f.S.Db.EscalarAsync<string>("SELECT correo FROM usuario WHERE id_usuario = @id", new { id = a.IdUsuario });
        var sesion = await f.S.Cuenta.IniciarSesionAsync(correo!, BaseDatosFixture.PasswordPrueba);
        Assert.Equal(Roles.Admin, sesion.Rol);
        Assert.Equal(a.IdAdmin, sesion.IdAdmin);
        Assert.Null(sesion.IdCliente);
    }

    [Fact]
    public async Task Recuperar_contrasena_token_de_un_solo_uso()
    {
        var c = await f.NuevoClienteAsync();
        var token = await f.S.Cuenta.SolicitarRecuperacionAsync(c.Correo!);
        Assert.NotNull(token);

        // En la BD solo vive el hash, nunca el token
        var guardado = await f.S.Db.EscalarAsync<int>("SELECT COUNT(*)::int FROM token_recuperacion WHERE token_hash = @token", new { token });
        Assert.Equal(0, guardado);

        await f.S.Cuenta.RestablecerPasswordAsync(token!, "NuevaClave99");
        Assert.NotNull(await f.S.Cuenta.IniciarSesionAsync(c.Correo!, "NuevaClave99"));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.IniciarSesionAsync(c.Correo!, BaseDatosFixture.PasswordPrueba));

        // Reusar el mismo token falla
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.RestablecerPasswordAsync(token!, "OtraClave99"));
    }

    [Fact]
    public async Task Pedir_un_token_nuevo_invalida_el_anterior_y_correos_desconocidos_devuelven_null()
    {
        var c = await f.NuevoClienteAsync();
        var viejo = await f.S.Cuenta.SolicitarRecuperacionAsync(c.Correo!);
        var nuevo = await f.S.Cuenta.SolicitarRecuperacionAsync(c.Correo!);

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.RestablecerPasswordAsync(viejo!, "NuevaClave99"));
        await f.S.Cuenta.RestablecerPasswordAsync(nuevo!, "NuevaClave99");
        Assert.Null(await f.S.Cuenta.SolicitarRecuperacionAsync("fantasma@nada.com"));
    }

    [Fact]
    public async Task Token_expirado_no_sirve()
    {
        var c = await f.NuevoClienteAsync();
        var token = await f.S.Cuenta.SolicitarRecuperacionAsync(c.Correo!);
        await f.S.Db.EjecutarAsync("UPDATE token_recuperacion SET expira_en = NOW() - interval '1 minute' WHERE id_usuario = @id", new { id = c.IdUsuario });

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.RestablecerPasswordAsync(token!, "NuevaClave99"));
    }

    [Fact]
    public async Task Cambiar_contrasena_exige_la_actual_y_perfil_se_actualiza()
    {
        var c = await f.NuevoClienteAsync();
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Cuenta.CambiarPasswordAsync(c.IdUsuario, "mala", "NuevaClave99"));
        await f.S.Cuenta.CambiarPasswordAsync(c.IdUsuario, BaseDatosFixture.PasswordPrueba, "NuevaClave99");
        Assert.NotNull(await f.S.Cuenta.IniciarSesionAsync(c.Correo!, "NuevaClave99"));

        var perfil = await f.S.Cuenta.ActualizarPerfilAsync(c.IdCliente, "María", "López", "0981112222");
        Assert.Equal("María", perfil.Nombres);
        Assert.Equal(c.Cedula, perfil.Cedula); // la cédula no se edita
    }
}

[Collection("bd")]
public class DireccionTests(BaseDatosFixture f)
{
    [Fact]
    public async Task La_primera_direccion_es_principal_y_solo_hay_una_principal()
    {
        var c = await f.NuevoClienteAsync();
        var d1 = await f.NuevaDireccionAsync(c.IdCliente, "Norte");
        var d2 = await f.S.Direcciones.AgregarAsync(new Direccion
        {
            IdCliente = c.IdCliente, IdZona = await f.IdZonaAsync("Sur"), CallePrincipal = "Calle 2", EsPrincipal = true,
        });

        var lista = await f.S.Direcciones.ListarAsync(c.IdCliente);
        Assert.True(d1.EsPrincipal);
        Assert.Equal(d2.IdDireccion, Assert.Single(lista, d => d.EsPrincipal).IdDireccion);
        Assert.Equal(d2.IdDireccion, lista[0].IdDireccion); // la principal va primero
    }

    [Fact]
    public async Task Marcar_principal_y_baja_logica_reasigna_la_principal()
    {
        var c = await f.NuevoClienteAsync();
        var d1 = await f.NuevaDireccionAsync(c.IdCliente);
        var d2 = await f.NuevaDireccionAsync(c.IdCliente, "Centro");

        await f.S.Direcciones.MarcarPrincipalAsync(c.IdCliente, d2.IdDireccion);
        await f.S.Direcciones.EliminarAsync(c.IdCliente, d2.IdDireccion); // elimina la principal

        var lista = await f.S.Direcciones.ListarAsync(c.IdCliente);
        var restante = Assert.Single(lista);
        Assert.Equal(d1.IdDireccion, restante.IdDireccion);
        Assert.True(restante.EsPrincipal);
        // baja lógica: la fila sigue existiendo
        Assert.False((await f.S.Db.EscalarAsync<bool>("SELECT activa FROM direccion WHERE id_direccion = @id", new { id = d2.IdDireccion })));
    }

    [Fact]
    public async Task Un_cliente_no_puede_tocar_la_direccion_de_otro()
    {
        var a = await f.NuevoClienteAsync();
        var b = await f.NuevoClienteAsync();
        var dir = await f.NuevaDireccionAsync(a.IdCliente);

        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Direcciones.EliminarAsync(b.IdCliente, dir.IdDireccion));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Direcciones.MarcarPrincipalAsync(b.IdCliente, dir.IdDireccion));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Direcciones.ActualizarAsync(
            new Direccion { IdCliente = b.IdCliente, IdDireccion = dir.IdDireccion, IdZona = dir.IdZona, CallePrincipal = "Hack", Ciudad = "Quito" }));
    }

    [Fact]
    public async Task Actualizar_cambia_calle_y_zona()
    {
        var c = await f.NuevoClienteAsync();
        var d = await f.NuevaDireccionAsync(c.IdCliente, "Norte");
        d.CallePrincipal = "Nueva calle";
        d.IdZona = await f.IdZonaAsync("Valles");

        var r = await f.S.Direcciones.ActualizarAsync(d);
        Assert.Equal("Nueva calle", r.CallePrincipal);
        Assert.Equal("Valles", r.Sector);
        Assert.Equal(4.50m, r.CostoEnvio);
    }
}

[Collection("bd")]
public class CarritoTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Agregar_suma_cantidades_y_calcula_subtotal_iva_y_total()
    {
        var c = await f.NuevoClienteAsync();
        var p1 = await f.NuevoProductoAsync(precio: 10m, stock: 10);
        var p2 = await f.NuevoProductoAsync(precio: 4.50m, stock: 10);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);

        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p1, 2);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p1, 1);               // 2 + 1 = 3
        var vista = await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p2, 2);

        Assert.Equal(2, vista.Items.Count);
        Assert.Equal(3, vista.Items.Single(i => i.IdProducto == p1).Cantidad);
        Assert.Equal(39m, vista.Subtotal);            // 30 + 9
        Assert.Equal(15m, vista.PorcentajeIva);
        Assert.Equal(5.85m, vista.Iva);               // 39 * 15 %
        Assert.Equal(44.85m, vista.TotalSinEnvio);
    }

    [Fact]
    public async Task No_se_puede_superar_el_stock_disponible()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync(stock: 3);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);

        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p, 2);
        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Carrito.AgregarAsync(carrito.IdCarrito, p, 2));
        Assert.Contains("3", ex.Message);
        Assert.Equal(2, (await f.S.Carrito.VerAsync(carrito.IdCarrito)).Items.Single().Cantidad); // no cambió
    }

    [Fact]
    public async Task No_se_agregan_productos_inactivos_ni_inexistentes_ni_cantidades_invalidas()
    {
        var c = await f.NuevoClienteAsync();
        var p = await f.NuevoProductoAsync();
        await f.S.Productos.CambiarEstadoAsync(p, false);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);

        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Carrito.AgregarAsync(carrito.IdCarrito, p, 1));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Carrito.AgregarAsync(carrito.IdCarrito, 999999, 1));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Carrito.AgregarAsync(carrito.IdCarrito, p, 0));
    }

    [Fact]
    public async Task Establecer_cantidad_quitar_y_vaciar()
    {
        var c = await f.NuevoClienteAsync();
        var p1 = await f.NuevoProductoAsync(stock: 9);
        var p2 = await f.NuevoProductoAsync(stock: 9);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p1, 1);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, p2, 1);

        var v = await f.S.Carrito.EstablecerCantidadAsync(carrito.IdCarrito, p1, 5);
        Assert.Equal(5, v.Items.Single(i => i.IdProducto == p1).Cantidad);

        v = await f.S.Carrito.EstablecerCantidadAsync(carrito.IdCarrito, p1, 0); // 0 = quitar
        Assert.Single(v.Items);

        v = await f.S.Carrito.QuitarAsync(carrito.IdCarrito, p2);
        Assert.Empty(v.Items);
        Assert.Equal(0m, v.Total());
    }

    [Fact]
    public async Task El_carrito_siempre_muestra_el_precio_vigente()
    {
        var c = await f.NuevoClienteAsync();
        var admin = await f.NuevoProductoAsync(precio: 10m);
        var datos = (await f.S.Productos.ObtenerAsync(admin))!.Producto;
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        await f.S.Carrito.AgregarAsync(carrito.IdCarrito, admin, 2);

        await f.S.Productos.ActualizarAsync(admin, new DatosProducto(
            datos.IdCategoria, datos.Codigo, datos.Nombre, null, null, 12m, 0));

        var v = await f.S.Carrito.VerAsync(carrito.IdCarrito);
        Assert.Equal(12m, v.Items.Single().PrecioUnitario);
        Assert.Equal(24m, v.Subtotal);
    }

    [Fact]
    public async Task Obtener_o_crear_devuelve_siempre_el_mismo_carrito_activo()
    {
        var c = await f.NuevoClienteAsync();
        var a = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        var b = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        Assert.Equal(a.IdCarrito, b.IdCarrito);

        var token = BaseDatosFixture.Unico("tok");
        var anon1 = await f.S.Carrito.ObtenerOCrearAsync(null, token);
        var anon2 = await f.S.Carrito.ObtenerOCrearAsync(null, token);
        Assert.Equal(anon1.IdCarrito, anon2.IdCarrito);
        Assert.Null(anon1.IdCliente);

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Carrito.ObtenerOCrearAsync(null, null));
    }

    [Fact]
    public async Task Carrito_anonimo_se_fusiona_con_el_del_cliente_al_iniciar_sesion()
    {
        var c = await f.NuevoClienteAsync();
        var p1 = await f.NuevoProductoAsync(stock: 10);
        var p2 = await f.NuevoProductoAsync(stock: 10);
        var token = BaseDatosFixture.Unico("tok");

        var propio = await f.S.Carrito.ObtenerOCrearAsync(c.IdCliente, null);
        await f.S.Carrito.AgregarAsync(propio.IdCarrito, p1, 1);
        var anonimo = await f.S.Carrito.ObtenerOCrearAsync(null, token);
        await f.S.Carrito.AgregarAsync(anonimo.IdCarrito, p1, 2);   // mismo producto: se suman
        await f.S.Carrito.AgregarAsync(anonimo.IdCarrito, p2, 1);

        var destino = await f.S.Carrito.FusionarAnonimoAsync(token, c.IdCliente);

        Assert.Equal(propio.IdCarrito, destino.IdCarrito);
        var v = await f.S.Carrito.VerAsync(destino.IdCarrito);
        Assert.Equal(3, v.Items.Single(i => i.IdProducto == p1).Cantidad);
        Assert.Equal(1, v.Items.Single(i => i.IdProducto == p2).Cantidad);
        // El anónimo ya no está activo: pedir ese token crea uno nuevo y vacío
        var nuevo = await f.S.Carrito.ObtenerOCrearAsync(null, token);
        Assert.NotEqual(anonimo.IdCarrito, nuevo.IdCarrito);
    }
}

internal static class CarritoVistaExtensiones
{
    public static decimal Total(this CarritoVista v) => v.TotalSinEnvio;
}
