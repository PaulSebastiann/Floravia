import 'server-only';
import { TAMANO_PAGINA, type ConsultaCatalogo } from '@/domain/filtros';
import type { ColorFlor, Cultivo, Linea, Luz, NivelCuidado, Ocasion, Producto, Ubicacion, UsoSemilla } from '@/domain/producto';
import type {
  Faceta, Pagina, ProductoRepositorio, Sugerencia,
} from '@/domain/puertos/producto-repositorio';
import { apiFetch } from './cliente-api';
import type {
  CategoriaDto, FacetaDto, PaginaProductosDto, ProductoDetallePublicoDto, ProductoPublicoDto,
} from './dto';
import { aCentavos, urlMedia } from './mapeos';
import { idDeSlug, slugDe } from './slug';

/**
 * Adaptador HTTP del catalogo contra la API .NET.
 *
 * Compatibilidad del backend:
 *  - No hay `slug`: se deriva `nombre-slug-{idProducto}` y se recupera el id del final.
 *  - No hay "linea": se deduce de la categoria RAIZ por nombre (Flor->ramos, Planta/Bonsai->plantas, Semilla->semillas).
 *    Productos en una categoria raiz con otro nombre se OMITEN y se avisa por consola.
 *  - No hay "destacado" ni "mas vendido": se usan los mas recientes.
 */
export const capacidadesApi = { atributos: true, masVendidos: false } as const;

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function lineaDeNombre(nombreRaiz: string): Linea | undefined {
  const n = norm(nombreRaiz);
  if (/(flor|ramo|arreglo|bouquet)/.test(n)) return 'ramos';
  if (/(planta|bonsai|arbol|suculent|cactus)/.test(n)) return 'plantas';
  if (/semilla/.test(n)) return 'semillas';
  return undefined;
}

const COLORES_FLOR: Record<string, ColorFlor> = {
  rojo: 'rojo', rosado: 'rosa', rosa: 'rosa', blanco: 'blanco', amarillo: 'amarillo', naranja: 'naranja', morado: 'morado', multicolor: 'multicolor',
};

interface MapaCategorias {
  readonly lineaPorCategoria: ReadonlyMap<number, Linea>;
  readonly raizPorLinea: ReadonlyMap<Linea, number>;
}

async function categorias(): Promise<MapaCategorias> {
  const r = await apiFetch<CategoriaDto[]>('/api/categorias', { revalidar: 300 });
  const porId = new Map(r.datos.map((c) => [c.idCategoria, c]));
  const lineaPorCategoria = new Map<number, Linea>();
  const raizPorLinea = new Map<Linea, number>();
  for (const c of r.datos) {
    let raiz = c;
    for (let i = 0; i < 10 && raiz.idCategoriaPadre !== null; i++) {
      const p = porId.get(raiz.idCategoriaPadre);
      if (!p) break;
      raiz = p;
    }
    const linea = lineaDeNombre(raiz.nombre);
    if (linea) {
      lineaPorCategoria.set(c.idCategoria, linea);
      if (!raizPorLinea.has(linea)) raizPorLinea.set(linea, raiz.idCategoria);
    }
  }
  return { lineaPorCategoria, raizPorLinea };
}

function resumenDe(texto: string | null): string {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= 140) return t;
  const corte = t.slice(0, 140);
  return corte.slice(0, Math.max(corte.lastIndexOf(' '), 100)) + '…';
}

