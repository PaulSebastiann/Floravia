import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { SITIO } from '@/content/sitio';
import { formatearUSD } from '@/domain/dinero';
import { hrefCatalogo } from '@/domain/filtros';
import { NOMBRE_LINEA } from '@/features/catalogo/etiquetas';
import { CarruselProductos } from '@/features/catalogo/grilla-productos';
import { OpcionesProducto } from '@/features/catalogo/opciones-producto';
import { PestanasProducto } from '@/features/catalogo/pestanas-producto';
import { ProductoVisual } from '@/features/catalogo/producto-visual';
import { obtenerRepositorio } from '@/infrastructure/repositorio';

type Props = { params: Promise<{ slug: string }> };

const PLURAL = { ramos: 'Ramos y flores', plantas: 'Plantas', semillas: 'Semillas' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await obtenerRepositorio().porSlug(slug);
  if (!p) return { title: 'Producto no encontrado' };
  return { title: p.nombre, description: p.resumen, openGraph: { title: p.nombre, description: p.resumen } };
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const repo = obtenerRepositorio();
  const producto = await repo.porSlug(slug);
  if (!producto) notFound();
  const relacionados = await repo.relacionados(producto, 4);

  // JSON-LD: se serializa y se escapa "<" para que ningun valor cierre el <script>.
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.resumen,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: (producto.precio / 100).toFixed(2),
      availability: producto.disponible ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITIO.url}/producto/${producto.slug}`,
    },
  }).replace(/</g, '\\u003c');

  return (
    <Container className="py-8 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <nav aria-label="Migas de pan" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="hover:underline">Inicio</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={hrefCatalogo({ linea: producto.linea })} className="hover:underline">{PLURAL[producto.linea]}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-moss-900">{producto.nombre}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="self-start overflow-hidden rounded-[1.75rem] border border-line bg-cream-100 lg:sticky lg:top-28">
          <div className="aspect-square"><ProductoVisual producto={producto} /></div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tono={producto.linea}>{NOMBRE_LINEA[producto.linea]}</Badge>
            {!producto.disponible && <Badge tono="agotado">Agotado</Badge>}
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold text-moss-900 sm:text-5xl">{producto.nombre}</h1>
          <p className="mt-3 text-lg text-muted">{producto.resumen}</p>
          <p className="mt-4 text-3xl font-semibold text-moss-800">{formatearUSD(producto.precio)}</p>

          <div className="mt-8"><OpcionesProducto producto={producto} /></div>
          <div className="mt-10"><PestanasProducto producto={producto} /></div>
        </div>
      </div>

      {relacionados.length > 0 && (
        <section aria-label="Productos relacionados" className="mt-20">
          <SectionHeading titulo="También te puede gustar" />
          <div className="mt-8"><CarruselProductos productos={relacionados} etiqueta="Productos relacionados" /></div>
        </section>
      )}
    </Container>
  );
}
