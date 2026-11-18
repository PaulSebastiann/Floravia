import { Skeleton } from '@/components/ui/skeleton';
import type { Producto } from '@/domain/producto';
import { cn } from '@/lib/cn';
import { TarjetaProducto } from './tarjeta-producto';

/** Grilla responsive con entrada escalonada (se desactiva con prefers-reduced-motion). */
export function GrillaProductos({ productos, className }: { productos: readonly Producto[]; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {productos.map((p, i) => (
        <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <TarjetaProducto producto={p} />
        </li>
      ))}
    </ul>
  );
}

/** Carrusel con scroll-snap en movil; grilla en escritorio. */
export function CarruselProductos({ productos, etiqueta }: { productos: readonly Producto[]; etiqueta: string }) {
  return (
    <ul
      aria-label={etiqueta}
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible"
    >
      {productos.map((p) => (
        <li key={p.id} className="w-[70%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
          <TarjetaProducto producto={p} />
        </li>
      ))}
    </ul>
  );
}

export function GrillaEsqueleto({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <div role="status" aria-label="Cargando productos" className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-line bg-white">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
