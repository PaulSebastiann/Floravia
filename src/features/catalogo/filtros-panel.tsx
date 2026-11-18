'use client';

import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { filtrosDe, hrefCatalogo, type ConsultaCatalogo } from '@/domain/filtros';
import { LINEAS } from '@/domain/producto';
import type { Faceta } from '@/domain/puertos/producto-repositorio';
import { cn } from '@/lib/cn';

const NOMBRE_PLURAL = { ramos: 'Ramos', plantas: 'Plantas', semillas: 'Semillas' } as const;

interface Props {
  consulta: ConsultaCatalogo;
  facetas: readonly Faceta[];
}

function contenido(consulta: ConsultaCatalogo, facetas: readonly Faceta[], alternar: (clave: string, valor: string) => void, pendiente: boolean) {
  const linea = consulta.linea;
  return (
    <div className={cn('space-y-7 transition-opacity', pendiente && 'opacity-60')} aria-busy={pendiente}>
      <nav aria-label="Línea de producto">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss-700">Línea</p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={hrefCatalogo({ q: consulta.q })} aria-current={!linea ? 'true' : undefined}
              className={cn('inline-flex rounded-full border px-4 py-1.5 text-sm font-medium', !linea ? 'border-moss-700 bg-moss-700 text-cream-50' : 'border-line bg-white hover:bg-moss-50')}>
              Todo
            </Link>
          </li>
          {LINEAS.map((l) => (
            <li key={l}>
              <Link href={hrefCatalogo({ q: consulta.q, linea: l })} aria-current={linea === l ? 'true' : undefined}
                className={cn('inline-flex rounded-full border px-4 py-1.5 text-sm font-medium', linea === l ? 'border-moss-700 bg-moss-700 text-cream-50' : 'border-line bg-white hover:bg-moss-50')}>
                {NOMBRE_PLURAL[l]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!linea && (
        <p className="rounded-xl bg-cream-100 p-4 text-sm text-muted">
          Elige una línea para ver filtros específicos: ocasión y color para ramos, cuidado y luz para plantas, cultivo y mes de siembra para semillas.
        </p>
      )}

      {linea && filtrosDe(linea).map((def) => {
        const faceta = facetas.find((f) => f.clave === def.clave);
        const seleccion = consulta.filtros[def.clave] ?? [];
        return (
          <fieldset key={def.clave}>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss-700">{def.etiqueta}</legend>
            <ul className="space-y-1">
              {def.opciones.map((o) => {
                const cantidad = faceta?.valores.find((v) => v.valor === o.valor)?.cantidad ?? 0;
                const marcado = seleccion.includes(o.valor);
                const sinResultados = cantidad === 0 && !marcado;
                const id = `f-${def.clave}-${o.valor}`;
                return (
                  <li key={o.valor}>
                    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-moss-50', sinResultados && 'cursor-not-allowed opacity-45 hover:bg-transparent')}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={marcado}
                        disabled={sinResultados}
                        onChange={() => alternar(def.clave, o.valor)}
                        className="size-4 accent-moss-700"
                      />
                      <span className="flex-1 text-sm text-ink">{o.etiqueta}</span>
                      <span className="text-xs tabular-nums text-muted" aria-label={`${cantidad} productos`}>{cantidad}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      {Object.keys(consulta.filtros).length > 0 && (
        <Link href={hrefCatalogo({ q: consulta.q, linea })} className="inline-flex text-sm font-semibold text-petal-700 underline underline-offset-4">
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}

function useFiltros(consulta: ConsultaCatalogo) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  // Estado optimista: el checkbox responde al instante y se reconcilia cuando llega la URL nueva.
  const [filtros, setFiltrosOptimista] = useOptimistic(consulta.filtros);

  const alternar = (clave: string, valor: string) => {
    const actual = filtros[clave] ?? [];
    const nuevo = actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor];
    const siguiente = Object.fromEntries(
      Object.entries({ ...filtros, [clave]: nuevo }).filter(([, v]) => v.length > 0),
    );
    iniciar(() => {
      setFiltrosOptimista(siguiente);
      // Cambiar un filtro reinicia la paginacion.
      router.replace(hrefCatalogo({ ...consulta, filtros: siguiente, pagina: 1 }), { scroll: false });
    });
  };
  return { alternar, pendiente, consultaVisible: { ...consulta, filtros } satisfies ConsultaCatalogo };
}

export function FiltrosPanel({ consulta, facetas }: Props) {
  const { alternar, pendiente, consultaVisible } = useFiltros(consulta);
  return <aside aria-label="Filtros" className="hidden lg:block">{contenido(consultaVisible, facetas, alternar, pendiente)}</aside>;
}

export function FiltrosMovil({ consulta, facetas, total }: Props & { total: number }) {
  const { alternar, pendiente, consultaVisible } = useFiltros(consulta);
  const activos = Object.values(consultaVisible.filtros).reduce((n, v) => n + v.length, 0);
  return (
    <div className="lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variante="contorno" tamano="sm">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros{activos > 0 ? ` (${activos})` : ''}
          </Button>
        </SheetTrigger>
        <SheetContent titulo="Filtros" descripcion="Filtrar productos" lado="izquierda">
          <div className="p-5">{contenido(consultaVisible, facetas, alternar, pendiente)}</div>
          <div className="sticky bottom-0 border-t border-line bg-cream-50 p-4">
            <SheetClose asChild>
              <Button className="w-full">Ver {total} {total === 1 ? 'producto' : 'productos'}</Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

