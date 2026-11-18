import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const badgeVariantes = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
  {
    variants: {
      tono: {
        ramos: 'bg-petal-100 text-petal-700',
        plantas: 'bg-moss-100 text-moss-800',
        semillas: 'bg-sun-100 text-sun-800',
        neutro: 'bg-cream-200 text-ink',
        oscuro: 'bg-moss-800 text-cream-50',
        agotado: 'bg-stone-200 text-stone-700',
      },
    },
    defaultVariants: { tono: 'neutro' },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariantes> {}

export function Badge({ className, tono, ...props }: BadgeProps) {
  return <span className={cn(badgeVariantes({ tono }), className)} {...props} />;
}
