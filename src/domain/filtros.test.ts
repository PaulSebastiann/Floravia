import { describe, expect, it } from 'vitest';
import { hrefCatalogo, parsearConsulta, serializarConsulta } from './filtros';

describe('parsearConsulta (entrada no confiable)', () => {
  it('ignora lineas, filtros y valores invalidos', () => {
    const c = parsearConsulta({ linea: 'plantas', cuidado: ['facil', 'hackeado'], ocasion: 'amor', luz: 'sol-directo' });
    expect(c.linea).toBe('plantas');
    expect(c.filtros['cuidado']).toEqual(['facil']);
    expect(c.filtros['luz']).toEqual(['sol-directo']);
    // "ocasion" pertenece a ramos: se descarta en plantas.
    expect(c.filtros['ocasion']).toBeUndefined();
  });

  it('sin linea valida no acepta ningun filtro', () => {
    const c = parsearConsulta({ linea: 'zapatos', cuidado: 'facil' });
    expect(c.linea).toBeUndefined();
    expect(c.filtros).toEqual({});
  });

  it('sanea pagina, orden y q', () => {
    expect(parsearConsulta({ pagina: '-4' }).pagina).toBe(1);
    expect(parsearConsulta({ pagina: 'abc' }).pagina).toBe(1);
    expect(parsearConsulta({ pagina: '99999' }).pagina).toBe(500);
    expect(parsearConsulta({ orden: 'DROP TABLE' }).orden).toBe('relevancia');
    expect(parsearConsulta({ q: 'x'.repeat(500) }).q).toHaveLength(80);
    expect(parsearConsulta({ q: '   ' }).q).toBeUndefined();
  });

  it('deduplica valores repetidos', () => {
    expect(parsearConsulta({ linea: 'plantas', luz: ['sombra', 'sombra'] }).filtros['luz']).toEqual(['sombra']);
  });
});

describe('serializacion', () => {
  it('es ida y vuelta estable y ordenada', () => {
    const original = parsearConsulta({ linea: 'ramos', color: ['rojo', 'rosa'], ocasion: 'amor', orden: 'precio-asc', pagina: '2' });
    const qs = serializarConsulta(original).toString();
    const vuelta = parsearConsulta(Object.fromEntries(new URLSearchParams(qs).entries()) as Record<string, string>);
    // Object.fromEntries pierde repetidos; validamos al menos que la serializacion sea determinista.
    expect(serializarConsulta(original).toString()).toBe(qs);
    expect(vuelta.linea).toBe('ramos');
    expect(qs.indexOf('color')).toBeLessThan(qs.indexOf('ocasion'));
  });

  it('hrefCatalogo omite valores por defecto', () => {
    expect(hrefCatalogo({})).toBe('/catalogo');
    expect(hrefCatalogo({ linea: 'semillas', filtros: { cultivo: ['huerto'] } })).toBe('/catalogo?linea=semillas&cultivo=huerto');
  });
});
