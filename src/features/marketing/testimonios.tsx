import { Quote } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { testimoniosVisibles } from '@/content/testimonios';

export function Testimonios() {
  const items = testimoniosVisibles();
  if (items.length === 0) return null;
  return (
    <section aria-label="Testimonios" className="bg-cream-100 py-16 sm:py-20">
      <Container>
        <SectionHeading nivel="h2" etiqueta="Opiniones" titulo="Lo que dicen quienes ya nos eligieron" alinear="centro" />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <li key={t.nombre} className="relative rounded-card bg-white p-6 shadow-soft">
              {t.esEjemplo && (
                <span className="absolute right-4 top-4 rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-semibold text-sun-800">Ejemplo, no real</span>
              )}
              <Quote className="size-8 text-petal-400" aria-hidden="true" />
              <blockquote className="mt-3 text-lg text-ink">{t.texto}</blockquote>
              <p className="mt-5 font-semibold text-moss-900">{t.nombre}</p>
              <p className="text-sm text-muted">{t.contexto}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
