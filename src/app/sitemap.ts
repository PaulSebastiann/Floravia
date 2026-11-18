import type { MetadataRoute } from 'next';
import { SITIO } from '@/content/sitio';
import { SLUGS_GUIAS } from '@/features/guias/guias';

export default function sitemap(): MetadataRoute.Sitemap {
  const rutas = ['', '/ramos', '/plantas', '/semillas', '/catalogo', '/guias', ...SLUGS_GUIAS.map((s) => `/guias/${s}`)];
  return rutas.map((r) => ({ url: `${SITIO.url}${r}` }));
}
