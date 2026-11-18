'use client';

import { Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { hrefCatalogo } from '@/domain/filtros';
import type { Sugerencia } from '@/domain/puertos/producto-repositorio';
import { cn } from '@/lib/cn';

export type BuscarSugerencias = (q: string, signal: AbortSignal) => Promise<readonly Sugerencia[]>;

const buscarPorDefecto: BuscarSugerencias = async (q, signal) => {
  const res = await fetch(`/api/sugerencias?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Sugerencia[];
};

const ETIQUETA_LINEA = { ramos: 'Ramo', plantas: 'Planta', semillas: 'Semilla' } as const;
const MIN_CARACTERES = 2;
const DEBOUNCE_MS = 200;

interface Props {
  className?: string;
  buscar?: BuscarSugerencias;
  debounceMs?: number;
}

/**
 * Buscador con autocompletado (patron ARIA 1.2 combobox + listbox).
 * Cancela peticiones obsoletas con AbortController para evitar resultados fuera de orden.
 */
export function SearchBox({ className, buscar = buscarPorDefecto, debounceMs = DEBOUNCE_MS }: Props) {
  const router = useRouter();
  const idBase = useId();
  const idLista = `${idBase}-lista`;
  const [valor, setValor] = useState('');
  const [sugerencias, setSugerencias] = useState<readonly Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Espejo de `sugerencias` para leerlo dentro de callbacks asincronos sin cierres obsoletos.
  const sugerenciasRef = useRef<readonly Sugerencia[]>([]);

  const termino = valor.trim();
  const buscable = termino.length >= MIN_CARACTERES;

  useEffect(() => {
    if (!buscable) {
      sugerenciasRef.current = [];
      setSugerencias([]); setCargando(false); setError(false); setActivo(-1);
      return;
    }
    const ctrl = new AbortController();
    setCargando(true); setError(false);
    const t = setTimeout(() => {
      buscar(termino, ctrl.signal)
        .then((r) => {
          const previas = sugerenciasRef.current;
          // Una respuesta tardia no debe borrar lo que el usuario ya eligio con el teclado:
          // se conserva la seleccion por slug (o la fila "Ver todos") si sigue existiendo.
          setActivo((a) => {
            if (a < 0) return -1;
            if (a === previas.length) return r.length;
            const slug = previas[a]?.slug;
            const idx = slug === undefined ? -1 : r.findIndex((s) => s.slug === slug);
            return idx;
          });
          sugerenciasRef.current = r;
          setSugerencias(r);
          setCargando(false);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          sugerenciasRef.current = [];
          setSugerencias([]); setActivo(-1); setError(true); setCargando(false);
        });
    }, debounceMs);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [termino, buscable, buscar, debounceMs]);

  const totalOpciones = sugerencias.length + (buscable ? 1 : 0); // +1 = "Ver todos"
  const idOpcion = (i: number) => `${idBase}-opt-${i}`;

  function irACatalogo() {
    setAbierto(false);
    router.push(hrefCatalogo({ q: termino }));
  }

  function elegir(i: number) {
    const s = sugerencias[i];
    setAbierto(false);
    if (s) router.push(`/producto/${s.slug}`);
    else irACatalogo();
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!abierto) setAbierto(true);
        if (totalOpciones > 0) setActivo((a) => (a + 1) % totalOpciones);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (totalOpciones > 0) setActivo((a) => (a <= 0 ? totalOpciones - 1 : a - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (!buscable) return;
        if (activo >= 0) elegir(activo);
        else irACatalogo();
        break;
      case 'Escape':
        if (abierto) { e.preventDefault(); setAbierto(false); setActivo(-1); }
        else setValor('');
        break;
    }
  }

  const mostrarPanel = abierto && buscable;
  const anuncio = cargando
    ? 'Buscando'
    : error
      ? 'No se pudieron cargar las sugerencias'
      : buscable
        ? sugerencias.length === 0 ? 'Sin sugerencias' : `${sugerencias.length} sugerencias disponibles`
        : '';

  return (
    <div
      className={cn('relative', className)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setAbierto(false); setActivo(-1); } }}
    >
      <form role="search" aria-label="Buscar en Floravia" onSubmit={(e) => { e.preventDefault(); if (buscable) irACatalogo(); }}>
        <label htmlFor={`${idBase}-input`} className="sr-only">Buscar flores, plantas o semillas</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-moss-700" aria-hidden="true" />
          <input
            ref={inputRef}
            id={`${idBase}-input`}
            type="search"
            role="combobox"
            aria-expanded={mostrarPanel}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={mostrarPanel && activo >= 0 ? idOpcion(activo) : undefined}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            enterKeyHint="search"
            placeholder="Buscar productos…"
            value={valor}
            onChange={(e) => { setValor(e.target.value); setAbierto(true); }}
            onFocus={() => setAbierto(true)}
            onKeyDown={alTeclear}
            className="h-12 w-full rounded-full border border-line bg-white pl-12 pr-12 text-base text-ink placeholder:text-muted/80 focus:border-moss-600"
          />
          {cargando && (
            <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-moss-600" aria-hidden="true" />
          )}
        </div>
      </form>

      <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>

      {mostrarPanel && (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Sugerencias de búsqueda"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-lift animate-fade-in"
        >
          {error && <li role="presentation" className="px-4 py-3 text-sm text-petal-700">No pudimos cargar sugerencias. Pulsa Enter para buscar.</li>}
          {!error && !cargando && sugerencias.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-sm text-muted">Sin sugerencias para «{termino}».</li>
          )}
          {sugerencias.map((s, i) => (
            <li
              key={s.slug}
              id={idOpcion(i)}
              role="option"
              aria-selected={i === activo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(i)}
              onMouseEnter={() => setActivo(i)}
              className={cn('flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5', i === activo && 'bg-moss-50')}
            >
              <span className="font-medium text-moss-900">{s.nombre}</span>
              <Badge tono={s.linea}>{ETIQUETA_LINEA[s.linea]}</Badge>
            </li>
          ))}
          <li
            id={idOpcion(sugerencias.length)}
            role="option"
            aria-selected={activo === sugerencias.length}
            onMouseDown={(e) => e.preventDefault()}
            onClick={irACatalogo}
            onMouseEnter={() => setActivo(sugerencias.length)}
            className={cn('cursor-pointer border-t border-line px-4 py-2.5 text-sm font-semibold text-moss-700', activo === sugerencias.length && 'bg-moss-50')}
          >
            Ver todos los resultados para «{termino}»
          </li>
        </ul>
      )}
    </div>
  );
}
