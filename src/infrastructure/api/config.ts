import 'server-only';

/** URL base de la API .NET. Vacia = modo demo (catalogo mock, sin compra). */
export function urlApi(): string | undefined {
  const u = process.env['FLORAVIA_API_URL']?.trim();
  return u ? u.replace(/\/+$/, '') : undefined;
}

export const hayApi = (): boolean => urlApi() !== undefined;

/** En produccion las cookies van `Secure`. Desactivable solo para HTTP en red interna de pruebas. */
export function cookiesSeguras(): boolean {
  const v = process.env['FLORAVIA_COOKIE_SECURE'];
  if (v === 'false') return false;
  if (v === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

export const COOKIE_SESION = 'fl_sesion';
export const COOKIE_NOMBRE = 'fl_nombre';
export const COOKIE_CARRITO = 'fl_carrito';
