import * as React from 'react';
import { cn } from '@/utils/cn';

/** Hairline panel that every settings section lives in. */
export function SettingsCard({
  children,
  className,
  tone = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={cn(
        'rounded-[14px] border bg-set-panel',
        tone === 'danger'
          ? 'border-[color-mix(in_srgb,var(--color-set-danger)_32%,transparent)]'
          : 'border-set-line',
        className
      )}
    >
      {children}
    </section>
  );
}

/**
 * Card header: gold icon, title, optional count chip, and a right-hand slot
 * for a secondary action or filter field.
 */
export function SettingsCardHeader({
  icon: Icon,
  title,
  count,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  count?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 px-[22px] pt-[18px] pb-4',
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {Icon ? <Icon className="h-4 w-4 flex-none text-set-gold" /> : null}
          <span className="text-[14.5px] font-semibold tracking-[-0.005em] text-set-fg">
            {title}
          </span>
          {count !== undefined && count !== null ? <CountChip>{count}</CountChip> : null}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-[1.5] text-set-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Mono count badge shown next to a card title. */
export function CountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-set-line-strong px-[7px] py-px font-mono text-[11.5px] text-set-fg-muted">
      {children}
    </span>
  );
}

/** Full-bleed divider between rows inside a card. */
export function SettingsCardDivider() {
  return <div className="border-t border-set-line-soft" />;
}

/** Centred placeholder for an empty list inside a card. */
export function SettingsEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[22px] py-10 text-center text-[13px] text-set-fg-muted">{children}</div>
  );
}

/** Label + control pair used by the form-heavy settings pages. */
export function SettingsField({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted"
        >
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="mt-1.5 text-[11.5px] text-set-fg-subtle">{hint}</p> : null}
    </div>
  );
}