function mapear(
  p: ProductoPublicoDto, mapa: MapaCategorias, extra?: Pick<ProductoDetallePublicoDto, 'imagenes' | 'colores'>,
): Producto | null {
  const linea = mapa.lineaPorCategoria.get(p.idCategoria);
  if (!linea) {
    console.warn(`[floravia] Producto ${p.idProducto} omitido: su categoria (${p.idCategoria}) no mapea a ramos/plantas/semillas.`);
    return null;
  }
  const urls = extra?.imagenes.length
    ? [...extra.imagenes].sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.orden - b.orden).map((i) => i.url)
    : p.imagenUrl ? [p.imagenUrl] : [];
  const base = {
    id: String(p.idProducto),
    idProducto: p.idProducto,
    slug: slugDe(p.nombre, p.idProducto),
    nombre: p.nombre,
    resumen: resumenDe(p.descripcion),
    descripcion: p.descripcion ?? '',
    precio: aCentavos(p.precio),
    imagenes: urls.map((u) => ({ url: urlMedia(u) ?? u, alt: p.nombre })),
    disponible: p.stockDisponible > 0,
    stockDisponible: p.stockDisponible,
    cuidados: p.cuidados?.trim() || undefined,
    destacado: false,
    masVendido: false,
  };
  const atributos = p.atributos ?? {};
  const valores = (clave: string) => atributos[clave] ?? [];
  if (linea === 'ramos') {
    const colores = [...valores('color'), ...(extra?.colores ?? []).map((c) => norm(c.nombre))]
      .map((c) => COLORES_FLOR[norm(c)])
      .filter((c): c is ColorFlor => c !== undefined);
    const ocasiones = valores('ocasion').filter((v) =>
      ['aniversario', 'cumpleanos', 'amor', 'agradecimiento', 'condolencias'].includes(v)) as Ocasion[];
    return {
      ...base, linea, ocasiones: ocasiones.length ? ocasiones : undefined, tiposFlor: valores('flor'),
      colores: colores.length ? [...new Set(colores)] : undefined,
    };
  }
  if (linea === 'plantas') {
    const cuidado = valores('cuidado')[0];
    const luz = valores('luz')[0];
    const ubicacion = valores('ubicacion')[0];
    return {
      ...base, linea,
      nivelCuidado: cuidado === 'facil' || cuidado === 'medio' || cuidado === 'experto' ? cuidado as NivelCuidado : undefined,
      luz: luz === 'sombra' || luz === 'luz-indirecta' || luz === 'sol-directo' ? luz as Luz : undefined,
      ubicacion: ubicacion === 'interior' || ubicacion === 'exterior' || ubicacion === 'ambos' ? ubicacion as Ubicacion : undefined,
      petFriendly: valores('pet').includes('si') || undefined,
    };
  }
  const cultivo = valores('cultivo')[0];
  const uso = valores('uso')[0];
  const mesesSiembra = valores('mes').map(Number).filter((m): m is 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 =>
    Number.isInteger(m) && m >= 1 && m <= 12);
  return {
    ...base, linea,
    cultivo: cultivo === 'flores' || cultivo === 'huerto' || cultivo === 'aromaticas' ? cultivo as Cultivo : undefined,
    uso: uso === 'comestible' || uso === 'ornamental' ? uso as UsoSemilla : undefined,
    mesesSiembra: mesesSiembra.length ? mesesSiembra : undefined,
  };
}

const ORDEN_API: Record<ConsultaCatalogo['orden'], string> = {
  relevancia: 'recientes', 'precio-asc': 'precio_asc', 'precio-desc': 'precio_desc', nombre: 'nombre',
};

export class HttpProductoRepositorio implements ProductoRepositorio {
  async listar(c: ConsultaCatalogo, signal?: AbortSignal): Promise<Pagina<Producto>> {
    const mapa = await categorias();
    const idCategoria = c.linea ? mapa.raizPorLinea.get(c.linea) : undefined;
    if (c.linea && idCategoria === undefined) return { items: [], total: 0, pagina: 1, totalPaginas: 1 };

    const r = await apiFetch<PaginaProductosDto>('/api/productos', {
      revalidar: 0, signal,
      query: { idCategoria, texto: c.q, orden: ORDEN_API[c.orden], pagina: c.pagina, tamanoPagina: TAMANO_PAGINA, filtro: serializarFiltros(c) },
    });
    const items = r.datos.items.map((p) => mapear(p, mapa)).filter((p): p is Producto => p !== null);
    return { items, total: r.datos.total, pagina: r.datos.pagina, totalPaginas: Math.max(1, r.datos.totalPaginas) };
  }

