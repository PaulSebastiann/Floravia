import { BotanicalArt } from '@/components/ui/botanical-art';
import type { ColorFlor, Planta, Producto } from '@/domain/producto';

const HEX_COLOR: Record<ColorFlor, string> = {
  rojo: '#c4575a', rosa: '#e8938f', blanco: '#fdfbf6', amarillo: '#f3c969',
  naranja: '#e8863a', morado: '#8a63b5', multicolor: '#e8938f',
};
const MULTI = ['#c4575a', '#f3c969', '#8a63b5', '#e8863a'];
const SOBRE: Record<string, string> = { flores: '#e8938f', huerto: '#5b8c52', aromaticas: '#8a63b5' };

/** Heuristica solo para la ilustracion de respaldo; desaparece cuando haya fotos. */
function varianteDe(p: Planta) {
  if (p.riegoCadaDias >= 14 && p.luz === 'sol-directo') return 'roseta' as const; // suculentas
  if (p.riegoCadaDias >= 14) return 'espigas' as const; // sansevieria y similares
  return 'anchas' as const;
}

/** Foto real si existe; si no, ilustracion determinista. */
export function ProductoVisual({ producto, className }: { producto: Producto; className?: string }) {
  const foto = producto.imagenes[0];
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element -- origen = API/medios del backend, aun sin remotePatterns
    return <img src={foto.url} alt={foto.alt} loading="lazy" className={className ?? 'h-full w-full object-cover'} />;
  }
  switch (producto.linea) {
    case 'ramos': {
      const colores = producto.colores.includes('multicolor')
        ? MULTI
        : producto.colores.map((c) => HEX_COLOR[c]);
      return <BotanicalArt forma="ramo" semilla={producto.id} colores={colores} etiqueta={producto.nombre} className={className} />;
    }
    case 'plantas':
      return <BotanicalArt forma="planta" semilla={producto.id} variante={varianteDe(producto)} etiqueta={producto.nombre} className={className} />;
    case 'semillas':
      return (
        <BotanicalArt forma="sobre" semilla={producto.id} colores={[SOBRE[producto.cultivo] ?? '#e0a93b']} etiqueta={producto.nombre} className={className} />
      );
  }
}
