'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { formatearUSD } from '@/domain/dinero';
import { ListaCarrito } from '@/features/tienda/lista-carrito';
import { useTienda } from '@/features/tienda/tienda-provider';

/** Carrito lateral: lectura y edicion rapida. El pago se hace en /carrito -> /checkout. */
export function CartDrawer() {
  const { carrito, cargando } = useTienda();
  const cantidad = carrito.cantidadTotal;
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Abrir carrito, ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-moss-900 hover:bg-moss-100"
      >
        <ShoppingBag className="size-6" aria-hidden="true" />
        {cantidad > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-petal-700 px-1 text-xs font-bold text-white">
            {cantidad}
          </span>
        )}
      </SheetTrigger>
      <SheetContent titulo="Tu carrito" descripcion="Productos agregados a tu pedido" className="w-[min(26rem,94vw)]">
        {cantidad === 0 ? (
          <div className="p-5">
            <EmptyState
              icono={<ShoppingBag className="size-10" />}
              titulo={cargando ? 'Cargando tu carrito…' : 'Tu carrito está vacío'}
              descripcion="Agrega flores, plantas o semillas y aparecerán aquí."
              accion={<SheetClose asChild><Button asChild><Link href="/catalogo">Explorar catálogo</Link></Button></SheetClose>}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto px-5"><ListaCarrito compacta /></div>
            <div className="border-t border-line bg-white p-5">
              <p className="flex justify-between font-semibold text-moss-900">
                <span>Subtotal</span><span className="tabular-nums">{formatearUSD(carrito.subtotal)}</span>
              </p>
              <p className="mt-1 text-xs text-muted">IVA y envío se calculan en el pago.</p>
              <div className="mt-4 grid gap-2">
                <SheetClose asChild><Button asChild tamano="lg"><Link href="/checkout">Proceder al pago</Link></Button></SheetClose>
                <SheetClose asChild><Button asChild variante="contorno"><Link href="/carrito">Ver carrito</Link></Button></SheetClose>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
