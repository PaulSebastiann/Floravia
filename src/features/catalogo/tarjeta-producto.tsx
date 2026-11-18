import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatearUSD } from '@/domain/dinero';
import type { Producto } from '@/domain/producto';
import { cn } from '@/lib/cn';
import { atributosClave, NOMBRE_LINEA } from './etiquetas';
import { ProductoVisual } from './producto-visual';

export function TarjetaProducto({ producto, className, prioridad = false }: { producto: Producto; className?: string; prioridad?: boolean }) {
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-white transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift focus-within:shadow-lift',
        !producto.disponible && 'opacity-80',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none">
          <ProductoVisual producto={producto} />
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pr-3">
          <Badge tono={producto.linea}>{NOMBRE_LINEA[producto.linea]}</Badge>
          {producto.masVendido && producto.disponible && <Badge tono="oscuro">Más vendido</Badge>}
          {!producto.disponible && <Badge tono="agotado">Agotado</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg font-semibold text-moss-900">
          {/* Enlace extendido: toda la tarjeta es clicable con un solo foco de teclado. */}
          <Link href={`/producto/${producto.slug}`} className="after:absolute after:inset-0 focus-visible:outline-offset-[-3px]" data-prioridad={prioridad || undefined}>
            {producto.nombre}
          </Link>
        </h3>
        <p className="text-sm text-muted">{producto.resumen}</p>
        <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-muted">
          {atributosClave(producto).map((a) => (
            <li key={a} className="before:mr-1.5 before:content-['•'] first:before:content-none">{a}</li>
          ))}
        </ul>
        <p className="pt-1 text-lg font-semibold text-moss-800">{formatearUSD(producto.precio)}</p>
      </div>
    </article>
  );
}
