'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { MESES, NOMBRES_MES, type Mes } from '@/domain/producto';
import { cn } from '@/lib/cn';

export interface SemillaMes { slug: string; nombre: string }

function mesActualQuito(): Mes {
  const m = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'America/Guayaquil' }).format(new Date());
  return Number(m) as Mes;
}

/** Selector de mes: muestra que semillas conviene sembrar. Mes inicial = mes actual (tras hidratar). */
export function CalendarioSiembra({ porMes }: { porMes: Readonly<Record<number, readonly SemillaMes[]>> }) {
  const [mes, setMes] = useState<Mes>(1);
  useEffect(() => setMes(mesActualQuito()), []);
  const items = porMes[mes] ?? [];

  return (
    <div>
      <div role="group" aria-label="Mes de siembra" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {MESES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === mes}
            onClick={() => setMes(m)}
            className={cn(
              'h-11 min-w-14 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
              m === mes ? 'border-moss-700 bg-moss-700 text-cream-50' : 'border-line bg-white text-moss-900 hover:bg-moss-50',
            )}
          >
            {NOMBRES_MES[m - 1]}
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-40" aria-live="polite">
        {items.length === 0 ? (
          <EmptyState titulo="Mes tranquilo para sembrar" descripcion="No tenemos semillas recomendadas para este mes. Prueba con otro." />
        ) : (
          <ul key={mes} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <li key={s.slug} className="animate-fade-up">
                <Link href={`/producto/${s.slug}`} className="flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 font-medium text-moss-900 hover:border-moss-600 hover:shadow-soft">
                  {s.nombre}
                  <span aria-hidden="true" className="text-moss-600">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
