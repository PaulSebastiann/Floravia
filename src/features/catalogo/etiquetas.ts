import { FILTROS } from '@/domain/filtros';
import type { Producto } from '@/domain/producto';

export const NOMBRE_LINEA = { ramos: 'Ramo', plantas: 'Planta', semillas: 'Semilla' } as const;

/** Etiqueta legible de un valor de filtro (p. ej. "luz-indirecta" -> "Luz indirecta"). */
export function etiquetaOpcion(clave: string, valor: string): string {
  return FILTROS.find((f) => f.clave === clave)?.opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Datos clave de una tarjeta, segun la linea. Solo muestra lo que existe (el backend aun no tiene atributos). */
export function atributosClave(p: Producto): readonly string[] {
  const datos: string[] = [];
  switch (p.linea) {
    case 'ramos':
      if (p.duracionDias) datos.push(`Dura ~${p.duracionDias} días`);
      if (p.ocasiones?.[0]) datos.push(etiquetaOpcion('ocasion', p.ocasiones[0]));
      break;
    case 'plantas':
      if (p.nivelCuidado) datos.push(etiquetaOpcion('cuidado', p.nivelCuidado));
      if (p.petFriendly) datos.push('Pet-friendly');
      break;
    case 'semillas':
      if (p.germinacionDias) datos.push(`Germina en ${p.germinacionDias.min}–${p.germinacionDias.max} días`);
      if (p.uso) datos.push(etiquetaOpcion('uso', p.uso));
      break;
  }
  // Escasez real (dato del servidor): ayuda a decidir sin inventar urgencia.
  if (p.disponible && p.stockDisponible !== undefined && p.stockDisponible > 0 && p.stockDisponible <= 5) {
    datos.push(`Quedan ${p.stockDisponible}`);
  }
  return datos;
}
