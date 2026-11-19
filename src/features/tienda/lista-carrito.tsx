'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Flower2, Minus, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { quitarAccion, cantidadAccion, type ResultadoCarrito } from '@/app/acciones/carrito';
import { Button } from '@/components/ui/button';
import { maximoPermitido, type LineaCarrito } from '@/domain/carrito';
import { formatearUSD } from '@/domain/dinero';
import { cn } from '@/lib/cn';
import { useTienda } from './tienda-provider';

export function Miniatura({ linea, className }: { linea: Pick<LineaCarrito, 'imagen' | 'nombre'>; className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream-100 text-moss-300', className)}>
      {linea.imagen
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={linea.imagen} alt="" loading="lazy" className="size-full object-cover" />
        : <Flower2 className="size-1/2" aria-hidden="true" />}
    </div>
  );
}

/** Lista editable del carrito. Cada cambio se confirma con el servidor (precios, stock) antes de reflejarse. */
export function ListaCarrito({ compacta = false }: { compacta?: boolean }) {
  const { carrito, aplicarCarrito } = useTienda();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState<LineaCarrito | null>(null);

  const ejecutar = (accion: () => Promise<ResultadoCarrito>) => {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r.ok) aplicarCarrito(r.carrito);
      else setError(r.error);
    });
  };

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-xl bg-petal-100 px-4 py-3 text-sm text-petal-700">{error}</p>}
      <ul className={cn('divide-y divide-line', pendiente && 'opacity-60 transition-opacity')} aria-busy={pendiente}>
        {carrito.lineas.map((l) => {
          const max = maximoPermitido(l);
          return (
            <li key={l.idProducto} className={cn('flex gap-4', compacta ? 'py-4' : 'py-6')}>
              <Miniatura linea={l} className={compacta ? 'size-16' : 'size-20 sm:size-28'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold leading-snug text-moss-900">{l.nombre}</p>
                  <p className="shrink-0 font-semibold tabular-nums text-moss-900">{formatearUSD(l.subtotal)}</p>
                </div>
                <p className="text-sm text-muted">{formatearUSD(l.precioUnitario)} c/u</p>
                {l.stockDisponible > 0 && l.cantidad > l.stockDisponible && (
                  <p className="mt-1 text-sm text-petal-700">Solo quedan {l.stockDisponible}. Ajusta la cantidad.</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div role="group" aria-label={`Cantidad de ${l.nombre}`} className="inline-flex items-center rounded-full border border-line bg-white">
                    <Button variante="fantasma" tamano="icono" className="size-9" disabled={pendiente} aria-label={`Disminuir cantidad de ${l.nombre}`}
                      onClick={() => {
                        if (l.cantidad === 1) setConfirmarQuitar(l);
                        else ejecutar(() => cantidadAccion(l.idProducto, l.cantidad - 1));
                      }}>
                      <Minus className="size-4" aria-hidden="true" />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{l.cantidad}</span>
                    <Button variante="fantasma" tamano="icono" className="size-9" disabled={pendiente || l.cantidad >= max}
                      aria-label={`Aumentar cantidad de ${l.nombre}`}
                      onClick={() => ejecutar(() => cantidadAccion(l.idProducto, l.cantidad + 1))}>
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <Button variante="fantasma" tamano="sm" disabled={pendiente} aria-label={`Quitar ${l.nombre} del carrito`}
                    onClick={() => setConfirmarQuitar(l)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Quitar
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog.Root open={confirmarQuitar !== null} onOpenChange={(abierto) => { if (!abierto) setConfirmarQuitar(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-moss-900/50 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] bg-cream-50 p-6 shadow-lift">
            <Dialog.Close className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full text-moss-800 hover:bg-moss-100" aria-label="Cerrar">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
            <Dialog.Title className="pr-10 font-display text-2xl font-semibold text-moss-900">¿Quitar del carrito?</Dialog.Title>
            <Dialog.Description className="mt-2 text-muted">
              {confirmarQuitar?.nombre} dejará de estar en tu carrito.
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button variante="contorno">Cancelar</Button>
              </Dialog.Close>
              <Button
                variante="primario"
                disabled={pendiente}
                onClick={() => {
                  if (!confirmarQuitar) return;
                  const idProducto = confirmarQuitar.idProducto;
                  setConfirmarQuitar(null);
                  ejecutar(() => quitarAccion(idProducto));
                }}>
                Sí, quitar
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export function EnlaceSeguirComprando({ className }: { className?: string }) {
  return <Link href="/catalogo" className={cn('text-sm font-medium text-moss-700 underline-offset-4 hover:underline', className)}>Seguir comprando</Link>;
}
