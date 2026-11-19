import { AlertCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const clasesInput =
  'h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-muted/70 ' +
  'transition-colors hover:border-moss-300 focus-visible:border-moss-600 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-moss-300 ' +
  'aria-[invalid=true]:border-petal-700 disabled:opacity-60';

interface CampoProps extends Omit<ComponentProps<'input'>, 'id'> {
  readonly id: string;
  readonly etiqueta: string;
  readonly error?: string;
  readonly ayuda?: ReactNode;
  readonly claseContenedor?: string;
}

/** Input etiquetado con error enlazado por aria-describedby (lector de pantalla lo anuncia). */
export function Campo({ id, etiqueta, error, ayuda, claseContenedor, className, ...props }: CampoProps) {
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const describe = [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={claseContenedor}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-moss-900">{etiqueta}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describe} className={cn(clasesInput, className)} {...props} />
      {ayuda && !error && <p id={idAyuda} className="mt-1.5 text-xs text-muted">{ayuda}</p>}
      {error && <p id={idError} className="mt-1.5 flex items-center gap-1.5 text-sm text-petal-700"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</p>}
    </div>
  );
}

export function Alerta({ tono = 'error', children, className }: { tono?: 'error' | 'info' | 'exito' | 'aviso'; children: ReactNode; className?: string }) {
  const estilos = {
    error: 'bg-petal-100 text-petal-700 border-petal-200',
    aviso: 'bg-sun-100 text-sun-800 border-sun-500/30',
    info: 'bg-moss-50 text-moss-800 border-moss-200',
    exito: 'bg-moss-100 text-moss-900 border-moss-300',
  } as const;
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', estilos[tono], className)}>
      {children}
    </div>
  );
}
