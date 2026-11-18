'use client';

import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-28 text-center">
      <h1 className="font-display text-4xl font-semibold text-moss-900">Algo salió mal</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-muted">No pudimos cargar esta página. Inténtalo de nuevo en un momento.</p>
      <Button className="mt-8" onClick={reset}>Reintentar</Button>
    </Container>
  );
}
