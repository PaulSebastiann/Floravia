import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  accion?: ReactNode;
  className?: string;
}

export function EmptyState({ titulo, descripcion, icono, accion, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-cream-100/60 px-6 py-14 text-center',
        className,
      )}
    >
      {icono && <div className="text-moss-600" aria-hidden="true">{icono}</div>}
      <h3 className="text-xl font-semibold text-moss-900">{titulo}</h3>
      {descripcion && <p className="max-w-md text-muted">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}
