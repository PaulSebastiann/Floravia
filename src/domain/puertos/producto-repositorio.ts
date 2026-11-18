import type { ConsultaCatalogo } from '../filtros';
import type { Linea, Producto } from '../producto';

export interface Pagina<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly pagina: number;
  readonly totalPaginas: number;
}

export interface Faceta {
  readonly clave: string;
  readonly valores: ReadonlyArray<{ readonly valor: string; readonly cantidad: number }>;
}

export interface Sugerencia {
  readonly slug: string;
  readonly nombre: string;
  readonly linea: Linea;
}

/**
 * Puerto de lectura del catalogo. La UI depende de esta interfaz, nunca de fetch.
 * Hoy lo implementa el mock; luego, un adaptador HTTP contra la API .NET.
 */
export interface ProductoRepositorio {
  listar(consulta: ConsultaCatalogo, signal?: AbortSignal): Promise<Pagina<Producto>>;
  porSlug(slug: string, signal?: AbortSignal): Promise<Producto | null>;
  destacados(linea: Linea, limite: number, signal?: AbortSignal): Promise<readonly Producto[]>;
  masVendidos(linea: Linea, limite: number, signal?: AbortSignal): Promise<readonly Producto[]>;
  relacionados(producto: Producto, limite: number, signal?: AbortSignal): Promise<readonly Producto[]>;
  facetas(linea: Linea, consulta: ConsultaCatalogo, signal?: AbortSignal): Promise<readonly Faceta[]>;
  sugerir(termino: string, limite: number, signal?: AbortSignal): Promise<readonly Sugerencia[]>;
  semillasPorMes(signal?: AbortSignal): Promise<Readonly<Record<number, readonly Producto[]>>>;
}
