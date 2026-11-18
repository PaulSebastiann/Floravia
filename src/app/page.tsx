import { Flower2, Leaf, ShieldCheck, Sprout, Truck, Droplets, HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GrillaProductos } from '@/features/catalogo/grilla-productos';
import { GuiasTeaser } from '@/features/guias/guias-teaser';
import { CtaBanda } from '@/features/marketing/cta-banda';
import { LandingHero } from '@/features/marketing/landing-hero';
import { TarjetasEnlace } from '@/features/marketing/tarjetas-enlace';
import { Testimonios } from '@/features/marketing/testimonios';
import { ValueProps } from '@/features/marketing/value-props';
import { obtenerRepositorio } from '@/infrastructure/repositorio';

export default async function HomePage() {
  const repo = obtenerRepositorio();
  const [ramos, plantas, semillas] = await Promise.all([
    repo.masVendidos('ramos', 4),
    repo.masVendidos('plantas', 4),
    repo.masVendidos('semillas', 4),
  ]);

  return (
    <>
      <LandingHero
        tono="home"
        etiqueta="Flores · Plantas · Semillas"
        titulo="Naturaleza para celebrar la vida"
        descripcion="Ramos para regalar, plantas que acompañan y semillas para empezar tu propio jardín. Con entrega a domicilio en Quito y asesoría cercana."
        ctaPrimario={{ texto: 'Explorar el catálogo', href: '/catalogo' }}
        ctaSecundario={{ texto: 'Cómo cuidar mis plantas', href: '/guias' }}
        puntos={['Entrega a domicilio en Quito', 'Asesoría para tus plantas', 'Arreglos a tu medida']}
      />

      <section aria-labelledby="lineas" className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            etiqueta="Nuestras líneas"
            titulo="Elige por dónde empezar"
            descripcion="Tres formas de llevar naturaleza a tu vida o a la de alguien especial."
          />
          <h2 id="lineas" className="sr-only">Líneas de producto</h2>
          <div className="mt-10">
            <TarjetasEnlace
              items={[
                { titulo: 'Ramos y flores', descripcion: 'Aniversarios, cumpleaños y gestos que dicen más que las palabras.', href: '/ramos', icono: Flower2, tono: 'ramos' },
                { titulo: 'Plantas', descripcion: 'De interior, exterior y suculentas. Para cada luz y cada nivel de experiencia.', href: '/plantas', icono: Leaf, tono: 'plantas' },
                { titulo: 'Semillas', descripcion: 'Flores, huerto y aromáticas para sembrar desde casa.', href: '/semillas', icono: Sprout, tono: 'semillas' },
              ]}
            />
          </div>
        </Container>
      </section>

      <section aria-label="Más vendidos" className="bg-cream-100 py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Más vendidos" titulo="Lo que más se llevan nuestros clientes" />
          <Tabs defaultValue="ramos" className="mt-8">
            <TabsList aria-label="Categoría">
              <TabsTrigger value="ramos">Ramos</TabsTrigger>
              <TabsTrigger value="plantas">Plantas</TabsTrigger>
              <TabsTrigger value="semillas">Semillas</TabsTrigger>
            </TabsList>
            {([['ramos', ramos, '/ramos'], ['plantas', plantas, '/plantas'], ['semillas', semillas, '/semillas']] as const).map(([valor, items, href]) => (
              <TabsContent key={valor} value={valor}>
                <GrillaProductos productos={items} />
                <div className="mt-8 text-center">
                  <Button asChild variante="contorno"><Link href={href}>Ver toda la línea</Link></Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Container>
      </section>

      <section aria-label="Por qué elegirnos" className="py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Por qué Floravia" titulo="Un negocio local que cuida cada detalle" alinear="centro" />
          <div className="mt-12">
            <ValueProps
              items={[
                { titulo: 'Entrega en Quito', texto: 'Coordinamos tu pedido en la dirección y el horario que elijas.', icono: Truck },
                { titulo: 'Frescura cuidada', texto: 'Elegimos cada flor y cada planta pensando en su vitalidad y duración.', icono: ShieldCheck },
                { titulo: 'Asesoría para tus plantas', texto: 'Te orientamos con luz, riego y ubicación según la especie que elijas.', icono: Droplets },
                { titulo: 'Arreglos a tu medida', texto: 'Convertimos una ocasión, un color o una idea en un detalle especial.', icono: HeartHandshake },
              ]}
            />
          </div>
        </Container>
      </section>

      <Testimonios />
      <GuiasTeaser />
      <CtaBanda
        titulo="¿Buscas algo especial?"
        texto="Cuéntanos la ocasión, el espacio o el presupuesto y te ayudamos a elegir."
        mensaje="Hola Floravia, quisiera una recomendación personalizada."
      />
    </>
  );
}
