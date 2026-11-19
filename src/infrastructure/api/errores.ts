/** Error HTTP de la API (problem+json). El mensaje `detalle` ya viene redactado para el usuario final. */
export class ApiError extends Error {
  constructor(
    readonly estado: number,
    readonly titulo: string,
    readonly detalle: string,
    readonly traceId?: string,
  ) {
    super(`${estado} ${titulo}: ${detalle}`);
    this.name = 'ApiError';
  }
}

/** Mensaje seguro para mostrar al usuario. No filtra detalles internos en errores 5xx. */
export function mensajeUsuario(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.estado === 429) return 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.';
    if (e.estado >= 500) return 'Tuvimos un problema de nuestro lado. Inténtalo de nuevo en unos minutos.';
    if (e.estado === 401 || e.estado === 403) return e.detalle || 'Tu sesión no es válida. Inicia sesión de nuevo.';
    return e.detalle || e.titulo || 'No se pudo completar la acción.';
  }
  if (e instanceof Error && e.name === 'ApiNoDisponible') {
    return 'No pudimos conectar con la tienda. Inténtalo de nuevo en unos minutos.';
  }
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}

export class ApiNoDisponible extends Error {
  constructor(causa?: unknown) {
    super('API no disponible', { cause: causa });
    this.name = 'ApiNoDisponible';
  }
}
