'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { hrefWhatsApp } from '@/content/sitio';
import { NAV_EXTRA, NAV_LINEAS } from './nav-data';

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Abrir menú"
        className="inline-flex size-11 items-center justify-center rounded-full text-moss-900 hover:bg-moss-100 lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent titulo="Menú" descripcion="Navegación principal" lado="izquierda">
        <nav aria-label="Principal móvil" className="px-5 py-3">
          <Accordion type="single" collapsible>
            {NAV_LINEAS.map((item) => (
              <AccordionItem key={item.linea} value={item.linea}>
                <AccordionTrigger>{item.etiqueta}</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1">
                    <li>
                      <SheetClose asChild>
                        <Link href={item.href} className="block rounded-lg py-2 font-semibold text-moss-700">
                          Ver todo
                        </Link>
                      </SheetClose>
                    </li>
                    {item.grupos.flatMap((g) => g.enlaces).map((e) => (
                      <li key={e.href}>
                        <SheetClose asChild>
                          <Link href={e.href} className="block rounded-lg py-2 text-ink">{e.etiqueta}</Link>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <ul className="mt-2 divide-y divide-line">
            {NAV_EXTRA.map((e) => (
              <li key={e.href}>
                <SheetClose asChild>
                  <Link href={e.href} className="block py-4 text-lg font-semibold text-moss-900">{e.etiqueta}</Link>
                </SheetClose>
              </li>
            ))}
          </ul>
          <a
            href={hrefWhatsApp('Hola Floravia, quisiera hacer una consulta.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex h-12 items-center justify-center rounded-full bg-moss-700 font-semibold text-cream-50"
          >
            Escríbenos por WhatsApp
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
