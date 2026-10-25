using Floravia.Core.Entidades;
using Floravia.Application.MD.Admin;

namespace Floravia.Tests;

/// <summary>Productos, imágenes e inventario desde /admin.</summary>
[Collection("bd")]
public class ProductoAdminTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Crear_con_stock_inicial_deja_entrada_en_el_kardex()
    {
        var admin = await f.NuevoAdminAsync();
        var codigo = BaseDatosFixture.Unico();
        var id = await f.S.Productos.CrearAsync(
            new DatosProducto(await f.IdCategoriaAsync("Planta"), codigo.ToLowerInvariant(), "Ficus", "Planta de interior", "Luz indirecta", 24.90m, 3),
            stockInicial: 12, idAdmin: admin.IdAdmin);

        var p = (await f.S.Productos.ObtenerAsync(id))!.Producto;
        Assert.Equal(codigo, p.Codigo);            // el código se guarda en mayúsculas
        Assert.Equal(12, p.Stock);
        Assert.Equal(EstadoRegistro.Activo, p.Estado);

        var kardex = await f.S.Inventario.ObtenerKardexAsync(id);
        var mov = Assert.Single(kardex);
        Assert.Equal(TipoMovimiento.Entrada, mov.Tipo);
        Assert.Equal(12, mov.Saldo);
        Assert.Equal(admin.IdAdmin, mov.IdAdmin);
    }

    [Fact]
    public async Task Codigo_duplicado_se_rechaza_sin_importar_mayusculas()
    {
        var codigo = BaseDatosFixture.Unico();
        var categoria = await f.IdCategoriaAsync("Flor");
        await f.S.Productos.CrearAsync(new DatosProducto(categoria, codigo, "Uno", null, null, 5m, 0));

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Productos.CrearAsync(new DatosProducto(categoria, codigo.ToLowerInvariant(), "Dos", null, null, 5m, 0)));
        Assert.Contains("código", ex.Message);
    }

    [Theory]
    [InlineData(0, "precio")]
    [InlineData(-5, "precio")]
    public async Task Precio_invalido_se_rechaza(int precio, string palabra)
    {
        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(async () =>
            await f.S.Productos.CrearAsync(new DatosProducto(
                await f.IdCategoriaAsync("Flor"), BaseDatosFixture.Unico(), "X", null, null, precio, 0)));
        Assert.Contains(palabra, ex.Message);
    }

    [Fact]
    public async Task Categoria_inexistente_y_stock_negativo_se_rechazan()
    {
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Productos.CrearAsync(
            new DatosProducto(999999, BaseDatosFixture.Unico(), "X", null, null, 5m, 0)));
        await Assert.ThrowsAsync<ReglaNegocioException>(async () => await f.S.Productos.CrearAsync(
            new DatosProducto(await f.IdCategoriaAsync("Flor"), BaseDatosFixture.Unico(), "X", null, null, 5m, 0), stockInicial: -1));
    }

    [Fact]
    public async Task Actualizar_cambia_datos_y_colores_pero_no_toca_el_stock()
    {
        var id = await f.NuevoProductoAsync(stock: 8, colores: [await f.IdColorAsync("Rojo")]);
        var actual = (await f.S.Productos.ObtenerAsync(id))!.Producto;

        await f.S.Productos.ActualizarAsync(id,
            new DatosProducto(await f.IdCategoriaAsync("Planta"), actual.Codigo, "Nombre nuevo", "Otra descripción", null, 99.50m, 2),
            idColores: [await f.IdColorAsync("Verde"), await f.IdColorAsync("Blanco")]);

        var d = (await f.S.Productos.ObtenerAsync(id))!;
        Assert.Equal("Nombre nuevo", d.Producto.Nombre);
        Assert.Equal(99.50m, d.Producto.Precio);
        Assert.Equal("Planta", d.Producto.CategoriaNombre);
        Assert.Equal(8, d.Producto.Stock);
        Assert.Equal(new[] { "Blanco", "Verde" }, d.Colores.Select(c => c.Nombre).ToArray());
    }

    [Fact]
    public async Task Actualizar_producto_inexistente_falla()
    {
        await Assert.ThrowsAsync<NoEncontradoException>(async () => await f.S.Productos.ActualizarAsync(
            999999, new DatosProducto(await f.IdCategoriaAsync("Flor"), BaseDatosFixture.Unico(), "X", null, null, 5m, 0)));
    }

    [Fact]
    public async Task Eliminar_producto_sin_ventas_borra_todo_incluidas_las_imagenes()
    {
        var id = await f.NuevoProductoAsync(stock: 5);
        using var png = new MemoryStream(BaseDatosFixture.PngFalso());
        var imagen = await f.S.Imagenes.SubirAsync(id, png, "a.png");
        var archivo = Path.Combine(f.CarpetaImagenes, imagen.Ruta);
        Assert.True(File.Exists(archivo));

        await f.S.Productos.EliminarAsync(id);

        Assert.Null(await f.S.Productos.ObtenerAsync(id));
        Assert.False(File.Exists(archivo));
    }

    [Fact]
    public async Task Eliminar_producto_con_ventas_exige_desactivarlo()
    {
        var id = await f.NuevoProductoAsync(stock: 5);
        await f.NuevoPedidoAsync(await f.NuevoClienteAsync(), (id, 1));

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Productos.EliminarAsync(id));
        Assert.Contains("Desactívalo", ex.Message);
        Assert.NotNull(await f.S.Productos.ObtenerAsync(id));
    }
}

