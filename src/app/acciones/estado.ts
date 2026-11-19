/** Estado de formularios con Server Actions. NUNCA incluye contrasenas ni datos de tarjeta. */
export interface EstadoForm {
  readonly error?: string;
  readonly errores?: Readonly<Record<string, string>>;
  /** Solo campos NO sensibles, para repoblar el formulario. */
  readonly valores?: Readonly<Record<string, string>>;
  /** Direccion ya creada en un intento anterior (para no duplicarla al reintentar). */
  readonly idDireccion?: number;
}

export const texto = (fd: FormData, clave: string, max = 500): string => {
  const v = fd.get(clave);
  return typeof v === 'string' ? v.slice(0, max) : '';
};
