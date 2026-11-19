import type { Metadata } from 'next';
import { Droplets, Home, MessageCircle, PawPrint, Ruler, Sprout, Sun, SunDim, Moon, Trees, Flame } from 'lucide-react';
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
import { TarjetasEnlace } from '@/features/marketing/tarjetas-enlace';
import { ValueProps } from '@/features/marketing/value-props';
import { capacidades, esperarSolicitud, obtenerRepositorio } from '@/infrastructure/repositorio';

export const metadata: Metadata = {
  title: 'Plantas de interior, exterior y suculentas en Quito',
  description: 'Plantas para cada espacio y nivel de experiencia. Filtra por cuidado, luz y mascotas, y recibe recomendaciones de maceta y riego.',
};

const f = (clave: string, valor: string) => hrefCatalogo({ linea: 'plantas', filtros: { [clave]: [valor] } });

const TAMANOS = [
  { titulo: 'Chica · hasta 20 cm', texto: 'Escritorios, repisas y ventanas. Ideal para suculentas y para empezar.' },
  { titulo: 'Mediana · 20–50 cm', texto: 'Mesas auxiliares, estantes y rincones. La talla más versátil.' },
  { titulo: 'Grande · más de 50 cm', texto: 'Piso o esquinas amplias. Piden maceta espaciosa y buena luz.' },
] as const;

