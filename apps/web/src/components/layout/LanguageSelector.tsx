"use client";

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { Globe } from 'lucide-react';
import { ChangeEvent, useTransition } from 'react';

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

/**
 * In-product language switcher.
 *
 * The product ships in three languages and had no way to change between them
 * once you were inside it — this component existed, styled for the retired
 * light theme (`text-gray-900`, `ring-gray-300`, an indigo focus ring) and
 * imported by nothing at all. Repainted and mounted in the sidebar footer,
 * beside Settings and Support.
 *
 * `router.replace` with a locale keeps you on the page you were reading, rather
 * than sending you back to the dashboard to re-navigate.
 */
export default function LanguageSelector() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="relative flex items-center">
      <Globe size={16} className="pointer-events-none absolute left-2.5 text-[#6E747A]" aria-hidden="true" />
      <label htmlFor="language-select" className="sr-only">
        {t('language')}
      </label>
      <select
        id="language-select"
        value={locale}
        disabled={isPending}
        onChange={onSelectChange}
        className="w-full appearance-none rounded-lg bg-transparent py-2 pl-[34px] pr-3 text-[13.5px] text-[#9BA1A6] transition-colors hover:bg-white/[0.04] hover:text-[#E6E8EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] disabled:opacity-50"
      >
        {LOCALES.map((l) => (
          <option key={l.value} value={l.value} className="bg-[#0D0F11] text-[#E6E8EA]">
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
