'use client';

import { LogOut, Package, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { salirAccion } from '@/app/acciones/cuenta';
import { useTienda } from '@/features/tienda/tienda-provider';

/** Entrada a la cuenta. Sin sesion: "Ingresar" y "Crear cuenta" siempre visibles. */
export function MenuCuenta() {
  const { sesion, compra, cargando, olvidarSesion } = useTienda();
  const [pendiente, iniciar] = useTransition();
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  // <details> no se cierra solo: se cierra al navegar, al hacer clic fuera y con Escape.
  useEffect(() => { if (menu.current) menu.current.open = false; }, [pathname]);
  useEffect(() => {
    const cerrar = (e: Event) => {
      const m = menu.current;
      if (!m?.open) return;
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      if (e.type === 'click' && m.contains(e.target as Node)) return;
      m.open = false;
      if (e.type === 'keydown') m.querySelector('summary')?.focus();
    };
    document.addEventListener('click', cerrar);
    document.addEventListener('keydown', cerrar);
    return () => { document.removeEventListener('click', cerrar); document.removeEventListener('keydown', cerrar); };
  }, []);

  // Si el estado inicial todavía carga, evitamos mostrar una sesión incorrecta.
  if (!compra && !cargando) return null;
  if (cargando) return <div className="h-11 w-24 animate-pulse rounded-full bg-moss-100" aria-hidden="true" />;

  if (!sesion) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/cuenta/ingresar" className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium text-moss-900 hover:bg-moss-100">
          <UserRound className="size-5" aria-hidden="true" /><span className="sr-only xl:not-sr-only">Ingresar</span>
        </Link>
        <Link href="/cuenta/crear" className="hidden h-11 items-center whitespace-nowrap rounded-full bg-moss-700 px-4 text-sm font-medium text-cream-50 hover:bg-moss-900 xl:inline-flex">
          Crear cuenta
        </Link>
      </div>
    );
  }

  const primerNombre = sesion.nombre.split(' ')[0] ?? sesion.nombre;
  return (
    <details ref={menu} className="group relative">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-sm font-medium text-moss-900 hover:bg-moss-100 [&::-webkit-details-marker]:hidden">
        <UserRound className="size-5" aria-hidden="true" />
        <span className="max-w-28 truncate sr-only xl:not-sr-only">Hola, {primerNombre}</span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-line bg-cream-50 p-2 shadow-lift">
        <p className="truncate px-3 py-2 text-sm text-muted">{sesion.correo}</p>
        <Link href="/cuenta/pedidos" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-moss-100"><Package className="size-4" aria-hidden="true" />Mis pedidos</Link>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => iniciar(async () => { olvidarSesion(); await salirAccion(); })}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-moss-100 disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden="true" />Cerrar sesión
        </button>
      </div>
    </details>
  );
}
