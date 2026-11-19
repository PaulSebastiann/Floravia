import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AnnouncementBar, SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { SITIO } from '@/content/sitio';
import { TiendaProvider } from '@/features/tienda/tienda-provider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITIO.url),
  title: { default: `${SITIO.nombre} · Flores, plantas y semillas en Quito`, template: `%s · ${SITIO.nombre}` },
  description: SITIO.lema,
  openGraph: { type: 'website', locale: 'es_EC', siteName: SITIO.nombre },
};

export const viewport: Viewport = { themeColor: '#2f5d3a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-EC">
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-moss-900 focus:px-5 focus:py-3 focus:text-cream-50"
        >
          Saltar al contenido
        </a>
        <TiendaProvider>
          <AnnouncementBar />
          <SiteHeader />
          <main id="contenido" tabIndex={-1} className="outline-none">{children}</main>
          <SiteFooter />
        </TiendaProvider>
      </body>
    </html>
  );
}
