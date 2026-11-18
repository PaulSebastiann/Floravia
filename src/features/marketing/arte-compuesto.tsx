import { BotanicalArt } from '@/components/ui/botanical-art';
import { cn } from '@/lib/cn';

type Tono = 'home' | 'ramos' | 'plantas' | 'semillas';

const TARJETAS = [
  { forma: 'ramo', semilla: 'hero-ramo', colores: ['#c4575a', '#e8938f', '#fbe9e7'], clase: 'left-0 top-10 -rotate-6 w-[46%]' },
  { forma: 'planta', semilla: 'hero-planta', colores: [], clase: 'right-0 top-0 rotate-3 w-[52%]' },
  { forma: 'sobre', semilla: 'hero-sobre', colores: ['#e0a93b'], clase: 'bottom-0 left-[26%] rotate-1 w-[44%]' },
] as const;

/** Composicion de tres "tarjetas" ilustradas; la principal cambia segun la landing. */
export function ArteCompuesto({ tono, className }: { tono: Tono; className?: string }) {
  const orden = tono === 'home' ? [0, 1, 2] : tono === 'ramos' ? [1, 2, 0] : tono === 'plantas' ? [0, 2, 1] : [0, 1, 2];
  const principal = tono === 'ramos' ? 0 : tono === 'plantas' ? 1 : tono === 'semillas' ? 2 : -1;
  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-lg', className)} aria-hidden="true">
      <div className="absolute inset-[6%] rounded-[42%_58%_55%_45%/50%_42%_58%_50%] bg-moss-100 animate-sway motion-reduce:animate-none" />
      {orden.map((idx) => {
        const t = TARJETAS[idx];
        if (!t) return null;
        return (
          <div
            key={t.semilla}
            className={cn(
              'absolute overflow-hidden rounded-card border-4 border-white bg-white shadow-lift',
              t.clase,
              principal === idx && 'z-10 scale-110',
            )}
          >
            <BotanicalArt forma={t.forma} semilla={t.semilla} colores={t.colores} className="aspect-square" />
          </div>
        );
      })}
    </div>
  );
}
