import { describe, expect, it } from 'vitest';
import { hrefIngresar, rutaInternaSegura } from './redireccion';

describe('rutaInternaSegura (open redirect)', () => {
  it.each(['/checkout', '/pedido/12', '/catalogo?linea=plantas&q=rosa', '/'])('acepta %s', (r) => {
    expect(rutaInternaSegura(r)).toBe(r);
  });

  it.each([
    'https://evil.com', 'http://evil.com', '//evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)',
    '/%2F/evil.com', '/%5Cevil.com', 'evil.com', '', '   ', '/a\nb', '/a\\b', '/api/tienda/estado',
    '/cuenta/ingresar', '/cuenta/crear?volver=/x',
  ])('rechaza %j', (r) => {
    expect(rutaInternaSegura(r, '/inicio')).toBe('/inicio');
  });

  it('rechaza tipos no string y rutas larguisimas', () => {
    expect(rutaInternaSegura(undefined, '/x')).toBe('/x');
    expect(rutaInternaSegura(['/a'], '/x')).toBe('/x');
    expect(rutaInternaSegura('/' + 'a'.repeat(400), '/x')).toBe('/x');
  });

  it('hrefIngresar codifica y sanea', () => {
    expect(hrefIngresar('/checkout')).toBe('/cuenta/ingresar?volver=%2Fcheckout');
    expect(hrefIngresar('//evil.com')).toBe('/cuenta/ingresar?volver=%2F');
  });
});
