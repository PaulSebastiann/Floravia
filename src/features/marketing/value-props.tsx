import type { LucideIcon } from 'lucide-react';

export interface ValorData { titulo: string; texto: string; icono: LucideIcon }

export function ValueProps({ items }: { items: readonly ValorData[] }) {
  return (
    <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ titulo, texto, icono: Icono }) => (
        <li key={titulo} className="flex flex-col items-start gap-3">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-moss-700 text-cream-50">
            <Icono className="size-6" aria-hidden="true" />
          </span>
          <h3 className="font-display text-xl font-semibold text-moss-900">{titulo}</h3>
          <p className="text-muted">{texto}</p>
        </li>
      ))}
    </ul>
  );
}
