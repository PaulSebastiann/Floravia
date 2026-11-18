import { describe, expect, it } from 'vitest';
import { parsearConsulta } from '@/domain/filtros';
import { PRODUCTOS_MOCK } from './datos-productos';
import { RepositorioMock, normalizar } from './repositorio-mock';

const repo = new RepositorioMock();
const consulta = (p: Record<string, string | string[]>) => parsearConsulta(p);

describe('datos mock', () => {
  it('slugs e ids unicos', () => {
    expect(new Set(PRODUCTOS_MOCK.map((p) => p.slug)).size).toBe(PRODUCTOS_MOCK.length);
  });
  it('cada linea tiene destacados y mas vendidos para las landings', async () => {
    for (const linea of ['ramos', 'plantas', 'semillas'] as const) {
      expect((await repo.destacados(linea, 8)).length).toBeGreaterThanOrEqual(3);
      expect((await repo.masVendidos(linea, 8)).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('listar', () => {
  it('filtra plantas por cuidado y mascotas (AND entre filtros)', async () => {
    const r = await repo.listar(consulta({ linea: 'plantas', cuidado: 'facil', pet: 'si' }));
    expect(r.items.length).toBeGreaterThan(0);
    for (const p of r.items) {
      expect(p.linea === 'plantas' && p.nivelCuidado === 'facil' && p.petFriendly).toBe(true);
    }
  });

  it('OR dentro de un mismo filtro', async () => {
    const r = await repo.listar(consulta({ linea: 'plantas', cuidado: ['facil', 'experto'] }));
    const niveles = new Set(r.items.map((p) => (p.linea === 'plantas' ? p.nivelCuidado : '')));
    expect(niveles).toEqual(new Set(['facil', 'experto']));
  });

  it('una planta "ambos" aparece al filtrar interior Y exterior', async () => {
    const interior = await repo.listar(consulta({ linea: 'plantas', ubicacion: 'interior' }));
    const exterior = await repo.listar(consulta({ linea: 'plantas', ubicacion: 'exterior' }));
    expect(interior.items.some((p) => p.slug === 'planta-helecho')).toBe(true);
    expect(exterior.items.some((p) => p.slug === 'planta-helecho')).toBe(true);
  });

  it('busqueda insensible a acentos y mayusculas', async () => {
    expect(normalizar('Cumpleaños')).toBe('cumpleanos');
    const r = await repo.listar(consulta({ q: 'ALBAHACA' }));
    expect(r.items.map((p) => p.slug)).toContain('semilla-albahaca');
  });

  it('estado vacio: sin coincidencias devuelve total 0, no error', async () => {
    const r = await repo.listar(consulta({ q: 'zzzzzz' }));
    expect(r).toMatchObject({ total: 0, items: [], pagina: 1, totalPaginas: 1 });
  });

  it('ordena por precio y manda al final lo no disponible en relevancia', async () => {
    const asc = await repo.listar(consulta({ linea: 'ramos', orden: 'precio-asc' }));
    const precios = asc.items.map((p) => p.precio);
    expect(precios).toEqual([...precios].sort((a, b) => a - b));
    const rel = await repo.listar(consulta({ linea: 'ramos' }));
    expect(rel.items.at(-1)?.disponible).toBe(false);
  });

  it('pagina fuera de rango se acota', async () => {
    const r = await repo.listar(consulta({ pagina: '500' }));
    expect(r.pagina).toBe(r.totalPaginas);
  });
});

describe('facetas', () => {
  it('los conteos respetan los OTROS filtros pero no el propio', async () => {
    const c = consulta({ linea: 'plantas', cuidado: 'facil', luz: 'sol-directo' });
    const facetas = await repo.facetas('plantas', c);
    const cuidado = facetas.find((f) => f.clave === 'cuidado');
    const medio = cuidado?.valores.find((v) => v.valor === 'medio');
    // Plantas de sol directo con cuidado medio (ignorando el filtro de cuidado): lavanda.
    expect(medio?.cantidad).toBe(1);
    // El conteo de "facil" coincide con lo que realmente devuelve listar.
    const listado = await repo.listar(c);
    expect(cuidado?.valores.find((v) => v.valor === 'facil')?.cantidad).toBe(listado.total);
  });
});

describe('sugerir y semillasPorMes', () => {
  it('exige minimo 2 caracteres y prioriza prefijos', async () => {
    expect(await repo.sugerir('a', 6)).toEqual([]);
    const s = await repo.sugerir('ram', 6);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0]?.nombre.toLowerCase().startsWith('ram')).toBe(true);
  });
  it('respeta el limite y cancela con AbortSignal', async () => {
    expect((await repo.sugerir('se', 2)).length).toBeLessThanOrEqual(2);
    const lento = new RepositorioMock(undefined, 50);
    const ctrl = new AbortController();
    const p = lento.sugerir('rosa', 5, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('calendario: los 12 meses existen', async () => {
    const m = await repo.semillasPorMes();
    expect(Object.keys(m)).toHaveLength(12);
    expect(m[10]?.length).toBeGreaterThan(0);
  });
});
