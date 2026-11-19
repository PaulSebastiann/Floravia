import type { Metadata } from 'next';
import { Carrot, Flower, Leaf, Sprout, Utensils, Droplets, Sun, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { hrefCatalogo } from '@/domain/filtros';
import { CarruselProductos } from '@/features/catalogo/grilla-productos';
import { GuiasTeaser } from '@/features/guias/guias-teaser';
import { CalendarioSiembra } from '@/features/marketing/calendario-siembra';
import { CtaBanda } from '@/features/marketing/cta-banda';
import { Faq } from '@/features/marketing/faq';
import { LandingHero } from '@/features/marketing/landing-hero';
import { Pasos } from '@/features/marketing/pasos';
import { TarjetasEnlace } from '@/features/marketing/tarjetas-enlace';
import { capacidades, esperarSolicitud, obtenerRepositorio } from '@/infrastructure/repositorio';

export const metadata: Metadata = {
  title: 'Semillas de flores, huerto y aromáticas',
  description: 'Semillas para empezar tu jardín o huerto en casa. Encuentra por tipo de cultivo, época de siembra y tiempo de germinación.',
};

const f = (clave: string, valor: string) => hrefCatalogo({ linea: 'semillas', filtros: { [clave]: [valor] } });

export default async function SemillasPage() {
  await esperarSolicitud();
  const repo = obtenerRepositorio();
  const cap = capacidades();
  const [masVendidos, porMes] = await Promise.all([repo.masVendidos('semillas', 4), repo.semillasPorMes()]);
  // Solo datos serializables minimos hacia el componente cliente.
  const calendario = Object.fromEntries(
    Object.entries(porMes).map(([mes, ps]) => [mes, ps.map((p) => ({ slug: p.slug, nombre: p.nombre }))]),
  );

  return (
    <>
      <LandingHero
        tono="semillas"
        etiqueta="Semillas"
        titulo="Empieza tu jardín desde cero"
        descripcion="Flores, hortalizas y hierbas aromáticas. Elige según lo que quieras cosechar y la época en que vas a sembrar."
        ctaPrimario={{ texto: 'Ver semillas', href: hrefCatalogo({ linea: 'semillas' }) }}
        ctaSecundario={{ texto: 'Guía de germinación', href: '/guias/como-germinar-semillas' }}
        puntos={['Flores y huerto', 'Aromáticas para la cocina', 'Guía de siembra incluida']}
      />

      {cap.atributos && (
      <section aria-label="Tipo de cultivo" className="py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Por cultivo" titulo="¿Qué quieres sembrar?" descripcion="Tres caminos para empezar, con o sin experiencia." />
          <div className="mt-10">
            <TarjetasEnlace
              items={[
                { titulo: 'Flores', descripcion: 'Color para el jardín, el balcón o los polinizadores.', href: f('cultivo', 'flores'), icono: Flower, tono: 'ramos' },
                { titulo: 'Huerto en casa', descripcion: 'Hortalizas para cosechar de tu propia maceta.', href: f('cultivo', 'huerto'), icono: Carrot, tono: 'plantas' },
                { titulo: 'Aromáticas', descripcion: 'Albahaca, cilantro, menta y más para tu cocina.', href: f('cultivo', 'aromaticas'), icono: Leaf, tono: 'semillas' },
              ]}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variante="secundario" tamano="sm"><Link href={f('uso', 'comestible')}><Utensils className="size-4" aria-hidden="true" />Comestibles</Link></Button>
            <Button asChild variante="secundario" tamano="sm"><Link href={f('uso', 'ornamental')}><Flower className="size-4" aria-hidden="true" />Ornamentales</Link></Button>
          </div>
        </Container>
      </section>
      )}

      {cap.atributos && (
      <section aria-label="Calendario de siembra" className="bg-sun-100/60 py-16 sm:py-20">
        <Container>
          <SectionHeading
            etiqueta="Época de siembra"
            titulo="¿Qué sembrar este mes?"
            descripcion="Quito no tiene cuatro estaciones, así que organizamos por mes. Son fechas orientativas: la altitud y el microclima de tu zona importan."
          />
          <div className="mt-8"><CalendarioSiembra porMes={calendario} /></div>
        </Container>
      </section>
      )}

      <section aria-label={cap.masVendidos ? 'Más vendidas' : 'Novedades'} className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            etiqueta={cap.masVendidos ? 'Más vendidas' : 'Novedades'}
            titulo="Las que más se siembran"
            accion={<Button asChild variante="contorno" tamano="sm"><Link href={hrefCatalogo({ linea: 'semillas' })}>Ver todas</Link></Button>}
          />
          <div className="mt-8"><CarruselProductos productos={masVendidos} etiqueta="Semillas más vendidas" /></div>
        </Container>
      </section>

      <section aria-label="Guía de germinación" className="bg-cream-100 py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Guía de germinación" titulo="De semilla a plántula en cuatro pasos" alinear="centro" />
          <div className="mt-10">
            <Pasos
              pasos={[
                { titulo: 'Prepara el sustrato', texto: 'Ligero, bien drenado y húmedo como una esponja escurrida.' },
                { titulo: 'Siembra', texto: 'A una profundidad de unas dos veces el tamaño de la semilla, salvo que el sobre indique otra cosa.' },
                { titulo: 'Mantén la humedad', texto: 'Riega suave. Ni seco ni encharcado: ambos impiden germinar.' },
                { titulo: 'Dale luz', texto: 'Cuando asomen, más luz para que las plántulas no se estiren.' },
              ]}
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted">
            <span className="flex items-center gap-2"><Droplets className="size-5 text-moss-600" aria-hidden="true" />El tiempo de germinación está en cada ficha</span>
            <span className="flex items-center gap-2"><Sun className="size-5 text-sun-500" aria-hidden="true" />Referencia, no garantía</span>
            <span className="flex items-center gap-2"><CalendarDays className="size-5 text-moss-600" aria-hidden="true" />Siembra según el mes</span>
          </div>
          <div className="mt-8 text-center">
            <Button asChild><Link href="/guias/como-germinar-semillas"><Sprout className="size-5" aria-hidden="true" />Leer la guía completa</Link></Button>
          </div>
        </Container>
      </section>

      <section aria-label="Preguntas frecuentes" className="py-16 sm:py-20">
        <Container>
          <SectionHeading etiqueta="Preguntas frecuentes" titulo="Antes de sembrar" alinear="centro" />
          <div className="mt-8">
            <Faq
              items={[
                { pregunta: '¿Cuánto tardan en germinar?', respuesta: 'Depende de la especie, desde pocos días hasta un par de semanas. En cada ficha indicamos un rango estimado.' },
                { pregunta: '¿Necesito experiencia?', respuesta: 'No. Empieza con aromáticas o girasoles, que son agradecidos. Incluimos indicaciones de siembra.' },
                { pregunta: '¿Puedo sembrar en maceta?', respuesta: 'Sí, la mayoría se adapta. Usa una maceta con drenaje y sustrato suelto. Algunas, como la menta, conviene tenerlas en maceta propia.' },
                { pregunta: '¿Cuándo es la mejor época?', respuesta: 'Usa el calendario de esta página como orientación y ajusta según tu zona.' },
              ]}
            />
          </div>
        </Container>
      </section>

      <GuiasTeaser linea="semillas" />
      <CtaBanda titulo="¿Primera vez sembrando?" texto="Te ayudamos a elegir qué sembrar según tu espacio y tu tiempo." mensaje="Hola Floravia, quisiera empezar un huerto o jardín desde semillas." />
    </>
  );
}
