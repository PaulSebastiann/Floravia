import { Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { MetaGuia, SlugGuia } from './guias';

const NOMBRE = { ramos: 'Ramos', plantas: 'Plantas', semillas: 'Semillas' } as const;
const FONDO = { ramos: 'bg-petal-100', plantas: 'bg-moss-100', semillas: 'bg-sun-100' } as const;

export function TarjetaGuia({ slug, meta }: { slug: SlugGuia; meta: MetaGuia }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-white transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className={cn('flex h-28 items-end p-4', FONDO[meta.linea])}>
        <Badge tono={meta.linea}>{NOMBRE[meta.linea]}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-xl font-semibold text-moss-900">
          <Link href={`/guias/${slug}`} className="after:absolute after:inset-0">{meta.titulo}</Link>
        </h3>
        <p className="text-muted">{meta.resumen}</p>
        <p className="mt-auto flex items-center gap-1.5 pt-3 text-sm text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {meta.minutos} min de lectura
        </p>
      </div>
    </article>
  );
}
