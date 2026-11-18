import { Flower2 } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { SITIO, hrefWhatsApp } from '@/content/sitio';
import { NAV_EXTRA, NAV_LINEAS } from './nav-data';

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-moss-900 text-cream-100">
      <Container className="grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="flex items-center gap-2 font-display text-2xl font-semibold text-cream-50">
            <Flower2 className="size-6 text-petal-200" aria-hidden="true" />
            {SITIO.nombre}
          </p>
          <p className="mt-3 text-moss-200">{SITIO.lema}</p>
        </div>

        <nav aria-label="Tienda">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss-300">Tienda</p>
          <ul className="space-y-2">
            {NAV_LINEAS.map((l) => (
              <li key={l.linea}><Link href={l.href} className="hover:underline underline-offset-4">{l.etiqueta}</Link></li>
            ))}
            {NAV_EXTRA.map((e) => (
              <li key={e.href}><Link href={e.href} className="hover:underline underline-offset-4">{e.etiqueta}</Link></li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss-300">Contacto</p>
          <ul className="space-y-2">
            <li>{SITIO.ciudad}</li>
            <li><a href={`mailto:${SITIO.correo}`} className="hover:underline underline-offset-4">{SITIO.correo}</a></li>
            <li>{SITIO.horario}</li>
            <li>
              <a href={hrefWhatsApp('Hola Floravia, quisiera hacer una consulta.')} target="_blank" rel="noopener noreferrer" className="font-semibold text-cream-50 hover:underline underline-offset-4">
                Escribir por WhatsApp
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss-300">Síguenos</p>
          <ul className="space-y-2">
            <li><a href={SITIO.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">Instagram</a></li>
            <li><a href={SITIO.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">Facebook</a></li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-moss-800">
        <Container className="flex flex-col gap-2 py-5 text-sm text-moss-300 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {SITIO.nombre}. Hecho en Quito, Ecuador.</p>
          <p>Una flor, una planta o una semilla puede cambiar un día.</p>
        </Container>
      </div>
    </footer>
  );
}