  async porSlug(slug: string, signal?: AbortSignal): Promise<Producto | null> {
    const id = idDeSlug(slug);
    if (id === undefined) return null;
    try {
      const [mapa, r] = await Promise.all([
        categorias(),
        apiFetch<ProductoDetallePublicoDto>(`/api/productos/${id}`, { revalidar: 0, signal }),
      ]);
      const p = mapear(r.datos.producto, mapa, r.datos);
      return p; // el id decide; un slug desactualizado (nombre cambiado) sigue resolviendo
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'estado' in e && (e as { estado: number }).estado === 404) return null;
      throw e;
    }
  }

  async destacados(linea: Linea, limite: number, signal?: AbortSignal): Promise<readonly Producto[]> {
    return this.recientes(linea, limite, signal);
  }

  async masVendidos(linea: Linea, limite: number, signal?: AbortSignal): Promise<readonly Producto[]> {
    return this.recientes(linea, limite, signal);
  }

  private async recientes(linea: Linea, limite: number, signal?: AbortSignal): Promise<readonly Producto[]> {
    const p = await this.listar({ linea, filtros: {}, orden: 'relevancia', pagina: 1 }, signal);
    return p.items.slice(0, limite);
  }

  async relacionados(producto: Producto, limite: number, signal?: AbortSignal): Promise<readonly Producto[]> {
    if (producto.idProducto === undefined) return [];
    const [mapa, r] = await Promise.all([
      categorias(),
      apiFetch<ProductoPublicoDto[]>(`/api/productos/${producto.idProducto}/relacionados`, {
        revalidar: 0, signal, query: { cantidad: limite },
      }),
    ]);
    return r.datos.map((p) => mapear(p, mapa)).filter((p): p is Producto => p !== null);
  }

  async facetas(linea: Linea, c: ConsultaCatalogo, signal?: AbortSignal): Promise<readonly Faceta[]> {
    const mapa = await categorias();
    const idCategoria = mapa.raizPorLinea.get(linea);
    if (idCategoria === undefined) return [];
    const r = await apiFetch<FacetaDto[]>('/api/productos/facetas', {
      revalidar: 0, signal,
      query: { idCategoria, texto: c.q, filtro: serializarFiltros(c) },
    });
    return r.datos;
  }

  async sugerir(termino: string, limite: number, signal?: AbortSignal): Promise<readonly Sugerencia[]> {
    const mapa = await categorias();
    const r = await apiFetch<PaginaProductosDto>('/api/productos', {
      revalidar: 0, signal, query: { texto: termino, orden: 'nombre', pagina: 1, tamanoPagina: limite },
    });
    return r.datos.items.flatMap((p) => {
      const linea = mapa.lineaPorCategoria.get(p.idCategoria);
      return linea ? [{ slug: slugDe(p.nombre, p.idProducto), nombre: p.nombre, linea }] : [];
    });
  }

  async semillasPorMes(): Promise<Readonly<Record<number, readonly Producto[]>>> {
    const pagina = await this.listar({ linea: 'semillas', filtros: {}, orden: 'relevancia', pagina: 1 });
    const resultado: Record<number, Producto[]> = {};
    for (const producto of pagina.items) {
      if (producto.linea !== 'semillas') continue;
      for (const mes of producto.mesesSiembra ?? []) (resultado[mes] ??= []).push(producto);
    }
    return resultado;
  }
}

/** Formato HTTP interno. La URL visible sigue usando ?ocasion=amor, más legible y compartible. */
function serializarFiltros(c: ConsultaCatalogo): string[] {
  return Object.entries(c.filtros).flatMap(([clave, valores]) => valores.map((valor) => `${clave}:${valor}`));
}
