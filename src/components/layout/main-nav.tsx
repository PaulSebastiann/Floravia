'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { NAV_EXTRA, NAV_LINEAS, type LineaNav } from './nav-data';

const ARTE = {
  ramos: '/images/productos/ramos/ramo-ternura.jpg',
  plantas: '/images/productos/plantas/planta-monstera.jpg',
  semillas: '/images/landing/bouquet-color.jpg',
} as const;

function Panel({ item, id }: { item: LineaNav; id: string }) {
  const foto = ARTE[item.linea];
  const alt = item.linea === 'semillas' ? 'Flores coloridas para cultivar desde semilla' : 'Producto destacado de la tienda';
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt={alt} className="aspect-square size-full object-cover" />
        </div>
      </div>
    </div>
  );
}

/** Navegacion principal con mega menu: hover, foco por teclado, Escape y clic fuera. */
/** Tiempo que el menu tolera que el mouse salga del area (hueco o diagonal) antes de cerrarse. */
export const RETARDO_CIERRE_MS = 200;

export function MainNav() {
  const pathname = usePathname();
  const idBase = useId();
  const [abierto, setAbierto] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelarCierre = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = undefined;
  }, []);
  /** Abre al instante y cancela cualquier cierre pendiente (el mouse volvio a la zona). */
  const abrir = useCallback((linea: string) => { cancelarCierre(); setAbierto(linea); }, [cancelarCierre]);
  /** Cierra con retardo: da tiempo a cruzar el hueco boton-panel o a moverse en diagonal. */
  const programarCierre = useCallback(() => {
    cancelarCierre();
    temporizador.current = setTimeout(() => setAbierto(null), RETARDO_CIERRE_MS);
  }, [cancelarCierre]);

  useEffect(() => { cancelarCierre(); setAbierto(null); }, [pathname, cancelarCierre]);
  useEffect(() => cancelarCierre, [cancelarCierre]); // limpia el temporizador al desmontar

  const cerrarSiSaleFoco = (e: FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) { cancelarCierre(); setAbierto(null); }
  };
  const alTeclear = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === 'Escape' && abierto) {
      cancelarCierre();
      setAbierto(null);
      e.currentTarget.querySelector('button')?.focus();
    }
  };

  const enlaceClase = (href: string) =>
    cn(
      'rounded-full px-3 py-2 font-medium text-moss-900 xl:px-4 transition-colors hover:bg-moss-100',
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
              onMouseEnter={() => abrir(item.linea)}
              onMouseLeave={programarCierre}
              onBlur={cerrarSiSaleFoco}
              onKeyDown={alTeclear}
            >
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={activo}
                  aria-controls={activo ? idPanel : undefined}
                  onClick={() => { cancelarCierre(); setAbierto(activo ? null : item.linea); }}
                  className={cn(enlaceClase(item.href), 'inline-flex items-center gap-1 whitespace-nowrap', activo && 'bg-moss-100')}
                >
                  {item.etiqueta}
                  <ChevronDown className={cn('size-4 transition-transform', activo && 'rotate-180')} aria-hidden="true" />
                </button>
                {/* Puente invisible: cubre el hueco entre el boton y el panel para que el hover no se pierda. */}
                {activo && <span aria-hidden="true" data-puente className="absolute inset-x-0 top-full h-8" />}
              </div>
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
