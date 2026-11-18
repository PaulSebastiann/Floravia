import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { hrefCatalogo } from '@/domain/filtros';
import { cargarGuia, esSlugGuia, SLUGS_GUIAS } from '@/features/guias/guias';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => SLUGS_GUIAS.map((slug) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!esSlugGuia(slug)) return {};
  const { meta } = await cargarGuia(slug);
  return { title: meta.titulo, description: meta.resumen };
}

const PLURAL = { ramos: 'ramos', plantas: 'plantas', semillas: 'semillas' } as const;

export default async function GuiaPage({ params }: Props) {
  const { slug } = await params;
  if (!esSlugGuia(slug)) notFound();
  const { default: Contenido, meta } = await cargarGuia(slug);
  return (
    <Container className="py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link href="/guias" className="text-sm font-semibold text-moss-700 underline underline-offset-4">← Todas las guías</Link>
        <h1 className="mt-4 font-display text-4xl font-semibold text-moss-900 sm:text-5xl">{meta.titulo}</h1>
        <p className="mt-3 text-sm text-muted">{meta.minutos} min de lectura</p>
        <div className="mt-6"><Contenido /></div>
        <div className="mt-12 rounded-card bg-moss-50 p-6">
          <p className="font-display text-xl font-semibold text-moss-900">¿Listo para empezar?</p>
          <Button asChild className="mt-4"><Link href={hrefCatalogo({ linea: meta.linea })}>Ver {PLURAL[meta.linea]}</Link></Button>
        </div>
      </article>
    </Container>
  );
}
