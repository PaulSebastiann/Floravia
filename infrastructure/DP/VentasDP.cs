using Dapper;
using Floravia.Core.Entidades;

namespace Floravia.Infrastructure.DP;

public sealed class CarritoDP(Db db)
{
    private const string Cols = "id_carrito, id_cliente, token_sesion, estado, creado_en";

    public Task<Carrito?> ObtenerAsync(int id) =>
        db.UnoAsync<Carrito>($"SELECT {Cols} FROM carrito WHERE id_carrito = @id", new { id });

    public Task<Carrito?> ObtenerActivoPorClienteAsync(int idCliente) =>
        db.UnoAsync<Carrito>(
            $"SELECT {Cols} FROM carrito WHERE id_cliente = @idCliente AND estado = 'ACTIVO'", new { idCliente });

    public Task<Carrito?> ObtenerActivoPorTokenAsync(string token) =>
        db.UnoAsync<Carrito>(
            $"SELECT {Cols} FROM carrito WHERE token_sesion = @token AND estado = 'ACTIVO'", new { token });

    public Task<int> CrearAsync(int? idCliente, string? tokenSesion) =>
        db.EscalarAsync<int>(
            "INSERT INTO carrito (id_cliente, token_sesion) VALUES (@idCliente, @tokenSesion) RETURNING id_carrito",
            new { idCliente, tokenSesion });

    public Task<int> CambiarEstadoAsync(int idCarrito, string estado) =>
        db.EjecutarAsync("UPDATE carrito SET estado = @estado WHERE id_carrito = @idCarrito", new { idCarrito, estado });

    public Task<List<ItemCarrito>> ListarItemsAsync(int idCarrito) =>
        db.ListarAsync<ItemCarrito>("""
            SELECT i.id_item, i.id_carrito, i.id_producto, i.cantidad, i.precio_unitario,
                   p.codigo, p.nombre, (p.stock - p.stock_reservado) AS stock_disponible,
                   (SELECT m.ruta FROM imagen_producto m WHERE m.id_producto = p.id_producto
                     ORDER BY m.es_principal DESC, m.orden, m.id_imagen LIMIT 1) AS imagen
              FROM item_carrito i JOIN producto p ON p.id_producto = i.id_producto
             WHERE i.id_carrito = @idCarrito
             ORDER BY i.id_item
            """, new { idCarrito });

    public Task<int?> CantidadDeAsync(int idCarrito, int idProducto) =>
        db.UnoAsync<int?>(
            "SELECT cantidad FROM item_carrito WHERE id_carrito = @idCarrito AND id_producto = @idProducto",
            new { idCarrito, idProducto });

    /// <summary>Inserta el producto o fija su cantidad si ya estaba en el carrito.</summary>
    public Task<int> GuardarItemAsync(int idCarrito, int idProducto, int cantidad, decimal precioUnitario) =>
        db.EjecutarAsync("""
            INSERT INTO item_carrito (id_carrito, id_producto, cantidad, precio_unitario)
            VALUES (@idCarrito, @idProducto, @cantidad, @precioUnitario)
            ON CONFLICT (id_carrito, id_producto)
            DO UPDATE SET cantidad = EXCLUDED.cantidad, precio_unitario = EXCLUDED.precio_unitario
            """, new { idCarrito, idProducto, cantidad, precioUnitario });

    public Task<int> QuitarItemAsync(int idCarrito, int idProducto) =>
        db.EjecutarAsync(
            "DELETE FROM item_carrito WHERE id_carrito = @idCarrito AND id_producto = @idProducto", new { idCarrito, idProducto });

    public Task<int> VaciarAsync(int idCarrito) =>
        db.EjecutarAsync("DELETE FROM item_carrito WHERE id_carrito = @idCarrito", new { idCarrito });

