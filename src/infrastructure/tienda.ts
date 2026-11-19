import 'server-only';
import * as api from './api/tienda-api';

/** La aplicación desplegable siempre trabaja contra API + PostgreSQL. */
export const modoDemo = (): boolean => false;

/**
 * Operaciones de tienda (carrito, cuenta, pedidos y pagos) contra el backend .NET real.
 */
export function tienda(): typeof api {
  return api;
}
