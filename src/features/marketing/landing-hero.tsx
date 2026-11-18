import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/cn';
import { ArteCompuesto } from './arte-compuesto';

type Tono = 'home' | 'ramos' | 'plantas' | 'semillas';
interface Cta { texto: string; href: string; externo?: boolean }

const FONDO: Record<Tono, string> = {
  home: 'bg-gradient-to-b from-moss-50 to-cream-50',
  ramos: 'bg-gradient-to-b from-petal-100 to-cream-50',
  plantas: 'bg-gradient-to-b from-moss-100 to-cream-50',
  semillas: 'bg-gradient-to-b from-sun-100 to-cream-50',
};

interface Props {
  tono: Tono;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  ctaPrimario: Cta;
  ctaSecundario?: Cta;
  puntos?: readonly string[];
  /** Contenido extra bajo los CTA (p. ej. las tres lineas en el Home). */
  extra?: ReactNode;
}

function BotonCta({ cta, variante }: { cta: Cta; variante: 'primario' | 'contorno' }) {
  return (
    <Button asChild tamano="lg" variante={variante}>
      {cta.externo ? (
        <a href={cta.href} target="_blank" rel="noopener noreferrer">{cta.texto}</a>
      ) : (
        <Link href={cta.href}>
          {cta.texto}
          {variante === 'primario' && <ArrowRight className="size-5" aria-hidden="true" />}
        </Link>
      )}
    </Button>
  );
}

export function LandingHero({ tono, etiqueta, titulo, descripcion, ctaPrimario, ctaSecundario, puntos, extra }: Props) {
  return (
    <section className={cn('relative overflow-hidden', FONDO[tono])} aria-labelledby="titulo-hero">
      <Container className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="animate-fade-up">
          <p className="mb-4 inline-flex rounded-full bg-white/80 px-4 py-1.5 text-sm font-semibold text-moss-800 shadow-soft">{etiqueta}</p>
          <h1 id="titulo-hero" className="font-display text-4xl font-semibold text-moss-900 sm:text-5xl lg:text-6xl">{titulo}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">{descripcion}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BotonCta cta={ctaPrimario} variante="primario" />
            {ctaSecundario && <BotonCta cta={ctaSecundario} variante="contorno" />}
          </div>
          {puntos && (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-moss-800">
              {puntos.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-moss-600" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          )}
          {extra}
        </div>
        <ArteCompuesto tono={tono} className="animate-fade-in" />
      </Container>
    </section>
  );
}
