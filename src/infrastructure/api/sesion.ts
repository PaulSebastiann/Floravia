import 'server-only';
import { cookies } from 'next/headers';
import type { SesionCliente } from '@/domain/cuenta';
import { COOKIE_CARRITO, COOKIE_NOMBRE, COOKIE_SESION, cookiesSeguras } from './config';
import type { SesionDto } from './dto';
import { estaVigente, leerPayload } from './jwt';

const opcionesBase = () => ({
  httpOnly: true,
  secure: cookiesSeguras(),
  sameSite: 'lax' as const,
  path: '/',
});

/** JWT vigente o undefined. Solo para reenviarlo a la API; nunca llega al navegador ni a componentes cliente. */
export async function leerJwt(): Promise<string | undefined> {
  const t = (await cookies()).get(COOKIE_SESION)?.value;
  if (!t) return undefined;
  return estaVigente(leerPayload(t)) ? t : undefined;
}

export async function leerSesion(): Promise<SesionCliente | null> {
  const jar = await cookies();
  const t = jar.get(COOKIE_SESION)?.value;
  if (!t) return null;
  const p = leerPayload(t);
  if (!estaVigente(p) || p?.role !== 'CLIENTE') return null;
  return { nombre: jar.get(COOKIE_NOMBRE)?.value ?? 'Mi cuenta', correo: p.email ?? '' };
}

/** Solo desde Server Actions / Route Handlers. */
export async function guardarSesion(s: SesionDto): Promise<void> {
  const jar = await cookies();
  const expira = new Date(s.expiraEn);
  // La API devuelve DateTime UTC; si por alguna razon no parsea, 8h (la duracion del JWT).
  const maxAge = Number.isNaN(expira.getTime())
    ? 8 * 3600
    : Math.max(60, Math.floor((expira.getTime() - Date.now()) / 1000));
  jar.set(COOKIE_SESION, s.token, { ...opcionesBase(), maxAge });
  jar.set(COOKIE_NOMBRE, s.nombre, { ...opcionesBase(), maxAge });
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESION);
  jar.delete(COOKIE_NOMBRE);
}

export async function leerTokenCarrito(): Promise<string | undefined> {
  const t = (await cookies()).get(COOKIE_CARRITO)?.value;
  // Mismo formato que valida la API (48 hex): si esta corrupto ni se envia.
  return t && /^[0-9a-f]{48}$/.test(t) ? t : undefined;
}

export async function guardarTokenCarrito(token: string): Promise<void> {
  (await cookies()).set(COOKIE_CARRITO, token, { ...opcionesBase(), maxAge: 60 * 60 * 24 * 30 });
}

export async function borrarTokenCarrito(): Promise<void> {
  (await cookies()).delete(COOKIE_CARRITO);
}
