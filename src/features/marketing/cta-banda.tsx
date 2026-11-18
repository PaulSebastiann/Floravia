import { MessageCircle } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { hrefWhatsApp } from '@/content/sitio';

export function CtaBanda({ titulo, texto, mensaje, boton = 'Escríbenos por WhatsApp' }: { titulo: string; texto: string; mensaje: string; boton?: string }) {
  return (
    <section aria-labelledby="cta-banda">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-moss-800 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-moss-700/60" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 size-40 rounded-full bg-petal-700/30" aria-hidden="true" />
          <h2 id="cta-banda" className="relative font-display text-3xl font-semibold text-cream-50 sm:text-4xl">{titulo}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-moss-100">{texto}</p>
          <Button asChild tamano="lg" variante="claro" className="relative mt-8">
            <a href={hrefWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-5" aria-hidden="true" />
              {boton}
            </a>
          </Button>
        </div>
      </Container>
    </section>
  );
}