[Collection("bd")]
public class ImagenAdminTests(BaseDatosFixture f)
{
    private async Task<ImagenProducto> SubirAsync(int idProducto, string nombre = "foto.png", bool principal = false)
    {
        using var s = new MemoryStream(BaseDatosFixture.PngFalso());
        return await f.S.Imagenes.SubirAsync(idProducto, s, nombre, principal);
    }

    [Fact]
    public async Task La_primera_imagen_es_principal_y_el_archivo_queda_en_disco()
    {
        var id = await f.NuevoProductoAsync();

        var primera = await SubirAsync(id);
        var segunda = await SubirAsync(id);

        Assert.True(primera.EsPrincipal);
        Assert.False(segunda.EsPrincipal);
        Assert.StartsWith($"productos/{id}/", primera.Ruta);
        Assert.True(File.Exists(Path.Combine(f.CarpetaImagenes, primera.Ruta)));
        Assert.Equal(0, primera.Orden);
        Assert.Equal(1, segunda.Orden);
    }

    [Fact]
    public async Task Marcar_otra_como_principal_cambia_la_portada()
    {
        var id = await f.NuevoProductoAsync();
        var a = await SubirAsync(id);
        var b = await SubirAsync(id, principal: true); // subir con principal=true reemplaza a la anterior

        var lista = await f.S.Imagenes.ListarAsync(id);
        Assert.Equal(b.IdImagen, Assert.Single(lista, i => i.EsPrincipal).IdImagen);

        await f.S.Imagenes.MarcarPrincipalAsync(a.IdImagen);
        lista = await f.S.Imagenes.ListarAsync(id);
        Assert.Equal(a.IdImagen, Assert.Single(lista, i => i.EsPrincipal).IdImagen);
        Assert.Equal(a.Ruta, (await f.S.Productos.ObtenerAsync(id))!.Producto.ImagenPrincipal);
    }

    [Fact]
    public async Task Eliminar_la_principal_promueve_a_la_siguiente_y_borra_el_archivo()
    {
        var id = await f.NuevoProductoAsync();
        var a = await SubirAsync(id);
        var b = await SubirAsync(id);

        await f.S.Imagenes.EliminarAsync(a.IdImagen);

        var lista = await f.S.Imagenes.ListarAsync(id);
        var restante = Assert.Single(lista);
        Assert.Equal(b.IdImagen, restante.IdImagen);
        Assert.True(restante.EsPrincipal);
        Assert.False(File.Exists(Path.Combine(f.CarpetaImagenes, a.Ruta)));
    }

    [Fact]
    public async Task Reordenar_cambia_el_orden_de_la_galeria()
    {
        var id = await f.NuevoProductoAsync();
        var a = await SubirAsync(id);
        var b = await SubirAsync(id);
        var c = await SubirAsync(id);

        await f.S.Imagenes.ReordenarAsync(id, [c.IdImagen, a.IdImagen, b.IdImagen]);

        // La principal (a) siempre va primero; el resto sigue el orden indicado: c y luego b
        var orden = (await f.S.Imagenes.ListarAsync(id)).Select(i => i.IdImagen).ToArray();
        Assert.Equal(new[] { a.IdImagen, c.IdImagen, b.IdImagen }, orden);
    }

