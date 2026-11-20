import { ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { EmptyState } from '@/components/ui/empty-state';
import { Alerta } from '@/components/ui/campo';
import { mensajeUsuario } from '@/infrastructure/api/errores';
import { tienda } from '@/infrastructure/tienda';
import { CheckoutForm } from '@/features/tienda/checkout-form';
import { exigirSesion } from '@/features/tienda/cuenta-guard';

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  await exigirSesion('/checkout');

  let datos;
  try {
    const [carrito, dirs, zonas, metodos] = await Promise.all([tienda().verCarrito(), tienda().direcciones(), tienda().zonasDeEntrega(), tienda().metodosDePago()]);
    datos = { carrito, dirs, zonas, metodos };
  } catch (e) {
    console.error('[floravia] checkout: no se pudo cargar', e instanceof Error ? e.message : e);
    return (
      <Container className="py-12">
        <Alerta>{mensajeUsuario(e)} <Link href="/checkout" className="font-semibold underline">Reintentar</Link></Alerta>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-4xl font-semibold text-moss-900">Finalizar compra</h1>
      <div className="mt-8">
        {datos.carrito.lineas.length === 0 ? (
          <EmptyState
            icono={<ShoppingBag className="size-10" />}
            titulo="Tu carrito está vacío"
            descripcion="Agrega productos para continuar con el pago. Si ya hiciste un pedido, lo encuentras en Mis pedidos."
            accion={<Button asChild><Link href="/catalogo">Explorar catálogo</Link></Button>}
          />
        ) : (
          <CheckoutForm carrito={datos.carrito} direcciones={datos.dirs} zonas={datos.zonas} metodos={datos.metodos} />
        )}
      </div>
    </Container>
  );
}
