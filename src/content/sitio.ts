/**
 * Datos del negocio. VARIOS SON PLACEHOLDERS tomados del README de la v0.0
 * ("los datos de contacto son marcadores de posicion"). Reemplazar por los reales.
 */
export const SITIO = {
  nombre: 'Floravia',
  lema: 'Flores, plantas y semillas para llenar de vida los espacios de Quito.',
  ciudad: 'Quito, Ecuador',
  correo: 'contacto@floravia.com', // PLACEHOLDER
  horario: 'Lunes a sábado 08:00–19:00 · Domingos 09:00–14:00', // PLACEHOLDER (v0.0)
  instagram: 'https://www.instagram.com/floravia', // PLACEHOLDER
  facebook: 'https://www.facebook.com/floravia', // PLACEHOLDER
  /** Solo digitos con codigo de pais. Definir NEXT_PUBLIC_WHATSAPP. */
  whatsapp: process.env['NEXT_PUBLIC_WHATSAPP'] ?? '5930000000000',
  url: process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000',
} as const;

export function hrefWhatsApp(mensaje: string): string {
  return `https://wa.me/${SITIO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
