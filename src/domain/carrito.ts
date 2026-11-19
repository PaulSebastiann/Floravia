import { centavos, type Centavos } from './dinero';

export const MAX_POR_PRODUCTO = 99; // limite que impone la API (CarritoEndpoints)

export interface LineaCarrito {
  readonly idProducto: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly precioUnitario: Centavos;
  readonly subtotal: Centavos;
  readonly stockDisponible: number;
  readonly imagen?: string;
}

/** El carrito viene SIEMPRE del servidor: aqui no se calcula ni se confia en precios del cliente. */
export interface Carrito {
  readonly lineas: readonly LineaCarrito[];
  readonly cantidadTotal: number;
  readonly subtotal: Centavos;
  readonly porcentajeIva: number;
  readonly iva: Centavos;
  /** Subtotal + IVA. El envio se suma al elegir la direccion. */
  readonly totalSinEnvio: Centavos;
}

export const CARRITO_VACIO: Carrito = {
  lineas: [],
  cantidadTotal: 0,
  subtotal: centavos(0),
  porcentajeIva: 0,
  iva: centavos(0),
  totalSinEnvio: centavos(0),
};

/** Maximo que el usuario puede pedir de una linea: tope de la API o stock, lo que sea menor. */
export const maximoPermitido = (l: Pick<LineaCarrito, 'stockDisponible'>): number =>
  Math.max(0, Math.min(MAX_POR_PRODUCTO, l.stockDisponible));
