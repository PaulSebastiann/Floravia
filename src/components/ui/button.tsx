import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const botonVariantes = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none ' +
    'transition-[background-color,color,box-shadow,transform] duration-200 active:translate-y-px ' +
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  {
    variants: {
      variante: {
        primario: 'bg-moss-700 text-cream-50 hover:bg-moss-900 shadow-soft',
        secundario: 'bg-moss-100 text-moss-900 hover:bg-moss-200',
        acento: 'bg-petal-700 text-white hover:bg-moss-900',
        contorno: 'border border-moss-700 text-moss-800 hover:bg-moss-50',
        fantasma: 'text-moss-800 hover:bg-moss-100',
        claro: 'bg-cream-50 text-moss-900 hover:bg-white shadow-soft',
      },
      tamano: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
        icono: 'size-11',
      },
    },
    defaultVariants: { variante: 'primario', tamano: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof botonVariantes> {
  asChild?: boolean;
  cargando?: boolean;
}

export function Button({
  className, variante, tamano, asChild = false, cargando = false, disabled, children, type, ...props
}: ButtonProps) {
  if (asChild) {
    // Con asChild el hijo (p. ej. <Link>) conserva su semantica; solo se aplican estilos.
    return (
      <Slot className={cn(botonVariantes({ variante, tamano }), className)} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={cn(botonVariantes({ variante, tamano }), className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