    /// <summary>Deja en el carrito el precio vigente del producto.</summary>
    public Task<int> SincronizarPreciosAsync(int idCarrito) =>
        db.EjecutarAsync("""
            UPDATE item_carrito i SET precio_unitario = p.precio
              FROM producto p
             WHERE p.id_producto = i.id_producto AND i.id_carrito = @idCarrito AND i.precio_unitario <> p.precio
            """, new { idCarrito });

    /// <summary>Pasa los items de un carrito a otro (carrito anónimo -> carrito del cliente), sumando cantidades.</summary>
    public Task<int> MoverItemsAsync(int idOrigen, int idDestino) =>
        db.EjecutarAsync("""
            INSERT INTO item_carrito (id_carrito, id_producto, cantidad, precio_unitario)
            SELECT @idDestino, id_producto, cantidad, precio_unitario FROM item_carrito WHERE id_carrito = @idOrigen
            ON CONFLICT (id_carrito, id_producto)
            DO UPDATE SET cantidad = item_carrito.cantidad + EXCLUDED.cantidad
            """, new { idOrigen, idDestino });
}

public sealed class PedidoDP(Db db)
{
    private const string Cols = "p.id_pedido, p.numero, p.id_cliente, p.id_direccion, p.fecha, p.subtotal, p.iva, p.costo_envio, p.total, p.estado";

    // ---------- Escritura ----------

    /// <summary>Inserta el pedido con un número temporal; <see cref="AsignarNumeroAsync"/> pone el definitivo.</summary>
    public Task<int> InsertarAsync(Pedido p) =>
        db.EscalarAsync<int>("""
            INSERT INTO pedido (numero, id_cliente, id_direccion, subtotal, iva, costo_envio, total, estado)
            VALUES ('TMP-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
                    @IdCliente, @IdDireccion, @Subtotal, @Iva, @CostoEnvio, @Total, @Estado)
            RETURNING id_pedido
            """, p);

    /// <summary>Número legible: FLV-AAAAMMDD-000123 (19 caracteres, el campo admite 20).</summary>
    public Task<string?> AsignarNumeroAsync(int idPedido) =>
        db.UnoAsync<string>("""
            UPDATE pedido
               SET numero = 'FLV-' || to_char(fecha, 'YYYYMMDD') || '-' || lpad(id_pedido::text, 6, '0')
             WHERE id_pedido = @idPedido
            RETURNING numero
            """, new { idPedido });

    public Task<int> InsertarDetalleAsync(DetallePedido d) =>
        db.EscalarAsync<int>("""
            INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
            VALUES (@IdPedido, @IdProducto, @Cantidad, @PrecioUnitario, @Subtotal)
            RETURNING id_detalle
            """, d);

    /// <summary>Cambia el estado solo si el pedido está en uno de los estados de origen indicados.</summary>
    public Task<int> CambiarEstadoAsync(int idPedido, string nuevo, string desdeA, string? desdeB = null) =>
        db.EjecutarAsync("""
            UPDATE pedido SET estado = @nuevo
             WHERE id_pedido = @idPedido AND (estado = @desdeA OR estado = @desdeB)
            """, new { idPedido, nuevo, desdeA, desdeB });

    // ---------- Consultas ----------

    public Task<Pedido?> ObtenerAsync(int idPedido) =>
        db.UnoAsync<Pedido>($"SELECT {Cols} FROM pedido p WHERE p.id_pedido = @idPedido", new { idPedido });

    public Task<Pedido?> ObtenerPorNumeroAsync(string numero) =>
        db.UnoAsync<Pedido>($"SELECT {Cols} FROM pedido p WHERE p.numero = @numero", new { numero });

    public Task<List<DetallePedido>> ListarDetallesAsync(int idPedido) =>
        db.ListarAsync<DetallePedido>("""
            SELECT d.id_detalle, d.id_pedido, d.id_producto, d.cantidad, d.precio_unitario, d.subtotal,
                   pr.codigo AS codigo_producto, pr.nombre AS nombre_producto
              FROM detalle_pedido d JOIN producto pr ON pr.id_producto = d.id_producto
             WHERE d.id_pedido = @idPedido
             ORDER BY d.id_detalle
            """, new { idPedido });