export default async function PlantasPage() {
  await esperarSolicitud();
  const repo = obtenerRepositorio();
  const cap = capacidades();
  const [masVendidos, petFriendly] = await Promise.all([
    repo.masVendidos('plantas', 4),
    repo.listar({ linea: 'plantas', filtros: { pet: ['si'] }, orden: 'relevancia', pagina: 1 }),
  ]);

  return (
    <>
      <LandingHero
        tono="plantas"
        etiqueta="Plantas"
        titulo="La planta justa para tu espacio"
        descripcion="Cuéntanos cuánta luz tienes y cuánto tiempo puedes dedicarle: te ayudamos a elegir una planta que prospere en tu casa."
        ctaPrimario={{ texto: 'Explorar plantas', href: hrefCatalogo({ linea: 'plantas' }) }}
        ctaSecundario={{ texto: 'Guía de cuidados', href: '/guias/cuidado-de-suculentas' }}
        puntos={['De interior y exterior', 'Opciones pet-friendly', 'Maceta recomendada']}
      />

      {cap.atributos && (
      <section aria-label="Nivel de cuidado" className="py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Por experiencia" titulo="¿Qué tanto tiempo puedes dedicarle?" descripcion="Empieza por el nivel de cuidado: es la mejor garantía de que tu planta se quede contigo." />
          <div className="mt-10">
            <TarjetasEnlace
              items={[
                { titulo: 'Fáciles', descripcion: 'Perdonan descuidos. Perfectas para empezar o para quien viaja.', href: f('cuidado', 'facil'), icono: Sprout, tono: 'plantas' },
                { titulo: 'Nivel medio', descripcion: 'Piden algo de atención: riego regular y buena ubicación.', href: f('cuidado', 'medio'), icono: Droplets, tono: 'plantas' },
                { titulo: 'Para expertos', descripcion: 'Exigentes con humedad, poda o luz. Un proyecto a largo plazo.', href: f('cuidado', 'experto'), icono: Trees, tono: 'plantas' },
              ]}
            />
          </div>
        </Container>
      </section>
      )}

      {cap.atributos && (
      <section aria-label="Necesidad de luz" className="bg-moss-50 py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Por luz" titulo="Mira tu ventana antes de elegir" descripcion="La luz disponible decide más que cualquier otro factor. Elige según lo que realmente recibe tu espacio." />
          <div className="mt-10">
            <TarjetasEnlace
              items={[
                { titulo: 'Sombra', descripcion: 'Rincones y habitaciones con poca luz natural.', href: f('luz', 'sombra'), icono: Moon, tono: 'plantas' },
                { titulo: 'Luz indirecta', descripcion: 'Cerca de ventanas, sin sol directo sobre las hojas.', href: f('luz', 'luz-indirecta'), icono: SunDim, tono: 'plantas' },
                { titulo: 'Sol directo', descripcion: 'Balcones, terrazas y ventanas muy soleadas.', href: f('luz', 'sol-directo'), icono: Sun, tono: 'semillas' },
              ]}
            />
          </div>
          <p className="mt-6 text-sm text-muted">Interior o exterior es otro criterio: puedes combinarlo en el <Link href={hrefCatalogo({ linea: 'plantas' })} className="font-semibold text-moss-700 underline underline-offset-4">catálogo</Link>.</p>
        </Container>
      </section>
      )}

      <section aria-label={cap.masVendidos ? 'Más vendidas' : 'Novedades'} className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            etiqueta={cap.masVendidos ? 'Más vendidas' : 'Novedades'}
            titulo="Las que más se llevan"
            accion={<Button asChild variante="contorno" tamano="sm"><Link href={hrefCatalogo({ linea: 'plantas' })}>Ver todas</Link></Button>}
          />
          <div className="mt-8"><CarruselProductos productos={masVendidos} etiqueta="Plantas más vendidas" /></div>
        </Container>
      </section>

      <section aria-label="Tamaño y macetas" className="bg-cream-100 py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Tamaño y maceta" titulo="Elige el tamaño según el lugar" descripcion="Cada ficha indica la altura aproximada y la maceta recomendada. Siempre con agujero de drenaje." />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {TAMANOS.map((t) => (
              <li key={t.titulo} className="rounded-card bg-white p-6 shadow-soft">
                <Ruler className="size-7 text-moss-600" aria-hidden="true" />
                <h3 className="mt-3 font-display text-xl font-semibold text-moss-900">{t.titulo}</h3>
                <p className="mt-2 text-muted">{t.texto}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {cap.atributos && (
      <section aria-label="Pet-friendly" className="py-16 sm:py-20">
        <Container>
          <div className="grid items-center gap-8 rounded-[2rem] bg-sun-100 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <PawPrint className="size-9 text-sun-800" aria-hidden="true" />
              <h2 className="mt-3 font-display text-3xl font-semibold text-moss-900 sm:text-4xl">Plantas pet-friendly</h2>
              <p className="mt-3 max-w-xl text-lg text-ink">Si conviven mascotas en casa, filtra las plantas catalogadas como seguras. Ante la duda con una especie, consúltanos antes de comprar.</p>
              <Button asChild className="mt-6"><Link href={f('pet', 'si')}>Ver {petFriendly.total} plantas pet-friendly</Link></Button>
            </div>
            <ValueProps items={[{ titulo: 'Filtro dedicado', texto: 'Un clic para ver solo opciones aptas para mascotas.', icono: PawPrint }]} />
          </div>
        </Container>
      </section>
      )}

      <section aria-label="Cuidados" className="pb-16 sm:pb-20">
        <Container>
          <SectionHeading etiqueta="Después de la compra" titulo="No te dejamos solo con tu planta" alinear="centro" />
          <div className="mt-10">
            <ValueProps
              items={[
                { titulo: 'Ficha de cuidados', texto: 'Luz, riego y ubicación en cada producto.', icono: Droplets },
                { titulo: 'Asesoría', texto: 'Escríbenos si tu planta cambia de aspecto.', icono: MessageCircle },
                { titulo: 'Para cada espacio', texto: 'Interior, exterior o ambos.', icono: Home },
                { titulo: 'Sol o sombra', texto: 'Recomendaciones según tu luz real.', icono: Flame },
              ]}
            />
          </div>
        </Container>
      </section>

      <section aria-label="Preguntas frecuentes" className="pb-16 sm:pb-20">
        <Container>
          <SectionHeading etiqueta="Preguntas frecuentes" titulo="Cuidar tu planta" alinear="centro" />
          <div className="mt-8">
            <Faq
              items={[
                { pregunta: '¿Cómo cuido mi planta?', respuesta: 'Te damos recomendaciones de luz, riego y ubicación según la especie que elijas. Cada ficha incluye una guía de cuidados.' },
                { pregunta: '¿Cada cuánto debo regarla?', respuesta: 'Depende de la especie, la maceta y la luz. En cada ficha indicamos una frecuencia orientativa; lo más seguro es revisar que el sustrato esté seco antes de regar.' },
                { pregunta: '¿Qué maceta necesita?', respuesta: 'Siempre una con agujero de drenaje. Cada producto indica el tipo de maceta recomendado.' },
                { pregunta: '¿Puedo pedir una planta que no veo en el catálogo?', respuesta: 'Escríbenos y consultamos disponibilidad.' },
              ]}
            />
          </div>
        </Container>
      </section>

      <GuiasTeaser linea="plantas" />
      <CtaBanda titulo="¿No sabes cuál elegir?" texto="Dinos cuánta luz tienes y si hay mascotas en casa, y te recomendamos." mensaje="Hola Floravia, necesito ayuda para elegir una planta para mi espacio." />
    </>
  );
}
