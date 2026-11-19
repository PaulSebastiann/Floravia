import { Camera } from 'lucide-react';
import { BotanicalArt } from '@/components/ui/botanical-art';
import type { ColorFlor, Planta, Producto } from '@/domain/producto';
import { cn } from '@/lib/cn';

const HEX_COLOR: Record<ColorFlor, string> = {
  rojo: '#c4575a', rosa: '#e8938f', blanco: '#fdfbf6', amarillo: '#f3c969',
  naranja: '#e8863a', morado: '#8a63b5', multicolor: '#e8938f',
};
const MULTI = ['#c4575a', '#f3c969', '#8a63b5', '#e8863a'];
const SOBRE: Record<string, string> = { flores: '#e8938f', huerto: '#5b8c52', aromaticas: '#8a63b5' };

/** Heuristica solo para la ilustracion de respaldo; desaparece cuando haya fotos. */
function varianteDe(p: Planta) {
  const riego = p.riegoCadaDias ?? 0;
  if (riego >= 14 && p.luz === 'sol-directo') return 'roseta' as const; // suculentas
  if (riego >= 14) return 'espigas' as const; // sansevieria y similares
  return 'anchas' as const;
}

/** Foto real si existe. Sin foto: marcador neutro (producto de la API) o ilustracion de respaldo (solo datos de muestra). */
export function ProductoVisual({ producto, className }: { producto: Producto; className?: string }) {
  const foto = producto.imagenes[0];
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element -- origen = API/medios del backend, aun sin remotePatterns
    return <img src={foto.url} alt={foto.alt} loading="lazy" className={className ?? 'h-full w-full object-cover'} />;
  }
  // Producto REAL (viene de la API) sin foto cargada: marcador neutro. Nunca una ilustracion que parezca la foto del producto.
  if (producto.fuente === 'api') {
    return (
      <div role="img" aria-label={`${producto.nombre}: foto próximamente`}
        className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-cream-100 text-moss-500', className)}>
        <Camera className="size-8" aria-hidden="true" />
        <span className="text-sm font-medium">Foto próximamente</span>
      </div>
    );
  }
  switch (producto.linea) {
    case 'ramos': {
      const propios = producto.colores ?? [];
      const colores = propios.includes('multicolor') ? MULTI : propios.map((c) => HEX_COLOR[c]);
      return <BotanicalArt forma="ramo" semilla={producto.id} colores={colores} etiqueta={producto.nombre} className={className} />;
    }
    case 'plantas':
      return <BotanicalArt forma="planta" semilla={producto.id} variante={varianteDe(producto)} etiqueta={producto.nombre} className={className} />;
    case 'semillas':
      return (
        <BotanicalArt forma="sobre" semilla={producto.id} colores={[SOBRE[producto.cultivo ?? ''] ?? '#e0a93b']} etiqueta={producto.nombre} className={className} />
      );
  }
}
