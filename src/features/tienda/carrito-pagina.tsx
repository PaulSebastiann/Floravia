'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { EnlaceSeguirComprando, ListaCarrito } from './lista-carrito';
import { ResumenTotales } from './resumen-totales';
import { useTienda } from './tienda-provider';

export function CarritoPagina() {
  const { carrito, cargando, sesion } = useTienda();

  if (cargando) {
    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Cargando tu carrito">
        <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (carrito.lineas.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icono={<ShoppingBag className="size-10" />}
          titulo="Tu carrito está vacío"
          descripcion="Agrega flores, plantas o semillas y vuelve aquí para pagar."
          accion={<Button asChild><Link href="/catalogo">Explorar catálogo</Link></Button>}
        />
      </div>
    );
  }
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <section aria-label="Productos en tu carrito">
        <ListaCarrito />
        <div className="mt-4"><EnlaceSeguirComprando /></div>
      </section>
      <aside aria-labelledby="resumen" className="h-fit rounded-[1.5rem] border border-line bg-white p-6 shadow-soft lg:sticky lg:top-28">
        <h2 id="resumen" className="font-display text-2xl font-semibold text-moss-900">Resumen</h2>
        <ResumenTotales className="mt-4" subtotal={carrito.subtotal} iva={carrito.iva} porcentajeIva={carrito.porcentajeIva} total={carrito.totalSinEnvio} />
        <Button asChild tamano="lg" className="mt-6 w-full"><Link href="/checkout">Proceder al pago</Link></Button>
        {!sesion && <p className="mt-3 text-center text-sm text-muted">Para pagar necesitas una cuenta: te la pediremos en el siguiente paso. Tu carrito no se pierde.</p>}
      </aside>
    </div>
  );
}
