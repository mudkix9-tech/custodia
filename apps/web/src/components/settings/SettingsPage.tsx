import * as React from 'react';
import { cn } from '@/utils/cn';

/**
 * Page shell for every settings route: centred measure, generous bottom
 * runway so the last card never sits against the viewport edge.
 */
export function SettingsPage({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  width?: 'default' | 'wide';
}) {
  return (
    <div
      className={cn(
        'mx-auto px-8 pt-10 pb-24',
        width === 'wide' ? 'max-w-[1240px]' : 'max-w-[1040px]',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Serif display title + supporting line, with an optional aside (a seat
 * meter, a plan badge) pinned to the baseline on the right.
 */
export function SettingsHeader({
  title,
  subtitle,
  aside,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 pb-8 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        <h1 className="font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2.5 max-w-[52ch] text-sm leading-[1.55] text-set-fg-muted text-pretty">
            {subtitle}
          </p>
        ) : null}
      </div>
      {aside ? <div className="flex-none">{aside}</div> : null}
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Small uppercase section label ("ORGANIZATION", "GRANULAR ACCESS"). */
export function SettingsEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('set-eyebrow', className)}>{children}</div>;
}
