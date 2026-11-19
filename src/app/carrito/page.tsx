import type { Metadata } from 'next';
import { CarritoPagina } from '@/features/tienda/carrito-pagina';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = { title: 'Tu carrito', robots: { index: false } };

export default function CarritoPage() {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-4xl font-semibold text-moss-900">Tu carrito</h1>
      <CarritoPagina />
    </Container>
  );
}
