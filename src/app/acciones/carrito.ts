'use server';

import type { Carrito } from '@/domain/carrito';
import { MAX_POR_PRODUCTO } from '@/domain/carrito';
import { ApiError, ApiNoDisponible, mensajeUsuario } from '@/infrastructure/api/errores';
import { tienda } from '@/infrastructure/tienda';

export type ResultadoCarrito =
  | { readonly ok: true; readonly carrito: Carrito }
  | { readonly ok: false; readonly error: string };

const entero = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

async function ejecutar(fn: () => Promise<Carrito>): Promise<ResultadoCarrito> {
  try {
    return { ok: true, carrito: await fn() };
  } catch (e) {
    if (!(e instanceof ApiError) && !(e instanceof ApiNoDisponible)) console.error('[floravia] carrito', e);
    return { ok: false, error: mensajeUsuario(e) };
  }
}

export async function agregarAccion(idProducto: number, cantidad: number): Promise<ResultadoCarrito> {
  // Los argumentos de una Server Action son entrada NO confiable aunque vengan de nuestro componente.
  if (!entero(idProducto, 1, 2_147_483_647) || !entero(cantidad, 1, MAX_POR_PRODUCTO)) {
    return { ok: false, error: 'Cantidad no válida.' };
  }
  return ejecutar(() => tienda().agregarAlCarrito(idProducto, cantidad));
}

export async function cantidadAccion(idProducto: number, cantidad: number): Promise<ResultadoCarrito> {
  if (!entero(idProducto, 1, 2_147_483_647) || !entero(cantidad, 0, MAX_POR_PRODUCTO)) {
    return { ok: false, error: 'Cantidad no válida.' };
  }
  return ejecutar(() => tienda().establecerCantidad(idProducto, cantidad));
}

export async function quitarAccion(idProducto: number): Promise<ResultadoCarrito> {
  if (!entero(idProducto, 1, 2_147_483_647)) return { ok: false, error: 'Producto no válido.' };
  return ejecutar(() => tienda().quitarDelCarrito(idProducto));
}
