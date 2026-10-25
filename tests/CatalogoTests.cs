using Floravia.Core.Entidades;
using Floravia.Application.MD.Admin;

namespace Floravia.Tests;

/// <summary>Consultas del front: lo que ve el cliente en la tienda.</summary>
[Collection("bd")]
public class CatalogoTests(BaseDatosFixture f)
{
    [Fact]
    public async Task Filtrar_por_categoria_padre_incluye_subcategorias()
    {
        var token = BaseDatosFixture.Unico("N");
        var bonsai = await f.NuevoProductoAsync("Bonsai", nombre: $"Bonsai {token}");
        var flor = await f.NuevoProductoAsync("Flor", nombre: $"Flor {token}");

        // "Bonsai" es hija de "Planta": al filtrar por Planta debe aparecer el bonsái, pero no la flor
        var r = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto
        {
            IdCategoria = await f.IdCategoriaAsync("Planta"), Texto = token,
        });

        Assert.Contains(r.Items, p => p.IdProducto == bonsai);
        Assert.DoesNotContain(r.Items, p => p.IdProducto == flor);
    }

    [Fact]
    public async Task Buscar_por_texto_y_rango_de_precio()
    {
        var token = BaseDatosFixture.Unico("B");
        await f.NuevoProductoAsync(precio: 5m, nombre: $"Rosa {token}");
        var medio = await f.NuevoProductoAsync(precio: 15m, nombre: $"Rosa {token}");
        await f.NuevoProductoAsync(precio: 25m, nombre: $"Rosa {token}");

        var r = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto
        {
            Texto = token.ToLowerInvariant(), PrecioMin = 10m, PrecioMax = 20m, // la búsqueda ignora mayúsculas
        });

        var unico = Assert.Single(r.Items);
        Assert.Equal(medio, unico.IdProducto);
        Assert.Equal("Flor", unico.CategoriaNombre);
    }

    [Fact]
    public async Task Buscar_con_caracteres_comodin_no_devuelve_todo()
    {
        await f.NuevoProductoAsync();
        var r = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto { Texto = "%" });
        Assert.Empty(r.Items); // "%" se trata como texto literal, no como comodín
    }

    [Fact]
    public async Task Filtrar_por_color()
    {
        var token = BaseDatosFixture.Unico("C");
        var rojo = await f.IdColorAsync("Rojo");
        var conRojo = await f.NuevoProductoAsync(nombre: $"Flor {token}", colores: [rojo]);
        await f.NuevoProductoAsync(nombre: $"Flor {token}");

        var r = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto { Texto = token, IdColor = rojo });

        Assert.Equal(conRojo, Assert.Single(r.Items).IdProducto);
    }

    [Fact]
    public async Task Paginacion_y_orden_por_precio()
    {
        var token = BaseDatosFixture.Unico("P");
        for (var i = 1; i <= 5; i++) await f.NuevoProductoAsync(precio: i * 10m, nombre: $"Planta {token}");

        var pagina3 = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto
        {
            Texto = token, Orden = "precio_asc", Pagina = 3, TamanoPagina = 2,
        });

        Assert.Equal(5, pagina3.Total);
        Assert.Equal(3, pagina3.TotalPaginas);
        Assert.Equal(50m, Assert.Single(pagina3.Items).Precio); // 10,20 | 30,40 | 50

        var desc = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto { Texto = token, Orden = "precio_desc" });
        Assert.Equal(new[] { 50m, 40m, 30m, 20m, 10m }, desc.Items.Select(p => p.Precio).ToArray());
    }

    [Fact]
    public async Task La_tienda_oculta_productos_inactivos_pero_el_admin_los_ve()
    {
        var token = BaseDatosFixture.Unico("I");
        var id = await f.NuevoProductoAsync(nombre: $"Oculto {token}");
        await f.S.Productos.CambiarEstadoAsync(id, activo: false);

        var tienda = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto { Texto = token, SoloActivos = false });
        Assert.Empty(tienda.Items);                       // aunque pida inactivos, la tienda los ignora
        Assert.Null(await f.S.Catalogo.ObtenerDetalleAsync(id));

        var admin = await f.S.Productos.ListarAsync(new FiltroProducto { Texto = token });
        Assert.Single(admin.Items);
    }

    [Fact]
    public async Task Solo_con_stock_excluye_agotados_y_reservados()
    {
        var token = BaseDatosFixture.Unico("S");
        var agotado = await f.NuevoProductoAsync(stock: 0, nombre: $"Semilla {token}");
        var conStock = await f.NuevoProductoAsync(stock: 4, nombre: $"Semilla {token}");

        var r = await f.S.Catalogo.ListarProductosAsync(new FiltroProducto { Texto = token, SoloConStock = true });

        Assert.Equal(conStock, Assert.Single(r.Items).IdProducto);
        Assert.DoesNotContain(r.Items, p => p.IdProducto == agotado);
    }

    [Fact]
    public async Task Detalle_trae_imagenes_colores_y_relacionados()
    {
        var token = BaseDatosFixture.Unico("D");
        var rojo = await f.IdColorAsync("Rojo");
        var azul = await f.IdColorAsync("Azul");
        var id = await f.NuevoProductoAsync("Semilla", nombre: $"Semilla {token}", colores: [rojo, azul]);
        var vecino = await f.NuevoProductoAsync("Semilla", nombre: $"Semilla vecina {token}");
        using var png = new MemoryStream(BaseDatosFixture.PngFalso());
        await f.S.Imagenes.SubirAsync(id, png, "foto.png");

        var detalle = await f.S.Catalogo.ObtenerDetalleAsync(id);
        var relacionados = await f.S.Catalogo.ListarRelacionadosAsync(id, 50);

        Assert.NotNull(detalle);
        Assert.Equal(2, detalle!.Colores.Count);
        Assert.Single(detalle.Imagenes);
        Assert.NotNull(detalle.Producto.ImagenPrincipal);
        Assert.Contains(relacionados, p => p.IdProducto == vecino);
        Assert.DoesNotContain(relacionados, p => p.IdProducto == id);
    }

    [Fact]
    public async Task Detalle_por_codigo_y_listas_auxiliares()
    {
        var id = await f.NuevoProductoAsync();
        var codigo = (await f.S.Productos.ObtenerAsync(id))!.Producto.Codigo;

        Assert.Equal(id, (await f.S.Catalogo.ObtenerDetallePorCodigoAsync(codigo))!.Producto.IdProducto);
        Assert.Null(await f.S.Catalogo.ObtenerDetallePorCodigoAsync("NO-EXISTE"));
        Assert.True((await f.S.Catalogo.ListarCategoriasAsync()).Count >= 4);
        Assert.True((await f.S.Catalogo.ListarColoresAsync()).Count >= 8);
        Assert.NotEmpty(await f.S.Catalogo.ListarNovedadesAsync(3));
    }
}
