import {
  CULTIVOS, COLORES, LUCES, MESES, NIVELES_CUIDADO, NOMBRES_MES, OCASIONES, UBICACIONES, USOS,
  esLinea, type Linea,
} from './producto';

export interface OpcionFiltro {
  readonly valor: string;
  readonly etiqueta: string;
}

export interface DefinicionFiltro {
  readonly clave: string;
  readonly etiqueta: string;
  readonly linea: Linea;
  readonly opciones: readonly OpcionFiltro[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const opciones = (vals: readonly string[], etiquetas: Record<string, string> = {}): OpcionFiltro[] =>
  vals.map((valor) => ({ valor, etiqueta: etiquetas[valor] ?? cap(valor) }));

/**
 * Configuracion de filtros por linea. Vive en el frontend (decision de UI);
 * el backend solo debe devolver conteos por valor (facetas).
 */
export const FILTROS: readonly DefinicionFiltro[] = [
  { clave: 'ocasion', etiqueta: 'Ocasion', linea: 'ramos',
    opciones: opciones(OCASIONES, { cumpleanos: 'Cumpleaños' }) },
  { clave: 'color', etiqueta: 'Color principal', linea: 'ramos', opciones: opciones(COLORES) },
  { clave: 'flor', etiqueta: 'Tipo de flor', linea: 'ramos',
    opciones: opciones(['rosas', 'girasoles', 'lirios', 'gerberas', 'tulipanes', 'mixtas']) },

  { clave: 'cuidado', etiqueta: 'Nivel de cuidado', linea: 'plantas',
    opciones: opciones(NIVELES_CUIDADO, { facil: 'Fácil' }) },
  { clave: 'luz', etiqueta: 'Necesidad de luz', linea: 'plantas',
    opciones: opciones(LUCES, { 'luz-indirecta': 'Luz indirecta', 'sol-directo': 'Sol directo' }) },
  { clave: 'ubicacion', etiqueta: 'Ubicación', linea: 'plantas', opciones: opciones(UBICACIONES) },
  { clave: 'pet', etiqueta: 'Seguridad para mascotas', linea: 'plantas',
    opciones: [{ valor: 'si', etiqueta: 'Pet-friendly' }] },

  { clave: 'cultivo', etiqueta: 'Tipo de cultivo', linea: 'semillas',
    opciones: opciones(CULTIVOS, { aromaticas: 'Aromáticas' }) },
  { clave: 'uso', etiqueta: 'Tipo de uso', linea: 'semillas', opciones: opciones(USOS) },
  { clave: 'mes', etiqueta: 'Mes de siembra', linea: 'semillas',
    opciones: MESES.map((m) => ({ valor: String(m), etiqueta: NOMBRES_MES[m - 1] ?? String(m) })) },
];

export const filtrosDe = (linea: Linea): readonly DefinicionFiltro[] =>
  FILTROS.filter((f) => f.linea === linea);

export const ORDENES = ['relevancia', 'precio-asc', 'precio-desc', 'nombre'] as const;
export type Orden = (typeof ORDENES)[number];

export const TAMANO_PAGINA = 12;

export interface ConsultaCatalogo {
  readonly linea?: Linea;
  readonly q?: string;
  readonly filtros: Readonly<Record<string, readonly string[]>>;
  readonly orden: Orden;
  readonly pagina: number;
}

type ParamsCrudos = Readonly<Record<string, string | readonly string[] | undefined>>;

const comoLista = (v: string | readonly string[] | undefined): string[] =>
  v === undefined ? [] : typeof v === 'string' ? [v] : [...v];

/**
 * Parsea y SANEA parametros de URL (entrada no confiable). Descarta filtros
 * que no pertenecen a la linea y valores fuera del catalogo permitido.
 */
export function parsearConsulta(params: ParamsCrudos): ConsultaCatalogo {
  const lineaCruda = comoLista(params['linea'])[0];
  const linea = esLinea(lineaCruda) ? lineaCruda : undefined;

  const qCruda = comoLista(params['q'])[0]?.trim().slice(0, 80);
  const q = qCruda ? qCruda : undefined;

  const filtros: Record<string, string[]> = {};
  for (const def of linea ? filtrosDe(linea) : []) {
    const permitidos = new Set(def.opciones.map((o) => o.valor));
    const vals = [...new Set(comoLista(params[def.clave]))].filter((v) => permitidos.has(v));
    if (vals.length > 0) filtros[def.clave] = vals;
  }

  const ordenCrudo = comoLista(params['orden'])[0];
  const orden = (ORDENES as readonly string[]).includes(ordenCrudo ?? '')
    ? (ordenCrudo as Orden)
    : 'relevancia';

  const paginaNum = Number.parseInt(comoLista(params['pagina'])[0] ?? '1', 10);
  const pagina = Number.isSafeInteger(paginaNum) && paginaNum >= 1 ? Math.min(paginaNum, 500) : 1;

  return { linea, q, filtros, orden, pagina };
}

export function serializarConsulta(c: ConsultaCatalogo): URLSearchParams {
  const sp = new URLSearchParams();
  if (c.linea) sp.set('linea', c.linea);
  if (c.q) sp.set('q', c.q);
  for (const clave of Object.keys(c.filtros).sort()) {
    for (const v of c.filtros[clave] ?? []) sp.append(clave, v);
  }
  if (c.orden !== 'relevancia') sp.set('orden', c.orden);
  if (c.pagina > 1) sp.set('pagina', String(c.pagina));
  return sp;
}

export const hrefCatalogo = (c: Partial<ConsultaCatalogo>): string => {
  const qs = serializarConsulta({ filtros: {}, orden: 'relevancia', pagina: 1, ...c }).toString();
  return qs ? `/catalogo?${qs}` : '/catalogo';
};
