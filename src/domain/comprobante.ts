/** Reglas del comprobante de transferencia. Espejo de api/Archivos/ComprobanteStore.cs (5 MB; JPG, PNG, WEBP, PDF). */
export const COMPROBANTE_MAX_BYTES = 5 * 1024 * 1024;
export const COMPROBANTE_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const COMPROBANTE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

export function validarComprobante(f: { size: number; type: string } | null | undefined): string | undefined {
  if (!f || f.size === 0) return 'Adjunta el comprobante de tu transferencia.';
  if (f.size > COMPROBANTE_MAX_BYTES) return 'El archivo supera los 5 MB.';
  if (!(COMPROBANTE_TIPOS as readonly string[]).includes(f.type)) return 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.';
  return undefined;
}
