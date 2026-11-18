import 'server-only';
import type { ProductoRepositorio } from '@/domain/puertos/producto-repositorio';
import { RepositorioMock } from './mocks/repositorio-mock';

let instancia: ProductoRepositorio | undefined;

/**
 * Punto unico de composicion del repositorio. Cuando exista el adaptador HTTP
 * (HttpProductoRepositorio contra la API .NET) se cambia SOLO aqui.
 */
export function obtenerRepositorio(): ProductoRepositorio {
  if (process.env['FLORAVIA_API_URL']) {
    throw new Error(
      'FLORAVIA_API_URL esta definida pero HttpProductoRepositorio aun no esta implementado. ' +
        'Deja la variable vacia para usar datos mock.',
    );
  }
  instancia ??= new RepositorioMock();
  return instancia;
}