    public async Task<ResultadoPagina<Pedido>> ListarPorClienteAsync(int idCliente, int pagina, int tamano)
    {
        pagina = Math.Max(1, pagina);
        tamano = Math.Clamp(tamano, 1, 100);
        var p = new { idCliente, limite = tamano, desplazamiento = (pagina - 1) * tamano };
        var total = await db.EscalarAsync<int>("SELECT COUNT(*)::int FROM pedido WHERE id_cliente = @idCliente", p);
        var items = await db.ListarAsync<Pedido>(
            $"SELECT {Cols} FROM pedido p WHERE p.id_cliente = @idCliente ORDER BY p.fecha DESC, p.id_pedido DESC LIMIT @limite OFFSET @desplazamiento", p);
        return new ResultadoPagina<Pedido>(items, total, pagina, tamano);
    }

    /// <summary>Listado del admin con filtro por estado y búsqueda por número, correo o nombre.</summary>
    public async Task<ResultadoPagina<Pedido>> BuscarAsync(FiltroPedido f)
    {
        var pagina = Math.Max(1, f.Pagina);
        var tamano = Math.Clamp(f.TamanoPagina, 1, 100);
        var patron = string.IsNullOrWhiteSpace(f.Texto)
            ? null
            : "%" + f.Texto.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";

        var p = new { estado = f.Estado, patron, limite = tamano, desplazamiento = (pagina - 1) * tamano };
        const string desde = """
            FROM pedido p
            JOIN cliente c ON c.id_cliente = p.id_cliente
            JOIN usuario u ON u.id_usuario = c.id_usuario
            WHERE (@estado::text IS NULL OR p.estado = @estado)
              AND (@patron::text IS NULL OR p.numero ILIKE @patron OR u.correo ILIKE @patron
                   OR (c.nombres || ' ' || c.apellidos) ILIKE @patron)
            """;

        var total = await db.EscalarAsync<int>($"SELECT COUNT(*)::int {desde}", p);
        var items = await db.ListarAsync<Pedido>($"""
            SELECT {Cols}, (c.nombres || ' ' || c.apellidos) AS cliente_nombre, u.correo AS cliente_correo
            {desde}
            ORDER BY p.fecha DESC, p.id_pedido DESC
            LIMIT @limite OFFSET @desplazamiento
            """, p);
        return new ResultadoPagina<Pedido>(items, total, pagina, tamano);
    }
}

public sealed class PagoDP(Db db)
{
    private const string Cols = "id_pago, id_pedido, metodo, monto, estado, referencia_externa, ruta_comprobante, fecha_pago";

    public Task<int> InsertarAsync(Pago p) =>
        db.EscalarAsync<int>("""
            INSERT INTO pago (id_pedido, metodo, monto, referencia_externa, ruta_comprobante)
            VALUES (@IdPedido, @Metodo, @Monto, @ReferenciaExterna, @RutaComprobante)
            RETURNING id_pago
            """, p);

    public Task<Pago?> ObtenerAsync(int idPago) =>
        db.UnoAsync<Pago>($"SELECT {Cols} FROM pago WHERE id_pago = @idPago", new { idPago });

    public Task<List<Pago>> ListarPorPedidoAsync(int idPedido) =>
        db.ListarAsync<Pago>($"SELECT {Cols} FROM pago WHERE id_pedido = @idPedido ORDER BY id_pago", new { idPedido });

    /// <summary>Pagos de transferencia esperando que el admin los revise.</summary>
    public Task<List<Pago>> ListarPendientesAsync() =>
        db.ListarAsync<Pago>($"SELECT {Cols} FROM pago WHERE estado = 'PENDIENTE' ORDER BY id_pago");

