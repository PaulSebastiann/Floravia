import 'server-only';
import { connection } from 'next/server';
import type { ProductoRepositorio } from '@/domain/puertos/producto-repositorio';
import { hayApi } from './api/config';
import { capacidadesApi, HttpProductoRepositorio } from './api/http-producto-repositorio';
import { RepositorioMock } from './mocks/repositorio-mock';

let instancia: ProductoRepositorio | undefined;

/**
 * Punto unico de composicion del repositorio.
 * Con FLORAVIA_API_URL -> API .NET real. Sin ella -> datos de muestra y tienda de demostracion (carrito, cuenta y pagos simulados).
 */
export function obtenerRepositorio(): ProductoRepositorio {
  instancia ??= hayApi() ? new HttpProductoRepositorio() : new RepositorioMock();
  return instancia;
}

/** Que puede sostener la fuente de datos actual. La UI oculta lo que no existe en vez de mostrar filtros vacios. */
export function capacidades(): { atributos: boolean; masVendidos: boolean; compra: boolean } {
  // `compra` es siempre true: sin API la compra funciona contra el motor de demostracion (infrastructure/demo).
  return hayApi()
    ? { ...capacidadesApi, compra: true }
    : { atributos: true, masVendidos: true, compra: true };
}

/**
 * Con API real las paginas que consultan el catalogo se renderizan POR PETICION (los datos igual se cachean
 * en el Data Cache de fetch). Asi `next build` y `docker build` no dependen de que la API este levantada,
 * y un cambio de precio o stock se ve en <= 30 s sin reconstruir. En modo demo (mock) siguen siendo estaticas.
 */
export async function esperarSolicitud(): Promise<void> {
  if (hayApi()) await connection();
}
