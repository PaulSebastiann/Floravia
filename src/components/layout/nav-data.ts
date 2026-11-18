import { FILTROS, hrefCatalogo } from '@/domain/filtros';
import type { Linea } from '@/domain/producto';

export interface EnlaceNav { etiqueta: string; href: string }
export interface GrupoNav { titulo: string; enlaces: readonly EnlaceNav[] }
export interface LineaNav {
  linea: Linea;
  etiqueta: string;
  href: string;
  descripcion: string;
  grupos: readonly GrupoNav[];
}

/** Genera un grupo de enlaces a partir de la definicion del filtro (una sola fuente de verdad). */
function grupo(linea: Linea, clave: string, titulo: string, max = 6): GrupoNav {
  const def = FILTROS.find((f) => f.linea === linea && f.clave === clave);
  return {
    titulo,
    enlaces: (def?.opciones ?? []).slice(0, max).map((o) => ({
      etiqueta: o.etiqueta,
      href: hrefCatalogo({ linea, filtros: { [clave]: [o.valor] } }),
    })),
  };
}

export const NAV_LINEAS: readonly LineaNav[] = [
  {
    linea: 'ramos', etiqueta: 'Ramos y flores', href: '/ramos',
    descripcion: 'Arreglos para cada ocasión, con entrega a domicilio en Quito.',
    grupos: [grupo('ramos', 'ocasion', 'Por ocasión'), grupo('ramos', 'color', 'Por color', 5)],
  },
  {
    linea: 'plantas', etiqueta: 'Plantas', href: '/plantas',
    descripcion: 'Para cada espacio, cada luz y cada nivel de experiencia.',
    grupos: [grupo('plantas', 'cuidado', 'Por cuidado'), grupo('plantas', 'luz', 'Por luz'), grupo('plantas', 'pet', 'Mascotas')],
  },
  {
    linea: 'semillas', etiqueta: 'Semillas', href: '/semillas',
    descripcion: 'Flores, huerto y aromáticas para empezar desde casa.',
    grupos: [grupo('semillas', 'cultivo', 'Por cultivo'), grupo('semillas', 'uso', 'Por uso')],
  },
];

export const NAV_EXTRA: readonly EnlaceNav[] = [
  { etiqueta: 'Guías', href: '/guias' },
  { etiqueta: 'Catálogo', href: '/catalogo' },
];