    [Theory]
    [InlineData("virus.exe")]
    [InlineData("documento.pdf")]
    [InlineData("sin_extension")]
    public async Task Extensiones_no_permitidas_se_rechazan(string nombre)
    {
        var id = await f.NuevoProductoAsync();
        using var s = new MemoryStream(BaseDatosFixture.PngFalso());
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Imagenes.SubirAsync(id, s, nombre));
    }

    [Fact]
    public async Task Un_archivo_que_no_es_imagen_renombrado_a_png_se_rechaza()
    {
        var id = await f.NuevoProductoAsync();
        using var s = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("esto es solo texto, no una imagen"));

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Imagenes.SubirAsync(id, s, "falsa.png"));
        Assert.Contains("imagen válida", ex.Message);
        Assert.Empty(await f.S.Imagenes.ListarAsync(id));
    }

    [Fact]
    public async Task Imagenes_de_mas_de_5_MB_o_vacias_se_rechazan()
    {
        var id = await f.NuevoProductoAsync();
        using var grande = new MemoryStream(BaseDatosFixture.PngFalso((int)ImagenAdminMD.TamanoMaximoBytes));
        using var vacia = new MemoryStream();

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Imagenes.SubirAsync(id, grande, "grande.png"));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Imagenes.SubirAsync(id, vacia, "vacia.png"));
    }

    [Fact]
    public async Task Subir_a_un_producto_inexistente_falla()
    {
        using var s = new MemoryStream(BaseDatosFixture.PngFalso());
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Imagenes.SubirAsync(999999, s, "a.png"));
    }

    [Fact]
    public async Task El_nombre_original_no_se_usa_para_guardar_el_archivo()
    {
        var id = await f.NuevoProductoAsync();
        var img = await SubirAsync(id, "../../etc/passwd.png");

        Assert.StartsWith($"productos/{id}/", img.Ruta);
        Assert.DoesNotContain("..", img.Ruta);
        Assert.DoesNotContain("passwd", img.Ruta);
    }
}

[Collection("bd")]
public class InventarioAdminTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Aumentar_stock_suma_y_registra_entrada_con_proveedor_y_costo()
    {
        var admin = await f.NuevoAdminAsync();
        var proveedor = await f.S.Configuracion.CrearProveedorAsync("Vivero " + BaseDatosFixture.Unico(), null, "022222222");
        var id = await f.NuevoProductoAsync(stock: 5);

        var mov = await f.S.Inventario.AumentarStockAsync(id, 7, admin.IdAdmin, proveedor.IdProveedor, 2.50m, "Compra semanal");

        Assert.Equal(12, mov.Saldo);
        Assert.Equal(12, (await f.S.Productos.ObtenerAsync(id))!.Producto.Stock);
        var kardex = await f.S.Inventario.ObtenerKardexAsync(id);
        Assert.Equal(2, kardex.Count);                                // stock inicial + esta entrada
        Assert.Equal(proveedor.Nombre, kardex[0].ProveedorNombre);     // el más reciente primero
        Assert.Equal(2.50m, kardex[0].CostoUnitario);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task Cantidades_no_positivas_se_rechazan(int cantidad)
    {
        var admin = await f.NuevoAdminAsync();
        var id = await f.NuevoProductoAsync();
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Inventario.AumentarStockAsync(id, cantidad, admin.IdAdmin));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Inventario.DisminuirStockAsync(id, cantidad, admin.IdAdmin, "merma"));
    }

    [Fact]
    public async Task Disminuir_stock_registra_salida_y_exige_motivo()
    {
        var admin = await f.NuevoAdminAsync();
        var id = await f.NuevoProductoAsync(stock: 10);

        var mov = await f.S.Inventario.DisminuirStockAsync(id, 4, admin.IdAdmin, "Plantas marchitas");

        Assert.Equal(TipoMovimiento.Salida, mov.Tipo);
        Assert.Equal(6, mov.Saldo);
        Assert.Equal(6, (await f.S.Productos.ObtenerAsync(id))!.Producto.Stock);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Inventario.DisminuirStockAsync(id, 1, admin.IdAdmin, "  "));
    }

    [Fact]
    public async Task No_se_puede_bajar_del_stock_disponible_ni_de_lo_reservado()
    {
        var admin = await f.NuevoAdminAsync();
        var id = await f.NuevoProductoAsync(stock: 5);
        await f.NuevoPedidoAsync(await f.NuevoClienteAsync(), (id, 3)); // reserva 3 → disponibles 2

        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Inventario.DisminuirStockAsync(id, 3, admin.IdAdmin, "merma"));
        Assert.Contains("reservadas", ex.Message);

        await f.S.Inventario.DisminuirStockAsync(id, 2, admin.IdAdmin, "merma");   // lo disponible sí se puede
        var p = (await f.S.Productos.ObtenerAsync(id))!.Producto;
        Assert.Equal(3, p.Stock);
        Assert.Equal(3, p.StockReservado);
        Assert.Equal(0, p.StockDisponible);
    }

    [Fact]
    public async Task Ajustar_al_conteo_fisico_registra_ajuste_positivo_o_negativo()
    {
        var admin = await f.NuevoAdminAsync();
        var id = await f.NuevoProductoAsync(stock: 10);

        var baja = await f.S.Inventario.AjustarStockAsync(id, 8, admin.IdAdmin, "Conteo físico");
        var sube = await f.S.Inventario.AjustarStockAsync(id, 15, admin.IdAdmin, "Conteo físico");

        Assert.Equal(-2, baja.Cantidad);
        Assert.Equal(7, sube.Cantidad);
        Assert.Equal(15, sube.Saldo);
        Assert.All([baja, sube], m => Assert.Equal(TipoMovimiento.Ajuste, m.Tipo));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Inventario.AjustarStockAsync(id, 15, admin.IdAdmin, "igual"));
    }

    [Fact]
    public async Task Stock_bajo_lista_productos_activos_en_o_bajo_su_minimo()
    {
        var bajo = await f.NuevoProductoAsync(stock: 2, stockMinimo: 5);
        var justo = await f.NuevoProductoAsync(stock: 5, stockMinimo: 5);
        var sano = await f.NuevoProductoAsync(stock: 20, stockMinimo: 5);
        var inactivo = await f.NuevoProductoAsync(stock: 0, stockMinimo: 5);
        await f.S.Productos.CambiarEstadoAsync(inactivo, activo: false);

        var ids = (await f.S.Inventario.ListarStockBajoAsync()).Select(p => p.IdProducto).ToList();

        Assert.Contains(bajo, ids);
        Assert.Contains(justo, ids);
        Assert.DoesNotContain(sano, ids);
        Assert.DoesNotContain(inactivo, ids);
    }

    [Fact]
    public async Task Producto_o_proveedor_inexistente_falla()
    {
        var admin = await f.NuevoAdminAsync();
        var id = await f.NuevoProductoAsync();
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Inventario.AumentarStockAsync(999999, 1, admin.IdAdmin));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Inventario.AumentarStockAsync(id, 1, admin.IdAdmin, idProveedor: 999999));
    }

    [Fact]
    public async Task Movimientos_recientes_incluyen_los_ultimos_cambios()
    {
        var admin = await f.NuevoAdminAsync();
        var id = await f.NuevoProductoAsync(stock: 3);
        await f.S.Inventario.AumentarStockAsync(id, 1, admin.IdAdmin);

        var recientes = await f.S.Inventario.ListarMovimientosRecientesAsync(10);
        Assert.Contains(recientes, m => m.IdProducto == id);
    }
}

