'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ORDENES, hrefCatalogo, type ConsultaCatalogo, type Orden } from '@/domain/filtros';

const ETIQUETAS: Record<Orden, string> = {
  relevancia: 'Relevancia',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
  nombre: 'Nombre (A–Z)',
};

export function OrdenSelect({ consulta }: { consulta: ConsultaCatalogo }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Ordenar</span>
      <select
        value={consulta.orden}
        disabled={pendiente}
        onChange={(e) => {
          const orden = e.target.value as Orden;
          iniciar(() => router.replace(hrefCatalogo({ ...consulta, orden, pagina: 1 }), { scroll: false }));
        }}
        className="h-10 rounded-full border border-line bg-white px-4 text-ink"
      >
        {ORDENES.map((o) => <option key={o} value={o}>{ETIQUETAS[o]}</option>)}
      </select>
    </label>
  );
}
