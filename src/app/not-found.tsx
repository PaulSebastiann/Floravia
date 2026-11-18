import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <Container className="py-28 text-center">
      <p className="font-semibold uppercase tracking-[0.14em] text-moss-700">Error 404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-moss-900 sm:text-5xl">Esta página no está en nuestro jardín</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-muted">Puede que el enlace haya cambiado o que el producto ya no esté disponible.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild><Link href="/">Ir al inicio</Link></Button>
        <Button asChild variante="contorno"><Link href="/catalogo">Ver catálogo</Link></Button>
      </div>
    </Container>
  );
}
