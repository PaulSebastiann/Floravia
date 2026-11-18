import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { hrefCatalogo, type ConsultaCatalogo } from '@/domain/filtros';
import { cn } from '@/lib/cn';

export function Paginacion({ consulta, pagina, totalPaginas }: { consulta: ConsultaCatalogo; pagina: number; totalPaginas: number }) {
  if (totalPaginas <= 1) return null;
  const href = (n: number) => hrefCatalogo({ ...consulta, pagina: n });
  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const base = 'inline-flex size-11 items-center justify-center rounded-full border text-sm font-semibold';
  return (
    <nav aria-label="Paginación" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-2">
        <li>
          {pagina > 1 ? (
            <Link href={href(pagina - 1)} aria-label="Página anterior" className={cn(base, 'border-line bg-white hover:bg-moss-50')}><ChevronLeft className="size-4" aria-hidden="true" /></Link>
          ) : null}
        </li>
        {paginas.map((n) => (
          <li key={n}>
            <Link href={href(n)} aria-current={n === pagina ? 'page' : undefined} aria-label={`Página ${n}`}
              className={cn(base, n === pagina ? 'border-moss-700 bg-moss-700 text-cream-50' : 'border-line bg-white hover:bg-moss-50')}>
              {n}
            </Link>
          </li>
        ))}
        <li>
          {pagina < totalPaginas ? (
            <Link href={href(pagina + 1)} aria-label="Página siguiente" className={cn(base, 'border-line bg-white hover:bg-moss-50')}><ChevronRight className="size-4" aria-hidden="true" /></Link>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
