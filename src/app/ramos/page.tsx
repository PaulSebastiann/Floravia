import type { Metadata } from 'next';
import { Cake, Gift, Heart, HeartHandshake, Palette, Truck, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { hrefWhatsApp } from '@/content/sitio';
import { hrefCatalogo } from '@/domain/filtros';
import { CarruselProductos } from '@/features/catalogo/grilla-productos';
import { GuiasTeaser } from '@/features/guias/guias-teaser';
import { CtaBanda } from '@/features/marketing/cta-banda';
import { Faq } from '@/features/marketing/faq';
import { LandingHero } from '@/features/marketing/landing-hero';
import { Pasos } from '@/features/marketing/pasos';
import { TarjetasEnlace } from '@/features/marketing/tarjetas-enlace';
import { ValueProps } from '@/features/marketing/value-props';
import { capacidades, esperarSolicitud, obtenerRepositorio } from '@/infrastructure/repositorio';

export const metadata: Metadata = {
  title: 'Ramos y flores a domicilio en Quito',
  description: 'Ramos para aniversarios, cumpleaños y ocasiones especiales, con arreglos personalizados y entrega a domicilio en Quito.',
};

const ocasion = (valor: string) => hrefCatalogo({ linea: 'ramos', filtros: { ocasion: [valor] } });

export default async function RamosPage() {
  await esperarSolicitud();
  const repo = obtenerRepositorio();
  const cap = capacidades();
  const [masVendidos, destacados] = await Promise.all([repo.masVendidos('ramos', 4), repo.destacados('ramos', 4)]);

  return (
    <>
      <LandingHero
        tono="ramos"
        etiqueta="Ramos y flores"
        titulo="El detalle perfecto para cada ocasión"
        descripcion="Ramos hechos con atención al color, la ocasión y la persona que los recibe. Elige uno de nuestros diseños o cuéntanos tu idea."
        ctaPrimario={{ texto: 'Ver todos los ramos', href: hrefCatalogo({ linea: 'ramos' }) }}
        ctaSecundario={{ texto: 'Armar uno a mi medida', href: hrefWhatsApp('Hola Floravia, quisiera armar un arreglo personalizado.'), externo: true }}
        puntos={['Entrega a domicilio en Quito', 'Tarjeta con tu mensaje', 'Flores seleccionadas']}
      />

      {cap.atributos && (
      <section aria-label="Compra por ocasión" className="py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Por ocasión" titulo="¿Qué quieres celebrar?" descripcion="Elige la ocasión y te mostramos los ramos que mejor encajan." />
          <div className="mt-10">
            <TarjetasEnlace
              columnas={5}
              items={[
                { titulo: 'Aniversario', descripcion: 'Rosas y tonos cálidos.', href: ocasion('aniversario'), icono: Heart, tono: 'ramos' },
                { titulo: 'Cumpleaños', descripcion: 'Color y alegría.', href: ocasion('cumpleanos'), icono: Cake, tono: 'ramos' },
                { titulo: 'Amor', descripcion: 'Un gesto que habla solo.', href: ocasion('amor'), icono: Heart, tono: 'ramos' },
                { titulo: 'Agradecimiento', descripcion: 'Para decir gracias.', href: ocasion('agradecimiento'), icono: Gift, tono: 'ramos' },
                { titulo: 'Condolencias', descripcion: 'Acompañar con respeto.', href: ocasion('condolencias'), icono: HeartHandshake, tono: 'ramos' },
              ]}
            />
          </div>
        </Container>
      </section>
      )}

      <section aria-label={cap.masVendidos ? 'Más vendidos' : 'Novedades'} className="bg-cream-100 py-16 sm:py-20">
        <Container>
          <SectionHeading
            etiqueta={cap.masVendidos ? 'Más vendidos' : 'Novedades'}
            titulo={cap.masVendidos ? 'Los favoritos de nuestros clientes' : 'Lo más reciente en nuestro catálogo'}
            accion={<Button asChild variante="contorno" tamano="sm"><Link href={hrefCatalogo({ linea: 'ramos' })}>Ver todos</Link></Button>}
          />
          <div className="mt-8"><CarruselProductos productos={masVendidos} etiqueta="Ramos más vendidos" /></div>
        </Container>
      </section>

      <section aria-label="Arreglos personalizados" className="py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="A tu medida" titulo="Diseñemos tu arreglo juntos" descripcion="¿No encuentras lo que imaginas? Lo preparamos contigo en cuatro pasos." alinear="centro" />
          <div className="mt-10">
            <Pasos
              pasos={[
                { titulo: 'Cuéntanos', texto: 'La ocasión, a quién va dirigido y el presupuesto que tienes en mente.' },
                { titulo: 'Elige colores', texto: 'Te proponemos combinaciones de flores y tonos que funcionan bien juntos.' },
                { titulo: 'Confirma', texto: 'Acordamos el diseño, la fecha y la hora de entrega.' },
                { titulo: 'Recíbelo', texto: 'Lo entregamos en Quito con una tarjeta con tu mensaje.' },
              ]}
            />
          </div>
          <div className="mt-10 text-center">
            <Button asChild tamano="lg">
              <a href={hrefWhatsApp('Hola Floravia, quisiera armar un arreglo personalizado.')} target="_blank" rel="noopener noreferrer">
                <Wand2 className="size-5" aria-hidden="true" />
                Pedir un arreglo personalizado
              </a>
            </Button>
          </div>
        </Container>
      </section>

      <section aria-label="Entrega" className="bg-moss-50 py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Entrega" titulo="Llega cuando importa" descripcion="Coordinamos día, horario y dirección. Para pedidos del mismo día, consúltanos antes de confirmar." />
          <div className="mt-10">
            <ValueProps
              items={[
                { titulo: 'Domicilio en Quito', texto: 'Coordinamos cobertura y costo según tu dirección.', icono: Truck },
                { titulo: 'Fecha y hora', texto: 'Programa la entrega para el momento exacto de la celebración.', icono: Cake },
                { titulo: 'Mensaje personal', texto: 'Incluimos una nota escrita con tus palabras.', icono: Gift },
                { titulo: 'Colores a elección', texto: 'Ajustamos la paleta a la ocasión y al gusto de quien recibe.', icono: Palette },
              ]}
            />
          </div>
        </Container>
      </section>

      {destacados.length > 0 && (
        <section aria-label="Destacados" className="py-16 sm:py-20">
          <Container>
            <SectionHeading etiqueta="Selección" titulo="Ramos destacados" />
            <div className="mt-8"><CarruselProductos productos={destacados} etiqueta="Ramos destacados" /></div>
          </Container>
        </section>
      )}

      <section aria-label="Preguntas frecuentes" className="pb-16 sm:pb-20">
        <Container>
          <SectionHeading etiqueta="Preguntas frecuentes" titulo="Antes de pedir" alinear="centro" />
          <div className="mt-8">
            <Faq
              items={[
                { pregunta: '¿A qué zonas de Quito entregan?', respuesta: 'Coordinamos entregas dentro de Quito. Escríbenos para confirmar cobertura y costo según tu dirección.' },
                { pregunta: '¿Cuánto demora una entrega?', respuesta: 'Depende de la disponibilidad y del horario elegido. Para pedidos del mismo día, consúltanos antes de confirmar.' },
                { pregunta: '¿Puedo incluir un mensaje?', respuesta: 'Sí. Puedes escribir una nota personalizada que acompañará tu arreglo.' },
                { pregunta: '¿Pueden preparar pedidos para eventos?', respuesta: 'Sí. Conversamos cantidades, colores, estilo y presupuesto para celebraciones y eventos.' },
                { pregunta: '¿Cuánto duran las flores?', respuesta: 'Depende de la especie y del cuidado. En cada ramo indicamos una duración orientativa; en nuestra guía encontrarás cómo alargarla.' },
              ]}
            />
          </div>
        </Container>
      </section>

      <GuiasTeaser linea="ramos" />
      <CtaBanda titulo="¿Tienes una fecha importante?" texto="Reserva con anticipación y asegura el diseño que imaginas." mensaje="Hola Floravia, quisiera reservar un arreglo para una fecha especial." />
    </>
  );
}
