/**
 * Sanea el parametro `volver` (open redirect). Solo se aceptan rutas internas absolutas.
 * Cualquier otra cosa cae a `porDefecto`. Entrada NO confiable.
 */
const RUTAS_PROHIBIDAS = /^\/(cuenta\/(ingresar|crear)|api)(\/|$|\?)/;

export function rutaInternaSegura(valor: unknown, porDefecto = '/'): string {
  if (typeof valor !== 'string') return porDefecto;
  const v = valor.trim();
  if (v.length === 0 || v.length > 300) return porDefecto;
  if (!v.startsWith('/')) return porDefecto;
  // "//evil.com", "/\evil.com" y variantes: el navegador las trata como URL de otro origen.
  if (v.startsWith('//') || v.startsWith('/\\')) return porDefecto;
  // Caracteres de control o backslashes en cualquier parte.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return porDefecto;
  // Doble decodificacion: "/%2F/evil.com" -> "//evil.com".
  try {
    const dec = decodeURIComponent(v);
    if (dec.startsWith('//') || dec.includes('\\') || /^\/[a-z][a-z0-9+.-]*:/i.test(dec)) return porDefecto;
  } catch {
    return porDefecto;
  }
  if (RUTAS_PROHIBIDAS.test(v)) return porDefecto;
  return v;
}

export const hrefIngresar = (volver: string): string =>
  `/cuenta/ingresar?volver=${encodeURIComponent(rutaInternaSegura(volver))}`;
export const hrefCrearCuenta = (volver: string): string =>
  `/cuenta/crear?volver=${encodeURIComponent(rutaInternaSegura(volver))}`;
