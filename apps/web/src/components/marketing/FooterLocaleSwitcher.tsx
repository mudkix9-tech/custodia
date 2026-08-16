"use client";

import { useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import { LOCALE_LABELS, useLocaleSwitcher } from '@/hooks/useLocaleSwitcher';

/**
 * Language switcher for the marketing footer.
 *
 * Kept as three visible codes rather than a dropdown: it sits in the bottom bar
 * beside the copyright line, where the whole row is mono microtype, and a
 * visitor who cannot read the current language needs to see their own without
 * opening anything first. The full name is on each control for screen readers
 * and on hover, since "de" alone is not an accessible name.
 *
 * One bordered group with hairline dividers, rather than three detached boxes —
 * the codes are alternatives to each other, and the segmented shape is what says
 * so. The current one stays focusable rather than being disabled, so a keyboard
 * user can tab across and find out which language they are in; selecting it is a
 * no-op.
 */
export function FooterLocaleSwitcher() {
  const t = useTranslations('common');
  const { locale, isPending, switchLocale } = useLocaleSwitcher();

  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex items-center rounded-md border border-white/10"
    >
      {routing.locales.map((code, i) => {
        const active = code === locale;
        const label = LOCALE_LABELS[code] ?? code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            disabled={isPending}
            aria-current={active ? 'true' : undefined}
            aria-label={label}
            title={label}
            onClick={() => switchLocale(code)}
            className={`[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.08em] px-2.5 py-1.5 uppercase transition-colors relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none first:rounded-l-[5px] last:rounded-r-[5px] ${
              i > 0 ? 'border-l border-white/10' : ''
            } ${
              active
                ? 'bg-accent-gold/15 text-accent-gold'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04] disabled:opacity-50'
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
