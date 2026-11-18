import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import type { Linea } from '@/domain/producto';
import { listarGuias } from './guias';
import { TarjetaGuia } from './tarjeta-guia';

export async function GuiasTeaser({ linea, limite = 3 }: { linea?: Linea; limite?: number }) {
  const todas = await listarGuias();
  const guias = [...todas].sort((a, b) => Number(b.meta.linea === linea) - Number(a.meta.linea === linea)).slice(0, limite);
  return (
    <section aria-label="Consejos de jardinería y cuidado" className="py-16 sm:py-20">
      <Container>
        <SectionHeading
          etiqueta="Consejos"
          titulo="Aprende a cuidar lo que eliges"
          descripcion="Guías breves y prácticas de jardinería, plantas y flores."
          accion={<Link href="/guias" className="font-semibold text-moss-700 underline underline-offset-4">Ver todas las guías</Link>}
        />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {guias.map((g) => (
            <li key={g.slug}><TarjetaGuia slug={g.slug} meta={g.meta} /></li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
