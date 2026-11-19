import 'server-only';
import { TAMANO_PAGINA, type ConsultaCatalogo } from '@/domain/filtros';
import type { Linea, Producto } from '@/domain/producto';
import type {
  Faceta, Pagina, ProductoRepositorio, Sugerencia,
} from '@/domain/puertos/producto-repositorio';
import { apiFetch } from './cliente-api';
import type {
  CategoriaDto, PaginaProductosDto, ProductoDetallePublicoDto, ProductoPublicoDto,
} from './dto';
import { aCentavos, urlMedia } from './mapeos';
import { idDeSlug, slugDe } from './slug';

/**
 * Adaptador HTTP del catalogo contra la API .NET.
 *
 * LIMITACIONES REALES DEL BACKEND (no del adaptador):
 *  - No hay `slug`: se deriva `nombre-slug-{idProducto}` y se recupera el id del final.
 *  - No hay "linea": se deduce de la categoria RAIZ por nombre (Flor->ramos, Planta/Bonsai->plantas, Semilla->semillas).
 *    Productos en una categoria raiz con otro nombre se OMITEN y se avisa por consola.
 *  - No hay atributos (cuidado, luz, ocasion...): los filtros por atributo no se aplican y las facetas van vacias.
 *  - No hay "destacado" ni "mas vendido": se usan los mas recientes.
 */
export const capacidadesApi = { atributos: false, masVendidos: false } as const;

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function lineaDeNombre(nombreRaiz: string): Linea | undefined {
  const n = norm(nombreRaiz);
  if (/(flor|ramo|arreglo|bouquet)/.test(n)) return 'ramos';
  if (/(planta|bonsai|arbol|suculent|cactus)/.test(n)) return 'plantas';
  if (/semilla/.test(n)) return 'semillas';
  return undefined;
}

const COLORES_FLOR: Record<string, 'rojo' | 'rosa' | 'blanco' | 'amarillo' | 'naranja' | 'morado'> = {
  rojo: 'rojo', rosado: 'rosa', rosa: 'rosa', blanco: 'blanco', amarillo: 'amarillo', naranja: 'naranja', morado: 'morado',
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
    fuente: 'api' as const,
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
  if (linea === 'ramos') {
    const colores = (extra?.colores ?? [])
      .map((c) => COLORES_FLOR[norm(c.nombre)])
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    return { ...base, linea, colores: colores.length ? colores : undefined };
  }
  return { ...base, linea };
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
      query: { idCategoria, texto: c.q, orden: ORDEN_API[c.orden], pagina: c.pagina, tamanoPagina: TAMANO_PAGINA },
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

  async facetas(): Promise<readonly Faceta[]> {
    return []; // el backend no tiene atributos: ver capacidadesApi
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
    return {}; // sin meses de siembra en el backend
  }
}
