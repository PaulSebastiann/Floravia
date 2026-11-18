'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { BotanicalArt } from '@/components/ui/botanical-art';
import { cn } from '@/lib/cn';
import { NAV_EXTRA, NAV_LINEAS, type LineaNav } from './nav-data';

const ARTE = {
  ramos: { forma: 'ramo', colores: ['#c4575a', '#e8938f', '#fbe9e7'] },
  plantas: { forma: 'planta', colores: [] },
  semillas: { forma: 'sobre', colores: ['#e0a93b'] },
} as const;

function Panel({ item, id }: { item: LineaNav; id: string }) {
  const arte = ARTE[item.linea];
  return (
    <div id={id} className="absolute inset-x-0 top-full z-40 border-b border-line bg-cream-50 shadow-lift animate-fade-in">
      <div className="mx-auto grid max-w-7xl grid-cols-[1.1fr_2fr_0.9fr] gap-10 px-8 py-8">
        <div>
          <p className="font-display text-2xl font-semibold text-moss-900">{item.etiqueta}</p>
          <p className="mt-2 text-muted">{item.descripcion}</p>
          <Link href={item.href} className="mt-4 inline-flex font-semibold text-moss-700 underline-offset-4 hover:underline">
            Ver todo en {item.etiqueta.toLowerCase()} →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-8">
          {item.grupos.map((g) => (
            <nav key={g.titulo} aria-label={g.titulo}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss-700">{g.titulo}</p>
              <ul className="space-y-2">
                {g.enlaces.map((e) => (
                  <li key={e.href}>
                    <Link href={e.href} className="text-ink hover:text-moss-700 hover:underline underline-offset-4">
                      {e.etiqueta}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="overflow-hidden rounded-card">
          <BotanicalArt forma={arte.forma} semilla={`nav-${item.linea}`} colores={arte.colores} className="aspect-square" />
        </div>
      </div>
    </div>
  );
}

/** Navegacion principal con mega menu: hover, foco por teclado, Escape y clic fuera. */
export function MainNav() {
  const pathname = usePathname();
  const idBase = useId();
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => setAbierto(null), [pathname]);

  const cerrarSiSaleFoco = (e: FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(null);
  };
  const alTeclear = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === 'Escape' && abierto) {
      setAbierto(null);
      e.currentTarget.querySelector('button')?.focus();
    }
  };

  const enlaceClase = (href: string) =>
    cn(
      'rounded-full px-4 py-2 font-medium text-moss-900 transition-colors hover:bg-moss-100',
      pathname === href && 'bg-moss-100',
    );

  return (
    <nav aria-label="Principal" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {NAV_LINEAS.map((item) => {
          const idPanel = `${idBase}-${item.linea}`;
          const activo = abierto === item.linea;
          return (
            <li
              key={item.linea}
              onMouseEnter={() => setAbierto(item.linea)}
              onMouseLeave={() => setAbierto(null)}
              onBlur={cerrarSiSaleFoco}
              onKeyDown={alTeclear}
            >
              <button
                type="button"
                aria-expanded={activo}
                aria-controls={activo ? idPanel : undefined}
                onClick={() => setAbierto(activo ? null : item.linea)}
                className={cn(enlaceClase(item.href), 'inline-flex items-center gap-1', activo && 'bg-moss-100')}
              >
                {item.etiqueta}
                <ChevronDown className={cn('size-4 transition-transform', activo && 'rotate-180')} aria-hidden="true" />
              </button>
              {activo && <Panel item={item} id={idPanel} />}
            </li>
          );
        })}
        {NAV_EXTRA.map((e) => (
          <li key={e.href}>
            <Link href={e.href} className={enlaceClase(e.href)} aria-current={pathname === e.href ? 'page' : undefined}>
              {e.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
