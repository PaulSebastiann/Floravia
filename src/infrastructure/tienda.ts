import 'server-only';
import * as api from './api/tienda-api';

/**
 * Operaciones de tienda (carrito, cuenta, pedidos y pagos) contra el backend .NET real.
 */
export function tienda(): typeof api {
  return api;
}
