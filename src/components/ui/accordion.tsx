'use client';

import * as RA from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Accordion = RA.Root;

export function AccordionItem({ className, ...props }: ComponentProps<typeof RA.Item>) {
  return <RA.Item className={cn('border-b border-line', className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof RA.Trigger>) {
  return (
    <RA.Header className="flex">
      <RA.Trigger
        className={cn(
          'group flex flex-1 items-center justify-between gap-4 py-5 text-left text-lg font-semibold text-moss-900',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className="size-5 shrink-0 text-moss-700 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </RA.Trigger>
    </RA.Header>
  );
}

export function AccordionContent({ className, children, ...props }: ComponentProps<typeof RA.Content>) {
  return (
    <RA.Content className="overflow-hidden text-muted data-[state=open]:animate-fade-in" {...props}>
      <div className={cn('pb-5 pr-8', className)}>{children}</div>
    </RA.Content>
  );
}
