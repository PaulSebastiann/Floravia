import { NextResponse } from 'next/server';
import { CARRITO_VACIO } from '@/domain/carrito';
import { ApiError } from '@/infrastructure/api/errores';
import { COOKIE_CARRITO, COOKIE_NOMBRE, COOKIE_SESION } from '@/infrastructure/api/config';
import { leerSesion } from '@/infrastructure/api/sesion';
import { tienda } from '@/infrastructure/tienda';

export const dynamic = 'force-dynamic';

/**
 * Estado del visitante (sesion + carrito) para el header. Las paginas del catalogo siguen siendo
 * estaticas/cacheables: lo personal se pide aparte, con `no-store`.
 */
export async function GET() {
  const cab = { 'Cache-Control': 'private, no-store' };
  let sesion = await leerSesion();
  let carrito = CARRITO_VACIO;
  let limpiarCookiesViejas = false;
  try {
    // Leer el payload no verifica la firma. La API es quien confirma que la cuenta existe
    // y que el JWT fue emitido con la clave actual (descarta sesiones antiguas o inválidas).
    if (sesion) {
      try {
        const cliente = await tienda().perfil();
        sesion = {
          nombre: `${cliente.nombres} ${cliente.apellidos}`.trim(),
          correo: cliente.correo ?? sesion.correo,
        };
      } catch (e) {
        if (!(e instanceof ApiError) || e.estado !== 401) throw e;
        sesion = null;
        limpiarCookiesViejas = true;
      }
    }
    if (!limpiarCookiesViejas) carrito = await tienda().verCarrito();
  } catch (e) {
    console.error('[floravia] estado: no se pudo leer el carrito', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'La tienda no puede conectarse con la API.' },
      { status: 503, headers: cab },
    );
  }
  const respuesta = NextResponse.json({ sesion, carrito, compra: true }, { headers: cab });
  if (limpiarCookiesViejas) {
    respuesta.cookies.delete(COOKIE_SESION);
    respuesta.cookies.delete(COOKIE_NOMBRE);
    respuesta.cookies.delete(COOKIE_CARRITO);
  }
  return respuesta;
}
