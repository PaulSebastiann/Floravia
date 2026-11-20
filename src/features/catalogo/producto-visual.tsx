import { Camera } from 'lucide-react';
import { BotanicalArt } from '@/components/ui/botanical-art';
import type { Producto } from '@/domain/producto';
import { cn } from '@/lib/cn';

const SOBRE: Record<string, string> = { flores: '#e8938f', huerto: '#5b8c52', aromaticas: '#8a63b5' };

function colorSobreSemilla(p: Producto): string {
  const nombre = p.nombre.toLowerCase();
  if (/(albahaca|cilantro|menta)/.test(nombre)) return SOBRE['aromaticas']!;
  if (/(lechuga|tomate)/.test(nombre)) return SOBRE['huerto']!;
  return SOBRE['flores']!;
}

/** Foto real si existe; sin foto se muestra un marcador neutro o un sobre ilustrado para semillas. */
export function ProductoVisual({ producto, className }: { producto: Producto; className?: string }) {
  const foto = producto.imagenes[0];
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element -- origen = API/medios del backend, aun sin remotePatterns
    return <img src={foto.url} alt={foto.alt} loading="lazy" className={className ?? 'h-full w-full object-cover'} />;
  }
  if (producto.linea !== 'semillas') {
    return (
      <div role="img" aria-label={`${producto.nombre}: foto próximamente`}
        className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-cream-100 text-moss-500', className)}>
        <Camera className="size-8" aria-hidden="true" />
        <span className="text-sm font-medium">Foto próximamente</span>
      </div>
    );
  }
  return (
    <BotanicalArt forma="sobre" semilla={producto.id} colores={[colorSobreSemilla(producto)]} etiqueta={producto.nombre} className={className} />
  );
}
