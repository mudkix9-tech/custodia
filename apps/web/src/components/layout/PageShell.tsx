import React from 'react';
import { cn } from '@/utils/cn';

/**
 * One page container.
 *
 * The product had six: `max-w-7xl mx-auto p-6`, `max-w-[1200px] mx-auto p-8`,
 * `max-w-5xl mx-auto p-8`, `max-w-6xl mx-auto p-8 space-y-8`, Settings'
 * `mx-auto max-w-[1040px] px-8 pt-10 pb-24`, and a bare `p-8` — so the same
 * table started at a different x-position depending on which module you had
 * navigated from, and the gutter changed under you.
 *
 * `width` covers the three cases that actually differ: reading measure for
 * forms and settings, the default for lists, and full-bleed for boards and wide
 * tables that would otherwise scroll horizontally inside a narrower column.
 */
export function PageShell({
  children,
  width = 'default',
  className,
}: {
  children: React.ReactNode;
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-8 pt-8 pb-24',
        width === 'narrow' && 'max-w-[1040px]',
        width === 'default' && 'max-w-[1200px]',
        width === 'wide' && 'max-w-[1440px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The page masthead. Five different treatments existed across the product —
 * `text-3xl font-serif`, `text-2xl font-bold`, `text-2xl font-serif` with an
 * icon tile, and two more — which is what happens when the header above carries
 * no title and every page has to invent one.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-3xl tracking-tight text-[#F4F5F6]">{title}</h1>
        {description && <p className="mt-2 text-[15px] text-[#9BA1A6]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
