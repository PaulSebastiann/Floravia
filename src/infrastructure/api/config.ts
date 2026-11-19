import 'server-only';

/** URL interna obligatoria de la API .NET. La tienda real nunca cae a datos locales. */
export function urlApi(): string {
  const u = process.env['FLORAVIA_API_URL']?.trim();
  if (!u) {
    throw new Error(
      'Falta FLORAVIA_API_URL. Floravia requiere la API y PostgreSQL; el modo demo no está habilitado.',
    );
  }
  return u.replace(/\/+$/, '');
}

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
