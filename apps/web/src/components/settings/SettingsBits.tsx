"use client";

import * as React from 'react';
import { cn } from '@/utils/cn';

/** Gold pill switch used for granular access and preference rows. */
export function SettingsToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'flex h-5 w-[34px] flex-none items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'justify-end bg-set-gold' : 'justify-start bg-[#1C1C20]'
      )}
    >
      <span
        className={cn(
          'h-4 w-4 rounded-full transition-colors',
          checked ? 'bg-[#0A0A0A]' : 'bg-set-fg-muted'
        )}
      />
    </button>
  );
}

/** Dot + label status marker (Active / Invited / Suspended). */
export function StatusDot({
  tone,
  children,
}: {
  tone: 'ok' | 'pending' | 'danger' | 'idle';
  children: React.ReactNode;
}) {
  const dot = {
    ok: 'bg-set-ok',
    pending: 'bg-set-gold',
    danger: 'bg-set-danger',
    idle: 'bg-set-fg-subtle',
  }[tone];
  const text = {
    ok: 'text-set-fg',
    pending: 'text-set-gold-hi',
    danger: 'text-set-danger',
    idle: 'text-set-fg-muted',
  }[tone];

  return (
    <span className={cn('inline-flex items-center gap-[7px] text-[12.5px]', text)}>
      <span className={cn('h-1.5 w-1.5 flex-none rounded-full', dot)} />
      {children}
    </span>
  );
}

/** Gold-tinted badge, e.g. the non-editable Owner role. */
export function GoldBadge({
  icon: Icon,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-set-gold/25 bg-set-gold/10 px-[11px] text-[12.5px] text-set-gold-hi">
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

/** Circular initial avatar. */
export function InitialAvatar({
  name,
  size = 32,
}: {
  name?: string | null;
  size?: number;
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      style={{ width: size, height: size, flex: `0 0 ${size}px` }}
      className="inline-flex items-center justify-center rounded-full border border-set-gold/30 bg-set-gold/12 text-[12.5px] font-semibold text-set-gold"
    >
      {initial}
    </span>
  );
}

/** Square 30px icon button used in table action columns. */
export function IconAction({
  icon: Icon,
  title,
  onClick,
  active,
  tone = 'default',
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick?: () => void;
  active?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-set-line-strong text-set-fg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'hover:border-set-danger/35 hover:bg-set-danger/12 hover:text-set-danger'
          : 'hover:bg-[#131316] hover:text-set-fg',
        active && tone !== 'danger' && 'border-set-gold/35 bg-set-gold/10 text-set-gold'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Thin gold progress meter with a label pair above it. */
export function SettingsMeter({
  label,
  value,
  percent,
  note,
  tone = 'gold',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  percent: number;
  note?: React.ReactNode;
  tone?: 'gold' | 'danger';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-[216px] rounded-xl border border-set-line bg-set-panel-alt px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2.5 pb-2.5">
        <span className="set-eyebrow">{label}</span>
        <span className="font-mono text-[13px] text-set-fg">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-[#17171A]">
        <div
          style={{ width: `${clamped}%` }}
          className={cn('h-full rounded', tone === 'danger' ? 'bg-set-danger' : 'bg-set-gold')}
        />
      </div>
      {note ? <div className="pt-2.5 text-[11.5px] text-set-fg-muted">{note}</div> : null}
    </div>
  );
}
