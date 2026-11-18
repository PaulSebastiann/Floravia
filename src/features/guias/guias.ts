import type { ComponentType } from 'react';
import type { Linea } from '@/domain/producto';

export interface MetaGuia {
  titulo: string;
  resumen: string;
  linea: Linea;
  minutos: number;
}
interface ModuloGuia { default: ComponentType; meta: MetaGuia }

/** Mapa explicito (no import dinamico con plantilla): tipado, tree-shakeable y valida slugs. */
const CARGADORES = {
  'cuidado-de-suculentas': () => import('@/content/guias/cuidado-de-suculentas.mdx'),
  'como-germinar-semillas': () => import('@/content/guias/como-germinar-semillas.mdx'),
  'alargar-la-vida-de-tu-ramo': () => import('@/content/guias/alargar-la-vida-de-tu-ramo.mdx'),
} as const;

export type SlugGuia = keyof typeof CARGADORES;
export const SLUGS_GUIAS = Object.keys(CARGADORES) as SlugGuia[];

export const esSlugGuia = (s: string): s is SlugGuia => Object.hasOwn(CARGADORES, s);

export async function cargarGuia(slug: SlugGuia): Promise<ModuloGuia> {
  return (await CARGADORES[slug]()) as unknown as ModuloGuia;
}

export async function listarGuias(): Promise<ReadonlyArray<{ slug: SlugGuia; meta: MetaGuia }>> {
  return Promise.all(SLUGS_GUIAS.map(async (slug) => ({ slug, meta: (await cargarGuia(slug)).meta })));
}
