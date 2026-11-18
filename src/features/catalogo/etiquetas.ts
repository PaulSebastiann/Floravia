import { FILTROS } from '@/domain/filtros';
import type { Producto } from '@/domain/producto';

export const NOMBRE_LINEA = { ramos: 'Ramo', plantas: 'Planta', semillas: 'Semilla' } as const;

/** Etiqueta legible de un valor de filtro (p. ej. "luz-indirecta" -> "Luz indirecta"). */
export function etiquetaOpcion(clave: string, valor: string): string {
  return FILTROS.find((f) => f.clave === clave)?.opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Datos clave de una tarjeta, segun la linea (union discriminada: exhaustivo). */
export function atributosClave(p: Producto): readonly string[] {
  switch (p.linea) {
    case 'ramos': return [`Dura ~${p.duracionDias} días`, ...p.ocasiones.slice(0, 1).map((o) => etiquetaOpcion('ocasion', o))];
    case 'plantas': return [etiquetaOpcion('cuidado', p.nivelCuidado), ...(p.petFriendly ? ['Pet-friendly'] : [])];
    case 'semillas': return [`Germina en ${p.germinacionDias.min}–${p.germinacionDias.max} días`, etiquetaOpcion('uso', p.uso)];
  }
}
