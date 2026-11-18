import {
  TAMANO_PAGINA, filtrosDe, type ConsultaCatalogo,
} from '@/domain/filtros';
import { MESES, type Linea, type Producto } from '@/domain/producto';
import type {
  Faceta, Pagina, ProductoRepositorio, Sugerencia,
} from '@/domain/puertos/producto-repositorio';
import { PRODUCTOS_MOCK } from './datos-productos';

/** Minusculas y sin diacriticos: "Cumpleaños" == "cumpleanos". */
export const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Valores de un producto para una clave de filtro (siempre como strings). */
function valoresDe(p: Producto, clave: string): readonly string[] {
  switch (p.linea) {
    case 'ramos':
      if (clave === 'ocasion') return p.ocasiones;
      if (clave === 'color') return p.colores;
      if (clave === 'flor') return p.tiposFlor;
      return [];
    case 'plantas':
      if (clave === 'cuidado') return [p.nivelCuidado];
      if (clave === 'luz') return [p.luz];
      // "ambos" cubre interior y exterior: debe aparecer en ambos filtros.
      if (clave === 'ubicacion') return p.ubicacion === 'ambos' ? ['interior', 'exterior', 'ambos'] : [p.ubicacion];
      if (clave === 'pet') return p.petFriendly ? ['si'] : [];
      return [];
    case 'semillas':
      if (clave === 'cultivo') return [p.cultivo];
      if (clave === 'uso') return [p.uso];
      if (clave === 'mes') return p.mesesSiembra.map(String);
      return [];
  }
}

const textoBuscable = (p: Producto): string =>
  normalizar(`${p.nombre} ${p.resumen} ${p.linea}`);

function coincide(p: Producto, c: ConsultaCatalogo, ignorarClave?: string): boolean {
  if (c.linea && p.linea !== c.linea) return false;
  if (c.q) {
    const palabras = normalizar(c.q).split(/\s+/).filter(Boolean);
    const texto = textoBuscable(p);
    if (!palabras.every((w) => texto.includes(w))) return false;
  }
  for (const [clave, seleccion] of Object.entries(c.filtros)) {
    if (clave === ignorarClave || seleccion.length === 0) continue;
    const vals = valoresDe(p, clave);
    // OR dentro de un mismo filtro, AND entre filtros distintos.
    if (!seleccion.some((v) => vals.includes(v))) return false;
  }
  return true;
}

function ordenar(items: Producto[], orden: ConsultaCatalogo['orden']): Producto[] {
  const copia = [...items];
  switch (orden) {
    case 'precio-asc': return copia.sort((a, b) => a.precio - b.precio);
    case 'precio-desc': return copia.sort((a, b) => b.precio - a.precio);
    case 'nombre': return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    case 'relevancia':
      return copia.sort(
        (a, b) =>
          Number(b.masVendido) - Number(a.masVendido) ||
          Number(b.destacado) - Number(a.destacado) ||
          Number(b.disponible) - Number(a.disponible),
      );
  }
}

const demora = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

export class RepositorioMock implements ProductoRepositorio {
  constructor(
    private readonly datos: readonly Producto[] = PRODUCTOS_MOCK,
    private readonly latenciaMs = 0,
  ) {}

  async listar(c: ConsultaCatalogo, signal?: AbortSignal): Promise<Pagina<Producto>> {
    await demora(this.latenciaMs, signal);
    const filtrados = ordenar(this.datos.filter((p) => coincide(p, c)), c.orden);
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANO_PAGINA));
    const pagina = Math.min(c.pagina, totalPaginas);
    const desde = (pagina - 1) * TAMANO_PAGINA;
    return { items: filtrados.slice(desde, desde + TAMANO_PAGINA), total: filtrados.length, pagina, totalPaginas };
  }

  async porSlug(slug: string, signal?: AbortSignal): Promise<Producto | null> {
    await demora(this.latenciaMs, signal);
    return this.datos.find((p) => p.slug === slug) ?? null;
  }

  async destacados(linea: Linea, limite: number, signal?: AbortSignal) {
    await demora(this.latenciaMs, signal);
    return this.datos.filter((p) => p.linea === linea && p.destacado && p.disponible).slice(0, limite);
  }

  async masVendidos(linea: Linea, limite: number, signal?: AbortSignal) {
    await demora(this.latenciaMs, signal);
    return this.datos.filter((p) => p.linea === linea && p.masVendido && p.disponible).slice(0, limite);
  }

  async relacionados(producto: Producto, limite: number, signal?: AbortSignal) {
    await demora(this.latenciaMs, signal);
    return this.datos
      .filter((p) => p.linea === producto.linea && p.id !== producto.id && p.disponible)
      .slice(0, limite);
  }

  /** Conteos por valor aplicando los DEMAS filtros (patron e-commerce estandar). */
  async facetas(linea: Linea, c: ConsultaCatalogo, signal?: AbortSignal): Promise<readonly Faceta[]> {
    await demora(this.latenciaMs, signal);
    const contexto: ConsultaCatalogo = { ...c, linea };
    return filtrosDe(linea).map((def) => ({
      clave: def.clave,
      valores: def.opciones.map((o) => ({
        valor: o.valor,
        cantidad: this.datos.filter(
          (p) => coincide(p, contexto, def.clave) && valoresDe(p, def.clave).includes(o.valor),
        ).length,
      })),
    }));
  }

  async sugerir(termino: string, limite: number, signal?: AbortSignal): Promise<readonly Sugerencia[]> {
    await demora(this.latenciaMs, signal);
    const t = normalizar(termino);
    if (t.length < 2) return [];
    return this.datos
      .filter((p) => normalizar(p.nombre).includes(t) || textoBuscable(p).includes(t))
      .sort((a, b) => Number(normalizar(b.nombre).startsWith(t)) - Number(normalizar(a.nombre).startsWith(t)))
      .slice(0, limite)
      .map((p) => ({ slug: p.slug, nombre: p.nombre, linea: p.linea }));
  }

  async semillasPorMes(signal?: AbortSignal) {
    await demora(this.latenciaMs, signal);
    const salida: Record<number, Producto[]> = {};
    for (const m of MESES) salida[m] = [];
    for (const p of this.datos) {
      if (p.linea !== 'semillas' || !p.disponible) continue;
      for (const m of p.mesesSiembra) salida[m]?.push(p);
    }
    return salida;
  }
}
