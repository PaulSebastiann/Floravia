import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/ui/container';
import { parsearConsulta, serializarConsulta } from '@/domain/filtros';
import { CatalogoContenido } from '@/features/catalogo/catalogo-contenido';
import { GrillaEsqueleto } from '@/features/catalogo/grilla-productos';

type Params = Promise<Record<string, string | string[] | undefined>>;

const TITULOS = { ramos: 'Ramos y flores', plantas: 'Plantas', semillas: 'Semillas' } as const;

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const c = parsearConsulta(await searchParams);
  const titulo = c.linea ? TITULOS[c.linea] : 'Catálogo';
  // Evita indexar infinitas combinaciones de filtros/busquedas.
  const filtrada = Boolean(c.q) || Object.keys(c.filtros).length > 0 || c.pagina > 1 || c.orden !== 'relevancia';
  return { title: titulo, robots: filtrada ? { index: false, follow: true } : undefined };
}

export default async function CatalogoPage({ searchParams }: { searchParams: Params }) {
  const consulta = parsearConsulta(await searchParams);
  const clave = serializarConsulta(consulta).toString();
  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-moss-900 sm:text-5xl">
          {consulta.linea ? TITULOS[consulta.linea] : 'Todo el catálogo'}
        </h1>
        <p className="mt-2 text-lg text-muted">Flores, plantas y semillas. Filtra por lo que necesitas.</p>
      </header>
      {/* key = consulta: cada cambio de filtros vuelve a mostrar el esqueleto. */}
      <Suspense key={clave} fallback={<GrillaEsqueleto />}>
        <CatalogoContenido consulta={consulta} />
      </Suspense>
    </Container>
  );
}
