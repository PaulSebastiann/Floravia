import { NextResponse } from 'next/server';
import { CARRITO_VACIO } from '@/domain/carrito';
import { leerSesion } from '@/infrastructure/api/sesion';
import { modoDemo, tienda } from '@/infrastructure/tienda';

export const dynamic = 'force-dynamic';

/**
 * Estado del visitante (sesion + carrito) para el header. Las paginas del catalogo siguen siendo
 * estaticas/cacheables: lo personal se pide aparte, con `no-store`.
 */
export async function GET() {
  const cab = { 'Cache-Control': 'private, no-store' };
  const sesion = await leerSesion();
  let carrito = CARRITO_VACIO;
  try {
    carrito = await tienda().verCarrito();
  } catch (e) {
    console.error('[floravia] estado: no se pudo leer el carrito', e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ sesion, carrito, compra: true, demo: modoDemo() }, { headers: cab });
}
