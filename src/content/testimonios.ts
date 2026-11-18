export interface Testimonio {
  nombre: string;
  contexto: string;
  texto: string;
  /** true = texto de muestra para maquetar. NUNCA se muestra en produccion. */
  esEjemplo: boolean;
}

/** Reseñas REALES con consentimiento del cliente. Vacio hasta que existan. */
export const TESTIMONIOS_REALES: readonly Testimonio[] = [];

const EJEMPLOS: readonly Testimonio[] = [
  { nombre: 'Cliente de ejemplo 1', contexto: 'Ramo de aniversario', texto: 'Texto de muestra: el ramo llegó a tiempo y las flores se veían tal como en la foto.', esEjemplo: true },
  { nombre: 'Cliente de ejemplo 2', contexto: 'Planta de interior', texto: 'Texto de muestra: me recomendaron una planta ideal para mi departamento con poca luz.', esEjemplo: true },
  { nombre: 'Cliente de ejemplo 3', contexto: 'Semillas de huerto', texto: 'Texto de muestra: las instrucciones de siembra fueron claras y germinaron sin problema.', esEjemplo: true },
];

/** En produccion solo reseñas reales (si no hay, la seccion se oculta). En desarrollo, muestra ejemplos marcados. */
export function testimoniosVisibles(): readonly Testimonio[] {
  if (TESTIMONIOS_REALES.length > 0) return TESTIMONIOS_REALES;
  return process.env['NODE_ENV'] === 'production' ? [] : EJEMPLOS;
}
