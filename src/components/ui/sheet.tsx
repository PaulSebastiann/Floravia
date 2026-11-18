'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

interface ContenidoProps extends Omit<ComponentProps<typeof Dialog.Content>, 'title'> {
  titulo: string;
  descripcion?: string;
  lado?: 'izquierda' | 'derecha';
  children: ReactNode;
}

/** Panel lateral accesible: foco atrapado y restaurado, Escape cierra (Radix Dialog). */
export function SheetContent({ titulo, descripcion, lado = 'derecha', className, children, ...props }: ContenidoProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-moss-900/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <Dialog.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-[min(24rem,92vw)] flex-col bg-cream-50 shadow-lift',
          lado === 'derecha' ? 'right-0' : 'left-0',
          'data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <Dialog.Title className="font-display text-xl font-semibold text-moss-900">{titulo}</Dialog.Title>
          <Dialog.Close
            className="inline-flex size-10 items-center justify-center rounded-full text-moss-800 hover:bg-moss-100"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden="true" />
          </Dialog.Close>
        </header>
        {descripcion ? (
          <Dialog.Description className="sr-only">{descripcion}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
