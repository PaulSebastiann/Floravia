import { centavos, type Centavos } from '@/domain/dinero';
import { CARRITO_VACIO, type Carrito } from '@/domain/carrito';
import type { Cliente, DatosBancarios, Direccion, MetodosPago, ZonaEntrega } from '@/domain/cuenta';
import {
  ESTADOS_PEDIDO, type EstadoPago, type EstadoPedido, type MetodoPago, type Pedido, type ResumenPedido,
} from '@/domain/pedido';
import type {
  CarritoVistaDto, ClienteDto, DireccionDto, MetodosPagoDto, PedidoBaseDto, PedidoDetalleVistaDto, ZonaDto,
} from './dto';

/** La API entrega decimales (12.50). Se convierte UNA vez, aqui, a centavos enteros. */
export function aCentavos(n: number): Centavos {
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`Monto invalido desde la API: ${n}`);
  return centavos(Math.round(n * 100));
}

/** Las rutas de imagen de la API son relativas al almacen: se sirven bajo /media/ (rewrite de Next hacia la API). */
export const urlMedia = (ruta: string | null | undefined): string | undefined => {
  if (!ruta) return undefined;
  if (ruta.startsWith('http') || ruta.startsWith('/media/') || ruta.startsWith('/images/')) return ruta;
  return `/media/${ruta.replace(/^\/+/, '')}`;
};

export function mapearCarrito(d: CarritoVistaDto | undefined): Carrito {
  if (!d) return CARRITO_VACIO;
  const lineas = d.items.map((i) => ({
    idProducto: i.idProducto,
    codigo: i.codigo ?? '',
    nombre: i.nombre ?? 'Producto',
    cantidad: i.cantidad,
    precioUnitario: aCentavos(i.precioUnitario),
    subtotal: aCentavos(i.subtotal),
    stockDisponible: i.stockDisponible,
    imagen: urlMedia(i.imagen),
  }));
  return {
    lineas,
    cantidadTotal: lineas.reduce((a, l) => a + l.cantidad, 0),
    subtotal: aCentavos(d.subtotal),
    porcentajeIva: d.porcentajeIva,
    iva: aCentavos(d.iva),
    totalSinEnvio: aCentavos(d.totalSinEnvio),
  };
}

export function mapearCliente(d: ClienteDto): Cliente {
  return {
    idCliente: d.idCliente, cedula: d.cedula, nombres: d.nombres, apellidos: d.apellidos,
    telefono: d.telefono, correo: d.correo ?? undefined,
  };
}

export const mapearZona = (z: ZonaDto): ZonaEntrega => ({
  idZona: z.idZona, sector: z.sector, costoEnvio: aCentavos(z.costoEnvio),
});

export const mapearDireccion = (d: DireccionDto): Direccion => ({
  idDireccion: d.idDireccion,
  idZona: d.idZona,
  callePrincipal: d.callePrincipal,
  calleSecundaria: d.calleSecundaria ?? undefined,
  referencia: d.referencia ?? undefined,
  ciudad: d.ciudad,
  esPrincipal: d.esPrincipal,
  sector: d.sector ?? undefined,
  costoEnvio: aCentavos(d.costoEnvio),
});

const limpiar = (v: string | null | undefined): string | undefined => (v && v.trim() ? v.trim() : undefined);

export function mapearMetodos(d: MetodosPagoDto): MetodosPago {
  let transferencia: DatosBancarios = {};
  let tarjetasDePrueba: MetodosPago['tarjetasDePrueba'] = [];
  let avisoTarjeta: string | undefined;
  for (const m of d.metodos) {
    if (m.codigo === 'TRANSFERENCIA') {
      transferencia = {
        banco: limpiar(m.datos.banco), tipoCuenta: limpiar(m.datos.tipoCuenta),
        numeroCuenta: limpiar(m.datos.numeroCuenta), titular: limpiar(m.datos.titular),
        identificacion: limpiar(m.datos.identificacion),
      };
    } else {
      tarjetasDePrueba = m.tarjetasDePrueba;
      avisoTarjeta = m.aviso;
    }
  }
  return { transferencia, tarjetasDePrueba, avisoTarjeta };
}

const ESTADOS = new Set<string>(ESTADOS_PEDIDO);

/** La API guarda `SIM-{Marca}-{Ultimos4}-{guid}` como referencia de la tarjeta simulada: solo ultimos 4. */
function tarjetaDeReferencia(ref: string | null): { marca: string; ultimos4: string } | undefined {
  const m = /^SIM-([A-Za-z]+)-(\d{4})-/.exec(ref ?? '');
  return m?.[1] && m[2] ? { marca: m[1], ultimos4: m[2] } : undefined;
}

export function mapearPedido(v: PedidoDetalleVistaDto): Pedido {
  const p = v.pedido;
  const estado: EstadoPedido = ESTADOS.has(p.estado) ? (p.estado as EstadoPedido) : 'PENDIENTE_PAGO';
  return {
    idPedido: p.idPedido,
    numero: p.numero,
    fecha: p.fecha,
    subtotal: aCentavos(p.subtotal),
    iva: aCentavos(p.iva),
    costoEnvio: aCentavos(p.costoEnvio),
    total: aCentavos(p.total),
    estado,
    lineas: v.detalles.map((d) => ({
      idProducto: d.idProducto,
      codigo: d.codigoProducto ?? '',
      nombre: d.nombreProducto ?? 'Producto',
      cantidad: d.cantidad,
      precioUnitario: aCentavos(d.precioUnitario),
      subtotal: aCentavos(d.subtotal),
    })),
    pagos: v.pagos.map((g) => ({
      idPago: g.idPago,
      metodo: g.metodo as MetodoPago,
      monto: aCentavos(g.monto),
      estado: g.estado as EstadoPago,
      tarjeta: g.metodo === 'TARJETA' ? tarjetaDeReferencia(g.referenciaExterna) : undefined,
      tieneComprobante: Boolean(g.rutaComprobante),
      // Referencia que escribio el cliente en transferencias. La de la tarjeta simulada es interna.
      referencia: g.metodo === 'TRANSFERENCIA' ? limpiar(g.referenciaExterna) : undefined,
    })),
    entrega: v.entrega ? { direccion: v.entrega.direccionEntrega, estado: v.entrega.estado } : undefined,
  };
}

export const mapearResumenPedido = (p: PedidoBaseDto): ResumenPedido => ({
  idPedido: p.idPedido,
  numero: p.numero,
  fecha: p.fecha,
  total: aCentavos(p.total),
  estado: ESTADOS.has(p.estado) ? (p.estado as EstadoPedido) : 'PENDIENTE_PAGO',
});
