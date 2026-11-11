using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Floravia.Core.Entidades;

namespace Floravia.Tests;

/// <summary>
/// Pruebas de INTEGRACIÓN de la API: arrancan el servidor real en memoria y hacen peticiones HTTP de verdad
/// contra la base de pruebas (seguridad, formato de errores, carrito, compra, pagos, panel de administración).
/// </summary>
[Collection("bd")]
public class ApiTests(BaseDatosFixture f)
{
    // ───────────── Ayudantes ─────────────

    private HttpClient Anonimo() => f.Api.CreateClient();

    private static async Task<JsonElement> Json(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>Falla mostrando el cuerpo de la respuesta, para que el error sea fácil de entender.</summary>
    private static async Task Esperar(HttpResponseMessage r, HttpStatusCode esperado)
    {
        if (r.StatusCode == esperado) return;
        Assert.Fail($"Se esperaba {(int)esperado} pero fue {(int)r.StatusCode}: {await r.Content.ReadAsStringAsync()}");
    }

    private static void ConSesion(HttpClient http, string token) =>
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    private static string CorreoUnico() => $"{BaseDatosFixture.Unico("api").ToLowerInvariant()}@prueba.com";

    private static object DatosRegistro(string correo) => new
    {
        correo,
        password = BaseDatosFixture.PasswordPrueba,
        cedula = Random.Shared.NextInt64(1_000_000_000, 10_000_000_000).ToString(),
        nombres = "Ana",
        apellidos = "Prueba",
        telefono = "0999999999",
    };

    /// <summary>Registra un cliente por la API y devuelve un HttpClient ya autenticado.</summary>
    private async Task<HttpClient> ClienteAsync()
    {
        var http = Anonimo();
        var r = await http.PostAsJsonAsync("/api/auth/registro", DatosRegistro(CorreoUnico()));
        await Esperar(r, HttpStatusCode.Created);
        ConSesion(http, (await Json(r)).GetProperty("token").GetString()!);
        return http;
    }

    private async Task<HttpClient> AdminAsync()
    {
        var correo = CorreoUnico();
        await f.S.Usuarios.CrearAdministradorAsync(correo, BaseDatosFixture.PasswordPrueba, "Admin", "Api", "Gerente");
        var http = Anonimo();
        var r = await http.PostAsJsonAsync("/api/auth/login", new { correo, password = BaseDatosFixture.PasswordPrueba });
        await Esperar(r, HttpStatusCode.OK);
        ConSesion(http, (await Json(r)).GetProperty("token").GetString()!);
        return http;
    }

    /// <summary>Cliente con dirección, un producto en el carrito y el pedido creado (pendiente de pago).</summary>
    private async Task<(HttpClient http, int idPedido, int idProducto)> PedidoPendienteAsync(int stock = 10, int cantidad = 2)
    {
        var http = await ClienteAsync();
        var idProducto = await f.NuevoProductoAsync(precio: 10m, stock: stock);

        var zonas = await http.GetFromJsonAsync<JsonElement>("/api/zonas-entrega");
        var idZona = zonas[0].GetProperty("idZona").GetInt32();
        var dir = await http.PostAsJsonAsync("/api/cuenta/direcciones",
            new { idZona, callePrincipal = "Av. Prueba N1", ciudad = "Quito", esPrincipal = true });
        await Esperar(dir, HttpStatusCode.Created);
        var idDireccion = (await Json(dir)).GetProperty("idDireccion").GetInt32();

        await Esperar(await http.PostAsJsonAsync("/api/carrito/items", new { idProducto, cantidad }), HttpStatusCode.OK);

        var pedido = await http.PostAsJsonAsync("/api/pedidos", new { idDireccion });
        await Esperar(pedido, HttpStatusCode.Created);
        return (http, (await Json(pedido)).GetProperty("idPedido").GetInt32(), idProducto);
    }

    private static object Tarjeta(string numero = "4242 4242 4242 4242") => new
    {
        numero, titular = "Ana Prueba", mesVencimiento = 12, anioVencimiento = DateTime.Today.Year + 2, cvv = "123",
    };

    private static MultipartFormDataContent Archivo(string campo, string nombre, byte[] bytes, string tipo)
    {
        var form = new MultipartFormDataContent();
        var contenido = new ByteArrayContent(bytes);
        contenido.Headers.ContentType = new MediaTypeHeaderValue(tipo);
        form.Add(contenido, campo, nombre);
        return form;
    }

    // ───────────── Salud y formato general ─────────────

    [Fact]
    public async Task Health_y_ready_responden_ok_con_base_de_datos()
    {
        var http = Anonimo();
        await Esperar(await http.GetAsync("/health"), HttpStatusCode.OK);
        var ready = await http.GetAsync("/health/ready");
        await Esperar(ready, HttpStatusCode.OK);
        Assert.Equal("ok", (await Json(ready)).GetProperty("baseDatos").GetString());
    }

    [Fact]
    public async Task Los_errores_de_negocio_usan_problem_details()
    {
        var r = await Anonimo().PostAsJsonAsync("/api/carrito/items", new { idProducto = 1, cantidad = 0 });
        await Esperar(r, HttpStatusCode.BadRequest);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        var cuerpo = await Json(r);
        Assert.Equal(400, cuerpo.GetProperty("status").GetInt32());
        Assert.Contains("cantidad", cuerpo.GetProperty("detail").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Las_respuestas_llevan_cabeceras_de_seguridad()
    {
        var r = await Anonimo().GetAsync("/health");
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", r.Headers.GetValues("X-Frame-Options").Single());
    }

    // ───────────── Catálogo público ─────────────

    [Fact]
    public async Task El_catalogo_publico_oculta_el_stock_interno()
    {
        var nombre = "Rosa" + BaseDatosFixture.Unico();
        var id = await f.NuevoProductoAsync(precio: 12.5m, stock: 7, stockMinimo: 3, nombre: nombre);

        var r = await Anonimo().GetAsync($"/api/productos?texto={nombre}");
        await Esperar(r, HttpStatusCode.OK);
        var pagina = await Json(r);
        Assert.Equal(1, pagina.GetProperty("total").GetInt32());

        var item = pagina.GetProperty("items")[0];
        Assert.Equal(id, item.GetProperty("idProducto").GetInt32());
        Assert.Equal(7, item.GetProperty("stockDisponible").GetInt32());
        Assert.False(item.TryGetProperty("stockMinimo", out _));
        Assert.False(item.TryGetProperty("stockReservado", out _));
    }

    [Fact]
    public async Task Un_producto_inactivo_no_se_ve_en_la_tienda()
    {
        var id = await f.NuevoProductoAsync();
        await Esperar(await Anonimo().GetAsync($"/api/productos/{id}"), HttpStatusCode.OK);

        await f.S.Productos.CambiarEstadoAsync(id, activo: false);
        await Esperar(await Anonimo().GetAsync($"/api/productos/{id}"), HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Los_parametros_de_busqueda_invalidos_no_rompen_nada()
    {
        // orden desconocido y tamaño de página absurdo: se normalizan en lugar de fallar
        var r = await Anonimo().GetAsync("/api/productos?orden=DROP%20TABLE&tamanoPagina=99999&pagina=-4");
        await Esperar(r, HttpStatusCode.OK);
        var pagina = await Json(r);
        Assert.Equal(50, pagina.GetProperty("tamanoPagina").GetInt32());
        Assert.Equal(1, pagina.GetProperty("pagina").GetInt32());
    }

    [Fact]
    public async Task Los_metodos_de_pago_publicos_incluyen_las_tarjetas_de_prueba()
    {
        var r = await Anonimo().GetAsync("/api/pagos/metodos");
        await Esperar(r, HttpStatusCode.OK);
        var metodos = (await Json(r)).GetProperty("metodos");
        Assert.Equal(2, metodos.GetArrayLength());
        Assert.True(metodos[1].GetProperty("simulado").GetBoolean());
    }

    // ───────────── Seguridad ─────────────

    [Fact]
    public async Task Las_rutas_de_admin_exigen_sesion_y_rol()
    {
        await Esperar(await Anonimo().GetAsync("/api/admin/dashboard"), HttpStatusCode.Unauthorized);
        await Esperar(await Anonimo().GetAsync("/api/pedidos"), HttpStatusCode.Unauthorized);

        var cliente = await ClienteAsync();
        await Esperar(await cliente.GetAsync("/api/admin/dashboard"), HttpStatusCode.Forbidden);

        var admin = await AdminAsync();
        await Esperar(await admin.GetAsync("/api/admin/dashboard"), HttpStatusCode.OK);
        // y el admin no es un cliente: no puede usar las rutas de compra
        await Esperar(await admin.GetAsync("/api/pedidos"), HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Registro_login_y_me_funcionan_y_rechazan_credenciales_malas()
    {
        var correo = CorreoUnico();
        var http = Anonimo();

        await Esperar(await http.PostAsJsonAsync("/api/auth/registro", DatosRegistro(correo)), HttpStatusCode.Created);
        // mismo correo otra vez
        var repetido = await http.PostAsJsonAsync("/api/auth/registro", DatosRegistro(correo));
        await Esperar(repetido, HttpStatusCode.BadRequest);
        Assert.Contains("registrado", (await Json(repetido)).GetProperty("detail").GetString());

        var mala = await http.PostAsJsonAsync("/api/auth/login", new { correo, password = "incorrecta1" });
        await Esperar(mala, HttpStatusCode.Unauthorized);

        var ok = await http.PostAsJsonAsync("/api/auth/login", new { correo, password = BaseDatosFixture.PasswordPrueba });
        await Esperar(ok, HttpStatusCode.OK);
        ConSesion(http, (await Json(ok)).GetProperty("token").GetString()!);

        var me = await http.GetAsync("/api/auth/me");
        await Esperar(me, HttpStatusCode.OK);
        Assert.Equal(correo, (await Json(me)).GetProperty("correo").GetString());
    }

    [Fact]
    public async Task La_contrasena_debil_se_rechaza_en_el_registro()
    {
        var datos = new { correo = CorreoUnico(), password = "soloLetras", cedula = "1712345678", nombres = "A", apellidos = "B", telefono = "1" };
        await Esperar(await Anonimo().PostAsJsonAsync("/api/auth/registro", datos), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Recuperar_contrasena_responde_igual_exista_o_no_el_correo()
    {
        var existente = CorreoUnico();
        await Esperar(await Anonimo().PostAsJsonAsync("/api/auth/registro", DatosRegistro(existente)), HttpStatusCode.Created);

        var a = await Anonimo().PostAsJsonAsync("/api/auth/recuperar", new { correo = existente });
        var b = await Anonimo().PostAsJsonAsync("/api/auth/recuperar", new { correo = "nadie@noexiste.com" });
        await Esperar(a, HttpStatusCode.Accepted);
        await Esperar(b, HttpStatusCode.Accepted);
        Assert.Equal(await a.Content.ReadAsStringAsync(), await b.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Un_admin_no_puede_cambiar_el_estado_de_su_propia_cuenta()
    {
        var admin = await AdminAsync();
        var me = await Json(await admin.GetAsync("/api/auth/me"));
        var r = await admin.PutAsJsonAsync($"/api/admin/usuarios/{me.GetProperty("idUsuario").GetInt32()}/estado", new { estado = "BLOQUEADO" });
        await Esperar(r, HttpStatusCode.BadRequest);
    }

    // ───────────── Carrito ─────────────

    [Fact]
    public async Task El_carrito_de_visitante_usa_un_token_del_servidor_y_se_fusiona_al_iniciar_sesion()
    {
        var id = await f.NuevoProductoAsync(precio: 5m, stock: 10);
        var visitante = Anonimo();

        var primero = await visitante.PostAsJsonAsync("/api/carrito/items", new { idProducto = id, cantidad = 2 });
        await Esperar(primero, HttpStatusCode.OK);
        var token = (await Json(primero)).GetProperty("token").GetString()!;
        Assert.Equal(48, token.Length);

        // sin el token el carrito aparece vacío; con él, trae el producto
        var vacio = await Json(await visitante.GetAsync("/api/carrito"));
        Assert.Equal(0, vacio.GetProperty("items").GetArrayLength());
        visitante.DefaultRequestHeaders.Add("X-Carrito-Token", token);
        var lleno = await Json(await visitante.GetAsync("/api/carrito"));
        Assert.Equal(2, lleno.GetProperty("items")[0].GetProperty("cantidad").GetInt32());

        // un token inventado por el cliente se ignora: no crea ni lee nada
        var falso = Anonimo();
        falso.DefaultRequestHeaders.Add("X-Carrito-Token", new string('a', 48));
        Assert.Equal(0, (await Json(await falso.GetAsync("/api/carrito"))).GetProperty("items").GetArrayLength());

        // al iniciar sesión se une con el carrito del cliente
        var cliente = await ClienteAsync();
        cliente.DefaultRequestHeaders.Add("X-Carrito-Token", token);
        var fusionado = await cliente.PostAsync("/api/carrito/fusionar", null);
        await Esperar(fusionado, HttpStatusCode.OK);
        Assert.Equal(2, (await Json(fusionado)).GetProperty("items")[0].GetProperty("cantidad").GetInt32());
    }

    [Fact]
    public async Task No_se_puede_agregar_mas_que_el_stock_disponible()
    {
        var id = await f.NuevoProductoAsync(stock: 2);
        var r = await Anonimo().PostAsJsonAsync("/api/carrito/items", new { idProducto = id, cantidad = 5 });
        await Esperar(r, HttpStatusCode.BadRequest);
        Assert.Contains("2", (await Json(r)).GetProperty("detail").GetString());
    }

    // ───────────── Compra y pagos ─────────────

    [Fact]
    public async Task Compra_con_tarjeta_aprobada_deja_el_pedido_pagado_y_descuenta_stock()
    {
        var (http, idPedido, idProducto) = await PedidoPendienteAsync(stock: 10, cantidad: 2);

        var r = await http.PostAsJsonAsync($"/api/pedidos/{idPedido}/pagos/tarjeta", Tarjeta());
        await Esperar(r, HttpStatusCode.OK);
        var cuerpo = await Json(r);
        Assert.True(cuerpo.GetProperty("aprobado").GetBoolean());
        Assert.Equal("4242", cuerpo.GetProperty("ultimos4").GetString());
        Assert.Equal("PAGADO", cuerpo.GetProperty("pedido").GetProperty("pedido").GetProperty("estado").GetString());
        Assert.DoesNotContain("4242424242424242", await r.Content.ReadAsStringAsync());

        var producto = (await f.S.Productos.ObtenerAsync(idProducto))!.Producto;
        Assert.Equal(8, producto.Stock);
        Assert.Equal(0, producto.StockReservado);
    }

    [Fact]
    public async Task Tarjeta_rechazada_responde_402_y_el_cliente_puede_reintentar()
    {
        var (http, idPedido, _) = await PedidoPendienteAsync();

        var r = await http.PostAsJsonAsync($"/api/pedidos/{idPedido}/pagos/tarjeta", Tarjeta(TarjetaSimulada.NumeroRechazada));
        await Esperar(r, HttpStatusCode.PaymentRequired);
        var cuerpo = await Json(r);
        Assert.False(cuerpo.GetProperty("aprobado").GetBoolean());
        Assert.Equal("PAGO_FALLIDO", cuerpo.GetProperty("pedido").GetProperty("pedido").GetProperty("estado").GetString());

        await Esperar(await http.PostAsJsonAsync($"/api/pedidos/{idPedido}/pagos/tarjeta", Tarjeta()), HttpStatusCode.OK);
    }

    [Fact]
    public async Task Tarjeta_con_datos_invalidos_responde_400_y_no_registra_pagos()
    {
        var (http, idPedido, _) = await PedidoPendienteAsync();

        await Esperar(await http.PostAsJsonAsync($"/api/pedidos/{idPedido}/pagos/tarjeta", Tarjeta("4242424242424241")),
            HttpStatusCode.BadRequest);

        var detalle = await Json(await http.GetAsync($"/api/pedidos/{idPedido}"));
        Assert.Equal(0, detalle.GetProperty("pagos").GetArrayLength());
        Assert.Equal("PENDIENTE_PAGO", detalle.GetProperty("pedido").GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Transferencia_con_comprobante_privado_y_aprobacion_del_admin()
    {
        var (cliente, idPedido, _) = await PedidoPendienteAsync();

        using var form = Archivo("comprobante", "pago.png", BaseDatosFixture.PngFalso(), "image/png");
        form.Add(new StringContent("TRF-12345"), "referencia");
        var subida = await cliente.PostAsync($"/api/pedidos/{idPedido}/pagos/transferencia", form);
        await Esperar(subida, HttpStatusCode.Created);

        var pago = (await Json(subida)).GetProperty("pagos")[0];
        Assert.Equal("PENDIENTE", pago.GetProperty("estado").GetString());
        var idPago = pago.GetProperty("idPago").GetInt32();
        var rutaComprobante = $"/api/pedidos/{idPedido}/pagos/{idPago}/comprobante";

        // el dueño lo descarga; otro cliente NO (el pedido no es suyo); sin sesión tampoco
        var propio = await cliente.GetAsync(rutaComprobante);
        await Esperar(propio, HttpStatusCode.OK);
        Assert.Equal("image/png", propio.Content.Headers.ContentType?.MediaType);
        await Esperar(await (await ClienteAsync()).GetAsync(rutaComprobante), HttpStatusCode.NotFound);
        await Esperar(await Anonimo().GetAsync(rutaComprobante), HttpStatusCode.Unauthorized);

        // el admin lo ve en pendientes, lo descarga y lo aprueba
        var admin = await AdminAsync();
        var pendientes = await Json(await admin.GetAsync("/api/admin/pagos/pendientes"));
        Assert.Contains(pendientes.EnumerateArray(), p => p.GetProperty("idPago").GetInt32() == idPago);
        await Esperar(await admin.GetAsync($"/api/admin/pedidos/{idPedido}/pagos/{idPago}/comprobante"), HttpStatusCode.OK);

        var aprobado = await admin.PostAsync($"/api/admin/pagos/{idPago}/aprobar", null);
        await Esperar(aprobado, HttpStatusCode.OK);
        Assert.Equal("PAGADO", (await Json(aprobado)).GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Un_comprobante_con_contenido_falso_se_rechaza()
    {
        var (cliente, idPedido, _) = await PedidoPendienteAsync();

        // un texto renombrado a .png no pasa la validación del contenido real
        using var form = Archivo("comprobante", "pago.png", "esto no es una imagen"u8.ToArray(), "image/png");
        await Esperar(await cliente.PostAsync($"/api/pedidos/{idPedido}/pagos/transferencia", form), HttpStatusCode.BadRequest);

        // y sin archivo tampoco
        using var vacio = new MultipartFormDataContent { { new StringContent("x"), "referencia" } };
        await Esperar(await cliente.PostAsync($"/api/pedidos/{idPedido}/pagos/transferencia", vacio), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task El_cliente_puede_cancelar_y_el_stock_vuelve_a_la_tienda()
    {
        var (http, idPedido, idProducto) = await PedidoPendienteAsync(stock: 10, cantidad: 3);
        Assert.Equal(3, (await f.S.Productos.ObtenerAsync(idProducto))!.Producto.StockReservado);

        var r = await http.PostAsync($"/api/pedidos/{idPedido}/cancelar", null);
        await Esperar(r, HttpStatusCode.OK);
        Assert.Equal("CANCELADO", (await Json(r)).GetProperty("pedido").GetProperty("estado").GetString());
        Assert.Equal(0, (await f.S.Productos.ObtenerAsync(idProducto))!.Producto.StockReservado);
    }

    [Fact]
    public async Task Las_reservas_vencidas_se_liberan_desde_el_panel()
    {
        var (_, idPedido, idProducto) = await PedidoPendienteAsync(stock: 10, cantidad: 2);
        await f.S.Db.EjecutarAsync("UPDATE reserva_stock SET expira_en = NOW() - INTERVAL '5 minutes' WHERE id_pedido = @idPedido", new { idPedido });

        var admin = await AdminAsync();
        var r = await admin.PostAsync("/api/admin/reservas/liberar-vencidas", null);
        await Esperar(r, HttpStatusCode.OK);
        Assert.True((await Json(r)).GetProperty("cancelados").GetInt32() >= 1);

        Assert.Equal(0, (await f.S.Productos.ObtenerAsync(idProducto))!.Producto.StockReservado);
        var detalle = await Json(await admin.GetAsync($"/api/admin/pedidos/{idPedido}"));
        Assert.Equal("CANCELADO", detalle.GetProperty("pedido").GetProperty("estado").GetString());
    }

    // ───────────── Panel de administración ─────────────

    [Fact]
    public async Task El_admin_crea_un_producto_sube_su_imagen_y_la_tienda_la_sirve()
    {
        var admin = await AdminAsync();
        var codigo = BaseDatosFixture.Unico("P");

        var crear = await admin.PostAsJsonAsync("/api/admin/productos", new
        {
            idCategoria = await f.IdCategoriaAsync("Flor"), codigo, nombre = "Orquídea " + codigo,
            precio = 25.90m, stockMinimo = 2, stockInicial = 6,
        });
        await Esperar(crear, HttpStatusCode.Created);
        var idProducto = (await Json(crear)).GetProperty("producto").GetProperty("idProducto").GetInt32();

        using var form = Archivo("archivo", "foto.png", BaseDatosFixture.PngFalso(), "image/png");
        form.Add(new StringContent("true"), "principal");
        var subida = await admin.PostAsync($"/api/admin/productos/{idProducto}/imagenes", form);
        await Esperar(subida, HttpStatusCode.Created);
        var url = (await Json(subida)).GetProperty("url").GetString()!;
        Assert.StartsWith("/media/productos/", url);

        // la tienda pública lo muestra con su imagen y el archivo se descarga sin sesión
        var detalle = await Json(await Anonimo().GetAsync($"/api/productos/{idProducto}"));
        Assert.Equal(url, detalle.GetProperty("producto").GetProperty("imagenUrl").GetString());
        var archivo = await Anonimo().GetAsync(url);
        await Esperar(archivo, HttpStatusCode.OK);
        Assert.Equal("image/png", archivo.Content.Headers.ContentType?.MediaType);

        // el stock inicial quedó en el kardex
        var kardex = await Json(await admin.GetAsync($"/api/admin/productos/{idProducto}/kardex"));
        Assert.Equal(6, kardex[0].GetProperty("saldo").GetInt32());
    }

    [Fact]
    public async Task Una_imagen_que_no_es_imagen_se_rechaza()
    {
        var admin = await AdminAsync();
        var id = await f.NuevoProductoAsync();
        using var form = Archivo("archivo", "foto.png", "no soy una imagen"u8.ToArray(), "image/png");
        await Esperar(await admin.PostAsync($"/api/admin/productos/{id}/imagenes", form), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task El_admin_mueve_stock_y_ve_el_kardex_con_su_saldo()
    {
        var admin = await AdminAsync();
        var id = await f.NuevoProductoAsync(stock: 5);

        await Esperar(await admin.PostAsJsonAsync($"/api/admin/productos/{id}/stock/entrada", new { cantidad = 10, motivo = "Compra" }), HttpStatusCode.OK);
        await Esperar(await admin.PostAsJsonAsync($"/api/admin/productos/{id}/stock/salida", new { cantidad = 3, motivo = "Daño" }), HttpStatusCode.OK);
        var exceso = await admin.PostAsJsonAsync($"/api/admin/productos/{id}/stock/salida", new { cantidad = 500, motivo = "Error" });
        await Esperar(exceso, HttpStatusCode.BadRequest);

        var kardex = await Json(await admin.GetAsync($"/api/admin/productos/{id}/kardex"));
        Assert.Equal(12, kardex[0].GetProperty("saldo").GetInt32()); // 5 + 10 - 3, el más reciente primero
    }

    [Fact]
    public async Task El_dashboard_y_los_listados_del_admin_responden()
    {
        var admin = await AdminAsync();
        foreach (var ruta in new[]
        {
            "/api/admin/dashboard", "/api/admin/productos", "/api/admin/pedidos", "/api/admin/clientes",
            "/api/admin/categorias", "/api/admin/colores", "/api/admin/zonas-entrega", "/api/admin/proveedores",
            "/api/admin/parametros", "/api/admin/inventario/stock-bajo", "/api/admin/inventario/movimientos",
        })
            await Esperar(await admin.GetAsync(ruta), HttpStatusCode.OK);
    }
}
