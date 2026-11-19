import type { Centavos } from './dinero';

export const ESTADOS_PEDIDO = [
  'PENDIENTE_PAGO', 'PAGADO', 'EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO', 'PAGO_FALLIDO',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export type MetodoPago = 'TRANSFERENCIA' | 'TARJETA';
export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO';

export interface LineaPedido {
  readonly idProducto: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly precioUnitario: Centavos;
  readonly subtotal: Centavos;
}

export interface PagoPedido {
  readonly idPago: number;
  readonly metodo: MetodoPago;
  readonly monto: Centavos;
  readonly estado: EstadoPago;
  /** Solo para tarjeta simulada: marca y ultimos 4 (jamas el numero completo). */
  readonly tarjeta?: { readonly marca: string; readonly ultimos4: string };
  /** true si se subio comprobante. La ruta del archivo es privada y no se expone. */
  readonly tieneComprobante: boolean;
  readonly referencia?: string;
}

export interface Pedido {
  readonly idPedido: number;
  readonly numero: string;
  /** Fecha ISO tal como la entrega la API (sin zona). */
  readonly fecha: string;
  readonly subtotal: Centavos;
  readonly iva: Centavos;
  readonly costoEnvio: Centavos;
  readonly total: Centavos;
  readonly estado: EstadoPedido;
  readonly lineas: readonly LineaPedido[];
  readonly pagos: readonly PagoPedido[];
  readonly entrega?: { readonly direccion: string; readonly estado: string };
}

/** Un pedido admite (re)intentar pago mientras no este pagado ni cancelado. */
export const admitePago = (p: Pick<Pedido, 'estado' | 'pagos'>): boolean =>
  (p.estado === 'PENDIENTE_PAGO' || p.estado === 'PAGO_FALLIDO') &&
  !p.pagos.some((x) => x.estado === 'PENDIENTE' || x.estado === 'APROBADO');

/** Fila del historial: sin lineas ni pagos. */
export interface ResumenPedido {
  readonly idPedido: number;
  readonly numero: string;
  readonly fecha: string;
  readonly total: Centavos;
  readonly estado: EstadoPedido;
}

export const ETIQUETA_ESTADO: Readonly<Record<EstadoPedido, string>> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  PAGO_FALLIDO: 'Pago fallido',
};

export const ETIQUETA_METODO: Readonly<Record<MetodoPago, string>> = {
  TRANSFERENCIA: 'Transferencia bancaria',
  TARJETA: 'Tarjeta (compra simulada)',
};

/** El pedido ya esta pagado (o mas avanzado): se muestra como compra confirmada. */
export const estaConfirmado = (e: EstadoPedido): boolean =>
  e === 'PAGADO' || e === 'EN_PREPARACION' || e === 'EN_CAMINO' || e === 'ENTREGADO';