[Collection("bd")]
public class ConfiguracionAdminTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Categorias_crear_actualizar_y_evitar_ciclos()
    {
        var padre = await f.S.CategoriasYColores.CrearCategoriaAsync("Padre " + BaseDatosFixture.Unico(), "desc");
        var hija = await f.S.CategoriasYColores.CrearCategoriaAsync("Hija " + BaseDatosFixture.Unico(), null, padre.IdCategoria);
        Assert.Equal(padre.IdCategoria, hija.IdCategoriaPadre);

        // El padre no puede colgar de su propia hija
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.CategoriasYColores.ActualizarCategoriaAsync(padre.IdCategoria, padre.Nombre, null, hija.IdCategoria));
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.CategoriasYColores.ActualizarCategoriaAsync(padre.IdCategoria, padre.Nombre, null, padre.IdCategoria));

        var editada = await f.S.CategoriasYColores.ActualizarCategoriaAsync(hija.IdCategoria, "Renombrada " + BaseDatosFixture.Unico(), "nueva", null);
        Assert.Null(editada.IdCategoriaPadre);
    }

    [Fact]
    public async Task Categorias_nombre_duplicado_y_eliminacion_con_productos()
    {
        var nombre = "Cat " + BaseDatosFixture.Unico();
        var c = await f.S.CategoriasYColores.CrearCategoriaAsync(nombre);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.CategoriasYColores.CrearCategoriaAsync(nombre));

        await f.S.Productos.CrearAsync(new DatosProducto(c.IdCategoria, BaseDatosFixture.Unico(), "P", null, null, 5m, 0));
        var ex = await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.CategoriasYColores.EliminarCategoriaAsync(c.IdCategoria));
        Assert.Contains("productos", ex.Message);

        var vacia = await f.S.CategoriasYColores.CrearCategoriaAsync("Vacía " + BaseDatosFixture.Unico());
        await f.S.CategoriasYColores.EliminarCategoriaAsync(vacia.IdCategoria);
    }

    [Fact]
    public async Task Colores_validan_formato_hex_y_unicidad()
    {
        var nombre = "Color " + BaseDatosFixture.Unico();
        var c = await f.S.CategoriasYColores.CrearColorAsync(nombre, "#A1B2C3");
        Assert.Equal("#A1B2C3", c.CodigoHex);

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.CategoriasYColores.CrearColorAsync(nombre, "#FFFFFF"));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.CategoriasYColores.CrearColorAsync("Otro " + BaseDatosFixture.Unico(), "rojo"));

        var editado = await f.S.CategoriasYColores.ActualizarColorAsync(c.IdColor, nombre + "x", null);
        Assert.Null(editado.CodigoHex);
        await f.S.CategoriasYColores.EliminarColorAsync(c.IdColor);
    }

    [Fact]
    public async Task Color_en_uso_no_se_puede_eliminar()
    {
        var color = await f.S.CategoriasYColores.CrearColorAsync("EnUso " + BaseDatosFixture.Unico(), null);
        await f.NuevoProductoAsync(colores: [color.IdColor]);

        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.CategoriasYColores.EliminarColorAsync(color.IdColor));
    }

    [Fact]
    public async Task Zonas_de_entrega_crud_y_zona_inactiva_no_admite_direcciones()
    {
        var sector = "Sector " + BaseDatosFixture.Unico();
        var zona = await f.S.Configuracion.CrearZonaAsync(sector, 5.25m);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Configuracion.CrearZonaAsync(sector, 1m));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Configuracion.CrearZonaAsync("X" + BaseDatosFixture.Unico(), -1m));

        var cliente = await f.NuevoClienteAsync();
        var dir = await f.S.Direcciones.AgregarAsync(new Direccion { IdCliente = cliente.IdCliente, IdZona = zona.IdZona, CallePrincipal = "Calle 1" });
        Assert.Equal(5.25m, dir.CostoEnvio);

        // Zona con direcciones: no se borra
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Configuracion.EliminarZonaAsync(zona.IdZona));

        await f.S.Configuracion.ActualizarZonaAsync(zona.IdZona, sector, 5.25m, activa: false);
        Assert.DoesNotContain(await f.S.Direcciones.ListarZonasAsync(), z => z.IdZona == zona.IdZona);
        await Assert.ThrowsAsync<ReglaNegocioException>(() =>
            f.S.Direcciones.AgregarAsync(new Direccion { IdCliente = cliente.IdCliente, IdZona = zona.IdZona, CallePrincipal = "Calle 2" }));
    }

    [Fact]
    public async Task Proveedores_ruc_unico_y_crud()
    {
        var ruc = Random.Shared.NextInt64(1_000_000_000_000, 10_000_000_000_000).ToString();
        var p = await f.S.Configuracion.CrearProveedorAsync("Proveedor A", ruc, null);
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Configuracion.CrearProveedorAsync("Proveedor B", ruc, null));

        var editado = await f.S.Configuracion.ActualizarProveedorAsync(p.IdProveedor, "Proveedor A2", ruc, "0991234567");
        Assert.Equal("0991234567", editado.Telefono);
        await f.S.Configuracion.EliminarProveedorAsync(p.IdProveedor);
        Assert.DoesNotContain(await f.S.Configuracion.ListarProveedoresAsync(), x => x.IdProveedor == p.IdProveedor);
    }

    [Fact]
    public async Task Parametros_validan_valor_y_el_iva_se_refleja_en_el_carrito()
    {
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Parametros.ActualizarAsync(Parametros.IvaPorcentaje, "abc"));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Parametros.ActualizarAsync(Parametros.IvaPorcentaje, "-1"));
        await Assert.ThrowsAsync<ReglaNegocioException>(() => f.S.Parametros.ActualizarAsync(Parametros.IvaPorcentaje, "150"));
        await Assert.ThrowsAsync<NoEncontradoException>(() => f.S.Parametros.ActualizarAsync("NO_EXISTE", "1"));

        var cliente = await f.NuevoClienteAsync();
        var producto = await f.NuevoProductoAsync(precio: 100m);
        var carrito = await f.S.Carrito.ObtenerOCrearAsync(cliente.IdCliente, null);
        try
        {
            await f.S.Parametros.ActualizarAsync(Parametros.IvaPorcentaje, "12");
            var vista = await f.S.Carrito.AgregarAsync(carrito.IdCarrito, producto, 1);
            Assert.Equal(12m, vista.PorcentajeIva);
            Assert.Equal(12m, vista.Iva);
        }
        finally
        {
            await f.S.Parametros.ActualizarAsync(Parametros.IvaPorcentaje, "15"); // dejar el valor original
        }
    }
}
