import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { listarGuias } from '@/features/guias/guias';
import { TarjetaGuia } from '@/features/guias/tarjeta-guia';

export const metadata: Metadata = {
  title: 'Guías de jardinería y cuidado',
  description: 'Consejos prácticos para cuidar tus plantas, germinar semillas y alargar la vida de tus flores.',
};

export default async function GuiasPage() {
  const guias = await listarGuias();
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold text-moss-900 sm:text-5xl">Guías de jardinería y cuidado</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Consejos breves y prácticos para que tus flores, plantas y semillas den lo mejor de sí.</p>
      <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {guias.map((g) => <li key={g.slug}><TarjetaGuia slug={g.slug} meta={g.meta} /></li>)}
      </ul>
    </Container>
  );
}
