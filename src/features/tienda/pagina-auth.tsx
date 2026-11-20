import { Flower2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui/container';

/** Marco comun de ingresar / crear cuenta. */
export function PaginaAuth({ titulo, subtitulo, aviso, children }: { titulo: string; subtitulo: string; aviso?: ReactNode; children: ReactNode }) {
  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-xl rounded-[1.75rem] border border-line bg-white p-6 shadow-soft sm:p-10">
        <Flower2 className="size-9 text-petal-700" aria-hidden="true" />
        <h1 className="mt-3 font-display text-4xl font-semibold text-moss-900">{titulo}</h1>
        <p className="mt-2 text-muted">{subtitulo}</p>
        {aviso && <div className="mt-5">{aviso}</div>}
        <div className="mt-7">{children}</div>
      </div>
    </Container>
  );
}
