'use client';

import * as RT from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = RT.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RT.List>) {
  return (
    <RT.List
      className={cn('no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-cream-200 p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RT.Trigger>) {
  return (
    <RT.Trigger
      className={cn(
        'rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap text-moss-800 transition-colors',
        'hover:bg-cream-100 data-[state=active]:bg-moss-700 data-[state=active]:text-cream-50',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RT.Content>) {
  return <RT.Content className={cn('mt-6 data-[state=active]:animate-fade-up', className)} {...props} />;
}
