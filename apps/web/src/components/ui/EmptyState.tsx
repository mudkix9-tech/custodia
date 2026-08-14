import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The empty state for a list view.
 *
 * Every one of the fifteen list views rendered a single grey sentence — "No
 * processing activities found." — and offered no way to create the first one.
 * That is the exact moment a €99/mo tool has to teach: the account is new, the
 * screen is empty, and the customer does not yet know what belongs here.
 *
 * `title` says what is missing, `description` says why it matters, and `action`
 * is the one thing to do about it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Icon className="h-5 w-5 text-[#6E747A]" />
        </div>
      )}
      <h3 className="text-[15px] font-medium text-[#F4F5F6]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-[#9BA1A6]">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {action && <EmptyStateButton {...action} primary />}
          {secondaryAction && <EmptyStateButton {...secondaryAction} />}
        </div>
      )}
    </div>
  );
}

function EmptyStateButton({
  label,
  onClick,
  href,
  primary = false,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const className = primary
    ? 'rounded-lg bg-[#C9A227] px-4 py-2 text-[13.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60'
    : 'rounded-lg border border-white/10 px-4 py-2 text-[13.5px] text-[#E6E8EA] transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60';

  if (href) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
