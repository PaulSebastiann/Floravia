import 'server-only';
import { connection } from 'next/server';
import type { ProductoRepositorio } from '@/domain/puertos/producto-repositorio';
import { capacidadesApi, HttpProductoRepositorio } from './api/http-producto-repositorio';

let instancia: ProductoRepositorio | undefined;

/**
 * Punto único de composición. El catálogo siempre viene de la API y PostgreSQL.
 */
export function obtenerRepositorio(): ProductoRepositorio {
  instancia ??= new HttpProductoRepositorio();
  return instancia;
}

/** Que puede sostener la fuente de datos actual. La UI oculta lo que no existe en vez de mostrar filtros vacios. */
export function capacidades(): { atributos: boolean; masVendidos: boolean; compra: boolean } {
  return { ...capacidadesApi, compra: true };
}

/**
 * Con API real las paginas que consultan el catalogo se renderizan POR PETICION. Las categorias se cachean,
 * pero precio y stock se consultan siempre a la API para reflejar pedidos inmediatamente. Asi `next build`
 * y `docker build` no dependen de que la API esté levantada.
 */
export async function esperarSolicitud(): Promise<void> {
  await connection();
}
