'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';

/**
 * PENDIENTE (fase carrito): hoy solo muestra el estado vacio.
 * El carrito real vive en el servidor (X-Carrito-Token); aqui se conectara via BFF.
 */
export function CartDrawer({ cantidad = 0 }: { cantidad?: number }) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Abrir carrito, ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-moss-900 hover:bg-moss-100"
      >
        <ShoppingBag className="size-6" aria-hidden="true" />
        {cantidad > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-petal-700 text-xs font-bold text-white">
            {cantidad}
          </span>
        )}
      </SheetTrigger>
      <SheetContent titulo="Tu carrito" descripcion="Productos agregados a tu pedido">
        <div className="p-5">
          <EmptyState
            icono={<ShoppingBag className="size-10" />}
            titulo="Tu carrito está vacío"
            descripcion="Agrega flores, plantas o semillas y aparecerán aquí."
            accion={
              <SheetClose asChild>
                <Button asChild>
                  <Link href="/catalogo">Explorar catálogo</Link>
                </Button>
              </SheetClose>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
