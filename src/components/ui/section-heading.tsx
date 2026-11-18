import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  etiqueta?: string;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  alinear?: 'izquierda' | 'centro';
  className?: string;
  nivel?: 'h1' | 'h2';
}

export function SectionHeading({ etiqueta, titulo, descripcion, accion, alinear = 'izquierda', className, nivel = 'h2' }: Props) {
  const Titulo = nivel;
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        alinear === 'centro' && 'items-center text-center sm:flex-col sm:items-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', alinear === 'centro' && 'mx-auto')}>
        {etiqueta && (
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-moss-700">{etiqueta}</p>
        )}
        <Titulo className="font-display text-3xl font-semibold text-moss-900 sm:text-4xl">{titulo}</Titulo>
        {descripcion && <p className="mt-3 text-lg text-muted">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
