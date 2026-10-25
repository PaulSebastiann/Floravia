using Floravia.Infrastructure.DP;
using Floravia.Core.Entidades;

namespace Floravia.Application.MD.Tienda;

/// <summary>Carrito de compras. Funciona para clientes con sesión (idCliente) y para visitantes (token de sesión).</summary>
public sealed class CarritoMD(Db db, CarritoDP carritos, ProductoDP productos, ParametrosMD parametros)
{
    public async Task<Carrito> ObtenerOCrearAsync(int? idCliente, string? tokenSesion)
    {
        if (idCliente is null && string.IsNullOrWhiteSpace(tokenSesion))
            throw new ReglaNegocioException("Se necesita un cliente o un token de sesión para el carrito.");

        var existente = await BuscarActivoAsync(idCliente, tokenSesion);
        if (existente is not null) return existente;

        try
        {
            var id = await carritos.CrearAsync(idCliente, idCliente is null ? tokenSesion : null);
            return (await carritos.ObtenerAsync(id))!;
        }
        catch (Exception e) when (Db.EsViolacionUnica(e))
        {
            // Dos peticiones simultáneas intentaron crearlo: usamos el que ganó
            return (await BuscarActivoAsync(idCliente, tokenSesion))!;
        }
    }

    private Task<Carrito?> BuscarActivoAsync(int? idCliente, string? tokenSesion) =>
        idCliente is int c
            ? carritos.ObtenerActivoPorClienteAsync(c)
            : carritos.ObtenerActivoPorTokenAsync(tokenSesion!);

    public async Task<CarritoVista> VerAsync(int idCarrito)
    {
        var carrito = await carritos.ObtenerAsync(idCarrito)
            ?? throw new NoEncontradoException("Carrito no encontrado.");

        await carritos.SincronizarPreciosAsync(idCarrito); // el carrito siempre muestra el precio vigente
        var items = await carritos.ListarItemsAsync(idCarrito);
        var subtotal = items.Sum(i => i.Subtotal);
        var porcentaje = await parametros.IvaAsync();
        var iva = Montos.CalcularIva(subtotal, porcentaje);

        return new CarritoVista
        {
            Carrito = carrito,
            Items = items,
            Subtotal = subtotal,
            PorcentajeIva = porcentaje,
            Iva = iva,
            TotalSinEnvio = subtotal + iva,
        };
    }

    /// <summary>Suma <paramref name="cantidad"/> unidades del producto al carrito.</summary>
    public async Task<CarritoVista> AgregarAsync(int idCarrito, int idProducto, int cantidad)
    {
        Validar.Positivo(cantidad, "La cantidad");
        var actual = await carritos.CantidadDeAsync(idCarrito, idProducto) ?? 0;
        return await FijarCantidadAsync(idCarrito, idProducto, actual + cantidad);
    }

    /// <summary>Fija la cantidad exacta. Con 0 o menos, el producto se quita del carrito.</summary>
    public async Task<CarritoVista> EstablecerCantidadAsync(int idCarrito, int idProducto, int cantidad)
    {
        if (cantidad <= 0) return await QuitarAsync(idCarrito, idProducto);
        return await FijarCantidadAsync(idCarrito, idProducto, cantidad);
    }

    private async Task<CarritoVista> FijarCantidadAsync(int idCarrito, int idProducto, int cantidad)
    {
        var carrito = await carritos.ObtenerAsync(idCarrito)
            ?? throw new NoEncontradoException("Carrito no encontrado.");
        if (carrito.Estado != EstadoCarrito.Activo)
            throw new ReglaNegocioException("Este carrito ya no está activo.");

        var producto = await productos.ObtenerAsync(idProducto);
        if (producto is null || producto.Estado != EstadoRegistro.Activo)
            throw new NoEncontradoException("El producto no está disponible.");
        if (cantidad > producto.StockDisponible)
            throw new ReglaNegocioException(
                $"Solo hay {producto.StockDisponible} unidades disponibles de «{producto.Nombre}».");

        await carritos.GuardarItemAsync(idCarrito, idProducto, cantidad, producto.Precio);
        return await VerAsync(idCarrito);
    }

    public async Task<CarritoVista> QuitarAsync(int idCarrito, int idProducto)
    {
        await carritos.QuitarItemAsync(idCarrito, idProducto);
        return await VerAsync(idCarrito);
    }

    public async Task<CarritoVista> VaciarAsync(int idCarrito)
    {
        await carritos.VaciarAsync(idCarrito);
        return await VerAsync(idCarrito);
    }

    /// <summary>Al iniciar sesión: el carrito del visitante se une al carrito del cliente.</summary>
    public async Task<Carrito> FusionarAnonimoAsync(string tokenSesion, int idCliente)
    {
        var anonimo = await carritos.ObtenerActivoPorTokenAsync(tokenSesion);
        var destino = await ObtenerOCrearAsync(idCliente, null);
        if (anonimo is null) return destino;

        await db.TransaccionAsync(async () =>
        {
            await carritos.MoverItemsAsync(anonimo.IdCarrito, destino.IdCarrito);
            await carritos.VaciarAsync(anonimo.IdCarrito);
            await carritos.CambiarEstadoAsync(anonimo.IdCarrito, EstadoCarrito.Abandonado);
        });
        return destino;
    }
}
