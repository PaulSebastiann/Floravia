export interface PasoData { titulo: string; texto: string }

export function Pasos({ pasos }: { pasos: readonly PasoData[] }) {
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {pasos.map((p, i) => (
        <li key={p.titulo} className="relative rounded-card bg-white p-6 shadow-soft">
          <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-moss-700 font-display text-lg font-semibold text-cream-50" aria-hidden="true">
            {i + 1}
          </span>
          <h3 className="font-display text-xl font-semibold text-moss-900">{p.titulo}</h3>
          <p className="mt-2 text-muted">{p.texto}</p>
        </li>
      ))}
    </ol>
  );
}
