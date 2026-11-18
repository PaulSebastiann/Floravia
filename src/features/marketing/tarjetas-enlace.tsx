import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface TarjetaEnlaceData {
  titulo: string;
  descripcion: string;
  href: string;
  icono: LucideIcon;
  tono?: 'ramos' | 'plantas' | 'semillas' | 'neutro';
}

const TONO = {
  ramos: 'bg-petal-100 text-petal-700',
  plantas: 'bg-moss-100 text-moss-800',
  semillas: 'bg-sun-100 text-sun-800',
  neutro: 'bg-cream-200 text-moss-800',
} as const;

/** Grilla de tarjetas-enlace: ocasiones, niveles de cuidado, tipos de cultivo, etc. */
export function TarjetasEnlace({ items, columnas = 3 }: { items: readonly TarjetaEnlaceData[]; columnas?: 2 | 3 | 5 }) {
  return (
    <ul className={cn('grid gap-4 sm:grid-cols-2', columnas === 3 && 'lg:grid-cols-3', columnas === 5 && 'lg:grid-cols-5')}>
      {items.map(({ titulo, descripcion, href, icono: Icono, tono = 'neutro' }) => (
        <li key={titulo}>
          <Link
            href={href}
            className="group flex h-full flex-col gap-3 rounded-card border border-line bg-white p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift"
          >
            <span className={cn('inline-flex size-12 items-center justify-center rounded-2xl', TONO[tono])}>
              <Icono className="size-6" aria-hidden="true" />
            </span>
            <span className="flex items-start justify-between gap-2">
              <span className="font-display text-xl font-semibold text-moss-900">{titulo}</span>
              <ArrowUpRight className="size-5 shrink-0 text-moss-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
            <span className="text-sm text-muted">{descripcion}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
