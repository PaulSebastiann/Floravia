'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle2, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { agregarAccion } from '@/app/acciones/carrito';
import { Button } from '@/components/ui/button';
import { MAX_POR_PRODUCTO } from '@/domain/carrito';
import { formatearUSD, centavos } from '@/domain/dinero';
import type { Producto } from '@/domain/producto';
import { Miniatura } from '@/features/tienda/lista-carrito';
import { useTienda } from '@/features/tienda/tienda-provider';

/**
 * Selector de cantidad + "Agregar al carrito". El carrito vive en el servidor (API .NET):
 * esta pantalla solo envia {idProducto, cantidad}; el precio lo decide siempre el backend.
 */
export function OpcionesProducto({ producto }: { producto: Producto }) {
  const id = useId();
  const { aplicarCarrito, carrito } = useTienda();
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [agregado, setAgregado] = useState<{ cantidad: number } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const idProducto = producto.idProducto;
  const stock = producto.stockDisponible;
  const enCarrito = carrito.lineas.find((l) => l.idProducto === idProducto)?.cantidad ?? 0;
  const tope = Math.max(1, Math.min(MAX_POR_PRODUCTO, stock ?? MAX_POR_PRODUCTO));
  const total = centavos(producto.precio * cantidad);
  // Sin idProducto no hay que enviar a la tienda (no deberia ocurrir: API y catalogo de muestra lo traen).
  const puedeComprar = producto.disponible && idProducto !== undefined;

  const agregar = () => {
    if (idProducto === undefined) return;
    setError(null);
    iniciar(async () => {
      const r = await agregarAccion(idProducto, cantidad);
      if (r.ok) {
        aplicarCarrito(r.carrito);
        setAgregado({ cantidad });
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p id={`${id}-cant`} className="mb-2 text-sm font-semibold text-moss-900">Cantidad</p>
        <div role="group" aria-labelledby={`${id}-cant`} className="inline-flex items-center rounded-full border border-line bg-white">
          <Button variante="fantasma" tamano="icono" aria-label="Disminuir cantidad" disabled={cantidad <= 1} onClick={() => setCantidad((c) => Math.max(1, c - 1))}><Minus className="size-4" aria-hidden="true" /></Button>
          <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{cantidad}</span>
          <Button variante="fantasma" tamano="icono" aria-label="Aumentar cantidad" disabled={cantidad >= tope} onClick={() => setCantidad((c) => Math.min(tope, c + 1))}><Plus className="size-4" aria-hidden="true" /></Button>
        </div>
        {stock !== undefined && stock > 0 && stock <= 5 && <p className="mt-2 text-sm text-petal-700">Quedan solo {stock} unidades.</p>}
        {enCarrito > 0 && <p className="mt-2 text-sm text-muted">Ya tienes {enCarrito} en tu carrito.</p>}
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm text-muted">Total estimado</p>
        <p className="text-3xl font-semibold text-moss-900">{formatearUSD(total)}</p>
        <p className="mt-1 text-xs text-muted">El envío y el IVA se calculan en el pago, según tu dirección en Quito.</p>

        {puedeComprar ? (
          <Button tamano="lg" className="mt-4 w-full sm:w-auto" onClick={agregar} cargando={pendiente}>
            <ShoppingBag className="size-5" aria-hidden="true" />Agregar al carrito
          </Button>
        ) : !producto.disponible ? (
          <Button tamano="lg" disabled className="mt-4 w-full sm:w-auto">Agotado por ahora</Button>
        ) : (
          <Button tamano="lg" disabled className="mt-4 w-full sm:w-auto">No disponible</Button>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-petal-100 px-4 py-3 text-sm text-petal-700">{error}</p>}
      </div>

      <Dialog.Root open={agregado !== null} onOpenChange={(o) => { if (!o) setAgregado(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-moss-900/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] bg-cream-50 p-6 shadow-lift data-[state=open]:animate-fade-in">
            <Dialog.Close className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full text-moss-800 hover:bg-moss-100" aria-label="Cerrar">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
            <div className="flex items-center gap-2 text-moss-700">
              <CheckCircle2 className="size-6" aria-hidden="true" />
              <Dialog.Title className="font-display text-2xl font-semibold text-moss-900">Agregado al carrito</Dialog.Title>
            </div>
            <Dialog.Description className="sr-only">Elige si quieres ir al carrito o seguir comprando.</Dialog.Description>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-line bg-white p-3">
              <Miniatura linea={{ imagen: producto.imagenes[0]?.url, nombre: producto.nombre }} className="size-16" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-moss-900">{producto.nombre}</p>
                <p className="text-sm text-muted">{agregado?.cantidad} × {formatearUSD(producto.precio)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              Tu carrito tiene {carrito.cantidadTotal} {carrito.cantidadTotal === 1 ? 'producto' : 'productos'} · Subtotal {formatearUSD(carrito.subtotal)}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
              <Button asChild tamano="lg" className="flex-1"><Link href="/carrito">Ir al carrito</Link></Button>
              <Dialog.Close asChild><Button variante="contorno" tamano="lg" className="flex-1">Seguir comprando</Button></Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
