/**
 * Formas JSON EXACTAS de la API .NET (camelCase de System.Text.Json), derivadas de
 * api/Endpoints/*.cs, api/Servicios/Mapeos.cs y core/Entidades/*.cs.
 * Si cambia el backend, esto es lo primero que debe actualizarse.
 */
export interface ProblemaDto { status?: number; title?: string; detail?: string; traceId?: string }

export interface CategoriaDto { idCategoria: number; idCategoriaPadre: number | null; nombre: string; descripcion: string | null }
export interface ColorDto { idColor: number; nombre: string; codigoHex: string | null }

export interface ProductoPublicoDto {
  idProducto: number; idCategoria: number; codigo: string; nombre: string; descripcion: string | null;
  cuidados: string | null; precio: number; stockDisponible: number; categoriaNombre: string | null; imagenUrl: string | null;
  atributos: Record<string, string[]>;
}
export interface ImagenPublicaDto { idImagen: number; url: string; esPrincipal: boolean; orden: number }
export interface ProductoDetallePublicoDto { producto: ProductoPublicoDto; imagenes: ImagenPublicaDto[]; colores: ColorDto[] }
export interface PaginaProductosDto { items: ProductoPublicoDto[]; total: number; pagina: number; tamanoPagina: number; totalPaginas: number }
export interface FacetaDto { clave: string; valores: Array<{ valor: string; cantidad: number }> }

export interface ItemCarritoDto {
  idItem: number; idCarrito: number; idProducto: number; cantidad: number; precioUnitario: number; subtotal: number;
  codigo: string | null; nombre: string | null; stockDisponible: number; imagen: string | null;
}
export interface CarritoVistaDto {
  carrito: { idCarrito: number; idCliente: number | null; estado: string };
  items: ItemCarritoDto[]; subtotal: number; porcentajeIva: number; iva: number; totalSinEnvio: number;
}
/** `token` solo viene la PRIMERA vez que un visitante crea su carrito. */
export interface CarritoRespuestaDto { token: string | null; carrito: CarritoVistaDto }

export interface SesionDto { token: string; expiraEn: string; rol: string; nombre: string }

export interface ClienteDto { idCliente: number; idUsuario: number; cedula: string; nombres: string; apellidos: string; telefono: string; correo?: string | null }
export interface ZonaDto { idZona: number; sector: string; costoEnvio: number; activa: boolean }
export interface DireccionDto {
  idDireccion: number; idCliente: number; idZona: number; callePrincipal: string; calleSecundaria: string | null;
  referencia: string | null; ciudad: string; esPrincipal: boolean; activa: boolean; sector: string | null; costoEnvio: number;
}

export interface PedidoBaseDto {
  idPedido: number; numero: string; idCliente: number; idDireccion: number; fecha: string;
  subtotal: number; iva: number; costoEnvio: number; total: number; estado: string;
}
export interface DetallePedidoDto {
  idDetalle: number; idPedido: number; idProducto: number; cantidad: number; precioUnitario: number; subtotal: number;
  codigoProducto: string | null; nombreProducto: string | null;
}
export interface PagoDto {
  idPago: number; idPedido: number; metodo: string; monto: number; estado: string;
  referenciaExterna: string | null; rutaComprobante: string | null; fechaPago: string | null;
}
export interface EntregaDto { idEntrega: number; idPedido: number; direccionEntrega: string; fechaProgramada: string | null; estado: string }
export interface PedidoDetalleVistaDto { pedido: PedidoBaseDto; detalles: DetallePedidoDto[]; pagos: PagoDto[]; entrega: EntregaDto | null }

export interface MetodosPagoDto {
  metodos: Array<
    | { codigo: 'TRANSFERENCIA'; nombre: string; requiereComprobante: boolean;
        datos: { banco: string | null; tipoCuenta: string | null; numeroCuenta: string | null; titular: string | null; identificacion: string | null } }
    | { codigo: 'TARJETA'; nombre: string; simulado: boolean; aviso: string; tarjetasDePrueba: Array<{ numero: string; resultado: string }> }
  >;
}

export interface PagoTarjetaRespuestaDto {
  aprobado: boolean; mensaje: string; marca: string; ultimos4: string; pedido: PedidoDetalleVistaDto;
}

export interface PaginaPedidosDto { items: PedidoBaseDto[]; total: number; pagina: number; tamanoPagina: number; totalPaginas: number }
