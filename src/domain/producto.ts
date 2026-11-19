import type { Centavos } from './dinero';

/**
 * Los atributos de cada linea son OPCIONALES: el backend actual solo entrega categoria,
 * precio, stock, texto de cuidados, colores e imagenes. Cuando exista la migracion de
 * atributos (jsonb) se llenan; mientras tanto la UI debe tolerar su ausencia.
 * Ver README.md ("Brechas con el backend").
 */
export const LINEAS = ['ramos', 'plantas', 'semillas'] as const;
export type Linea = (typeof LINEAS)[number];

export const esLinea = (v: unknown): v is Linea =>
  typeof v === 'string' && (LINEAS as readonly string[]).includes(v);

export interface Imagen {
  readonly url: string;
  readonly alt: string;
}

interface ProductoBase {
  readonly id: string;
  /** Id numerico con el que se compra (API real o, en la demostracion, posicion en el catalogo de muestra). */
  readonly idProducto?: number;
  readonly slug: string;
  readonly nombre: string;
  readonly resumen: string;
  readonly descripcion: string;
  readonly precio: Centavos;
  readonly imagenes: readonly Imagen[];
  readonly disponible: boolean;
  /** Unidades que se pueden vender ahora (backend: stock - reservado). Undefined = desconocido. */
  readonly stockDisponible?: number;
  /** Texto libre de cuidados que escribe el admin (el backend aun no tiene atributos estructurados). */
  readonly cuidados?: string;
  /** 'api' = producto real del backend. Sin foto muestra un marcador neutro, nunca una ilustracion. */
  readonly fuente?: 'api';
  readonly destacado: boolean;
  readonly masVendido: boolean;
}

export const OCASIONES = ['aniversario', 'cumpleanos', 'amor', 'agradecimiento', 'condolencias'] as const;
export type Ocasion = (typeof OCASIONES)[number];

export const COLORES = ['rojo', 'rosa', 'blanco', 'amarillo', 'naranja', 'morado', 'multicolor'] as const;
export type ColorFlor = (typeof COLORES)[number];

export interface Ramo extends ProductoBase {
  readonly linea: 'ramos';
  readonly ocasiones?: readonly Ocasion[];
  readonly tiposFlor?: readonly string[];
  readonly colores?: readonly ColorFlor[];
  readonly duracionDias?: number;
  readonly composicion?: readonly string[];
}

export const NIVELES_CUIDADO = ['facil', 'medio', 'experto'] as const;
export type NivelCuidado = (typeof NIVELES_CUIDADO)[number];

/** Eje 1: cuanta luz necesita. */
export const LUCES = ['sombra', 'luz-indirecta', 'sol-directo'] as const;
export type Luz = (typeof LUCES)[number];

/** Eje 2: donde vive. No mezclar con la luz. */
export const UBICACIONES = ['interior', 'exterior', 'ambos'] as const;
export type Ubicacion = (typeof UBICACIONES)[number];

export interface TamanoPlanta {
  readonly etiqueta: string;
  readonly alturaCm: number;
}

export interface Planta extends ProductoBase {
  readonly linea: 'plantas';
  readonly nivelCuidado?: NivelCuidado;
  readonly luz?: Luz;
  readonly ubicacion?: Ubicacion;
  readonly petFriendly?: boolean;
  readonly riegoCadaDias?: number;
  readonly tamanos?: readonly TamanoPlanta[];
  readonly maceta?: string;
}

export const CULTIVOS = ['flores', 'huerto', 'aromaticas'] as const;
export type Cultivo = (typeof CULTIVOS)[number];

export const USOS = ['comestible', 'ornamental'] as const;
export type UsoSemilla = (typeof USOS)[number];

export type Mes = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export const MESES: readonly Mes[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const NOMBRES_MES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

export interface Semilla extends ProductoBase {
  readonly linea: 'semillas';
  readonly cultivo?: Cultivo;
  readonly uso?: UsoSemilla;
  readonly mesesSiembra?: readonly Mes[];
  readonly germinacionDias?: { readonly min: number; readonly max: number };
  readonly contenido?: string;
}

export type Producto = Ramo | Planta | Semilla;

/** Si agregas una linea y olvidas un caso, no compila. */
export function assertNever(valor: never): never {
  throw new Error(`Caso no manejado: ${JSON.stringify(valor)}`);
}
