'use client';

import { Minus, MessageCircle, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { hrefWhatsApp } from '@/content/sitio';
import { formatearUSD } from '@/domain/dinero';
import type { Producto } from '@/domain/producto';
import { cn } from '@/lib/cn';

const MAX_CANTIDAD = 20;
const MAX_NOTA = 200;

/**
 * Selector de opciones. El carrito real (servidor) llega en la fase siguiente;
 * mientras tanto el pedido se cierra por WhatsApp con las opciones elegidas.
 */
export function OpcionesProducto({ producto }: { producto: Producto }) {
  const id = useId();
  const [tamano, setTamano] = useState(producto.linea === 'plantas' ? producto.tamanos[0]?.etiqueta ?? '' : '');
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');

  const lineas = [`Hola Floravia, quiero pedir: ${producto.nombre}`];
  if (tamano) lineas.push(`Tamaño: ${tamano}`);
  lineas.push(`Cantidad: ${cantidad}`);
  if (nota.trim()) lineas.push(`Nota para la tarjeta: ${nota.trim()}`);
  const href = hrefWhatsApp(lineas.join('\n'));
  const total = (producto.precio * cantidad) as typeof producto.precio;

  return (
    <div className="space-y-6">
      {producto.linea === 'plantas' && producto.tamanos.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-moss-900">Tamaño</legend>
          <div className="flex flex-wrap gap-2">
            {producto.tamanos.map((t) => (
              <label key={t.etiqueta} className={cn('cursor-pointer rounded-full border px-4 py-2 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-moss-600', tamano === t.etiqueta ? 'border-moss-700 bg-moss-700 text-cream-50' : 'border-line bg-white hover:bg-moss-50')}>
                <input type="radio" name={`${id}-tamano`} value={t.etiqueta} checked={tamano === t.etiqueta} onChange={() => setTamano(t.etiqueta)} className="sr-only" />
                {t.etiqueta} · {t.alturaCm} cm
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">Maceta recomendada: {producto.maceta}.</p>
        </fieldset>
      )}

      {producto.linea === 'ramos' && (
        <div>
          <label htmlFor={`${id}-nota`} className="mb-2 block text-sm font-semibold text-moss-900">Nota para la tarjeta (opcional)</label>
          <textarea
            id={`${id}-nota`}
            value={nota}
            maxLength={MAX_NOTA}
            rows={3}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Escribe el mensaje que acompañará tu regalo"
            className="w-full rounded-2xl border border-line bg-white p-3 text-base text-ink placeholder:text-muted/80"
          />
          <p className="mt-1 text-right text-xs text-muted" aria-live="polite">{nota.length}/{MAX_NOTA}</p>
        </div>
      )}

      <div>
        <p id={`${id}-cant`} className="mb-2 text-sm font-semibold text-moss-900">Cantidad</p>
        <div role="group" aria-labelledby={`${id}-cant`} className="inline-flex items-center rounded-full border border-line bg-white">
          <Button variante="fantasma" tamano="icono" aria-label="Disminuir cantidad" disabled={cantidad <= 1} onClick={() => setCantidad((c) => Math.max(1, c - 1))}><Minus className="size-4" aria-hidden="true" /></Button>
          <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{cantidad}</span>
          <Button variante="fantasma" tamano="icono" aria-label="Aumentar cantidad" disabled={cantidad >= MAX_CANTIDAD} onClick={() => setCantidad((c) => Math.min(MAX_CANTIDAD, c + 1))}><Plus className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm text-muted">Total estimado</p>
        <p className="text-3xl font-semibold text-moss-900">{formatearUSD(total)}</p>
        <p className="mt-1 text-xs text-muted">No incluye envío. El costo se confirma según tu dirección en Quito.</p>
        {producto.disponible ? (
          <Button asChild tamano="lg" className="mt-4 w-full sm:w-auto">
            <a href={href} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-5" aria-hidden="true" />Pedir por WhatsApp</a>
          </Button>
        ) : (
          <Button tamano="lg" disabled className="mt-4 w-full sm:w-auto">Agotado por ahora</Button>
        )}
      </div>
    </div>
  );
}
