import 'server-only';
import { hayApi } from './api/config';
import * as api from './api/tienda-api';
import * as demo from './demo/tienda-demo';

/** true = sin FLORAVIA_API_URL: la tienda funciona completa pero contra el motor local de demostracion. */
export const modoDemo = (): boolean => !hayApi();

/**
 * Operaciones de tienda (carrito, cuenta, pedidos, pagos). Con API -> backend .NET; sin ella -> motor local.
 * Ambas implementaciones comparten tipo: si una cambia y la otra no, no compila.
 */
export function tienda(): typeof api {
  return hayApi() ? api : demo;
}
