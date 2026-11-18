import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { hrefCatalogo, type ConsultaCatalogo } from '@/domain/filtros';
import { obtenerRepositorio } from '@/infrastructure/repositorio';
import { FiltrosMovil, FiltrosPanel } from './filtros-panel';
import { GrillaProductos } from './grilla-productos';
import { OrdenSelect } from './orden-select';
import { Paginacion } from './paginacion';

/** Componente asincrono: se suspende mientras llegan datos y muestra el esqueleto del padre. */
export async function CatalogoContenido({ consulta }: { consulta: ConsultaCatalogo }) {
  const repo = obtenerRepositorio();
  const [resultado, facetas] = await Promise.all([
    repo.listar(consulta),
    consulta.linea ? repo.facetas(consulta.linea, consulta) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
      <FiltrosPanel consulta={consulta} facetas={facetas} />
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-muted">
            {resultado.total} {resultado.total === 1 ? 'producto' : 'productos'}
            {consulta.q ? <> para «<strong className="text-moss-900">{consulta.q}</strong>»</> : null}
          </p>
          <div className="flex items-center gap-3">
            <FiltrosMovil consulta={consulta} facetas={facetas} total={resultado.total} />
            <OrdenSelect consulta={consulta} />
          </div>
        </div>

        {resultado.items.length === 0 ? (
          <EmptyState
            icono={<SearchX className="size-10" />}
            titulo="No encontramos productos con esos criterios"
            descripcion="Prueba quitando algún filtro o buscando con otras palabras."
            accion={<Button asChild><Link href={hrefCatalogo({})}>Limpiar y ver todo</Link></Button>}
          />
        ) : (
          <>
            <GrillaProductos productos={resultado.items} />
            <Paginacion consulta={consulta} pagina={resultado.pagina} totalPaginas={resultado.totalPaginas} />
          </>
        )}
      </div>
    </div>
  );
}
