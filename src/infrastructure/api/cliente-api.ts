import 'server-only';
import { headers } from 'next/headers';
import { urlApi } from './config';
import { ApiError, ApiNoDisponible } from './errores';
import type { ProblemaDto } from './dto';

export interface OpcionesApi {
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly json?: unknown;
  readonly formData?: FormData;
  readonly jwt?: string;
  readonly tokenCarrito?: string;
  /** Segundos de cache de datos publicos (catalogo). Omitido = sin cache (carrito, cuenta, pedidos). */
  readonly revalidar?: number;
  readonly signal?: AbortSignal;
  /** Estados que NO son error (p. ej. 402 en el pago con tarjeta simulado: es un resultado esperado). */
  readonly aceptar?: readonly number[];
  readonly timeoutMs?: number;
}

export interface RespuestaApi<T> {
  readonly estado: number;
  readonly datos: T;
}

/** IP del visitante para el rate limit de la API. Solo viaja lo que el proxy inverso puso en la peticion entrante. */
async function ipCliente(): Promise<string | undefined> {
  try {
    const h = await headers();
    const xff = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    return xff || h.get('x-real-ip') || undefined;
  } catch {
    return undefined; // fuera de un request (build, tests)
  }
}

export async function apiFetch<T>(ruta: string, o: OpcionesApi = {}): Promise<RespuestaApi<T>> {
  const base = urlApi();

  const url = new URL(base + ruta);
  for (const [k, v] of Object.entries(o.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  const cab = new Headers({ Accept: 'application/json' });
  if (o.json !== undefined) cab.set('Content-Type', 'application/json');
  if (o.jwt) cab.set('Authorization', `Bearer ${o.jwt}`);
  if (o.tokenCarrito) cab.set('X-Carrito-Token', o.tokenCarrito);
  // Solo en llamadas personales: leer headers() vuelve dinamica la pagina y el catalogo publico debe poder cachearse.
  const ip = o.revalidar === undefined ? await ipCliente() : undefined;
  if (ip) cab.set('X-Forwarded-For', ip);

  const timeout = AbortSignal.timeout(o.timeoutMs ?? 10_000);
  const signal = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
      method: o.metodo ?? (o.json !== undefined || o.formData ? 'POST' : 'GET'),
      headers: cab,
      body: o.formData ?? (o.json !== undefined ? JSON.stringify(o.json) : undefined),
      signal,
      ...(o.revalidar !== undefined ? { next: { revalidate: o.revalidar } } : { cache: 'no-store' as const }),
    });
  } catch (e) {
    if (o.signal?.aborted) throw e;
    throw new ApiNoDisponible(e);
  }

  if (res.status === 204) return { estado: 204, datos: undefined as T };

  const texto = await res.text();
  let cuerpo: unknown;
  try {
    cuerpo = texto ? JSON.parse(texto) : undefined;
  } catch {
    cuerpo = undefined;
  }

  if (res.ok || o.aceptar?.includes(res.status)) return { estado: res.status, datos: cuerpo as T };

  const p = (cuerpo ?? {}) as ProblemaDto;
  throw new ApiError(res.status, p.title ?? res.statusText, p.detail ?? '', p.traceId);
}