    /// <summary>Cambia el estado solo si el pago estaba en <paramref name="desde"/>.</summary>
    public Task<int> CambiarEstadoAsync(int idPago, string nuevo, string desde) =>
        db.EjecutarAsync("""
            UPDATE pago
               SET estado = @nuevo,
                   fecha_pago = CASE WHEN @nuevo = 'APROBADO' THEN NOW() ELSE fecha_pago END
             WHERE id_pago = @idPago AND estado = @desde
            """, new { idPago, nuevo, desde });
}

public sealed class EntregaDP(Db db)
{
    private const string Cols = """
        id_entrega, id_pedido, direccion_entrega, fecha_programada::timestamp AS fecha_programada,
        fecha_entrega, estado, observacion
        """;

    public Task<int> InsertarAsync(int idPedido, string direccionEntrega) =>
        db.EscalarAsync<int>(
            "INSERT INTO entrega (id_pedido, direccion_entrega) VALUES (@idPedido, @direccionEntrega) RETURNING id_entrega",
            new { idPedido, direccionEntrega });

    public Task<Entrega?> ObtenerPorPedidoAsync(int idPedido) =>
        db.UnoAsync<Entrega>($"SELECT {Cols} FROM entrega WHERE id_pedido = @idPedido", new { idPedido });

    public Task<int> CambiarEstadoAsync(int idPedido, string estado, string? observacion = null) =>
        db.EjecutarAsync("""
            UPDATE entrega
               SET estado = @estado,
                   fecha_entrega = CASE WHEN @estado = 'ENTREGADA' THEN NOW() ELSE fecha_entrega END,
                   observacion = COALESCE(@observacion, observacion)
             WHERE id_pedido = @idPedido
            """, new { idPedido, estado, observacion });

    public Task<int> ProgramarAsync(int idPedido, DateTime fecha) =>
        db.EjecutarAsync(
            "UPDATE entrega SET fecha_programada = @fecha::date WHERE id_pedido = @idPedido",
            new { idPedido, fecha = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Unspecified) });
}

public sealed class ReservaDP(Db db)
{
    private const string Cols = "id_reserva, id_pedido, id_producto, cantidad, expira_en, estado";

    public Task<int> InsertarAsync(int idPedido, int idProducto, int cantidad, int minutos) =>
        db.EscalarAsync<int>("""
            INSERT INTO reserva_stock (id_pedido, id_producto, cantidad, expira_en)
            VALUES (@idPedido, @idProducto, @cantidad, NOW() + make_interval(mins => @minutos))
            RETURNING id_reserva
            """, new { idPedido, idProducto, cantidad, minutos });

    public Task<List<ReservaStock>> ListarActivasPorPedidoAsync(int idPedido) =>
        db.ListarAsync<ReservaStock>(
            $"SELECT {Cols} FROM reserva_stock WHERE id_pedido = @idPedido AND estado = 'ACTIVA' ORDER BY id_producto",
            new { idPedido });

    /// <summary>True si el pedido todavía tiene su reserva activa y sin vencer.</summary>
    public Task<bool> TieneReservaVigenteAsync(int idPedido) =>
        db.EscalarAsync<bool>(
            "SELECT EXISTS (SELECT 1 FROM reserva_stock WHERE id_pedido = @idPedido AND estado = 'ACTIVA' AND expira_en > NOW())",
            new { idPedido });

    public Task<int> CambiarEstadoPorPedidoAsync(int idPedido, string desde, string hacia) =>
        db.EjecutarAsync(
            "UPDATE reserva_stock SET estado = @hacia WHERE id_pedido = @idPedido AND estado = @desde",
            new { idPedido, desde, hacia });

    public Task<List<int>> PedidosConReservaVencidaAsync() =>
        db.ListarAsync<int>(
            "SELECT DISTINCT id_pedido FROM reserva_stock WHERE estado = 'ACTIVA' AND expira_en < NOW() ORDER BY id_pedido");
}
