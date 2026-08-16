"use client";

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';

/**
 * A language is named in its own language, never translated — a French speaker
 * looking for their language scans for "Français", not "French" or "Franzosisch".
 */
export const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
};

/**
 * Locale switching, shared by the sidebar selector and the marketing footer.
 *
 * Two things here are easy to get wrong separately in each switcher, which is
 * why they live in one place:
 *
 * The search string is read from `window.location` inside the handler rather
 * than through `useSearchParams()`. Both preserve the query — switching language
 * on `/ropa?status=open` used to drop you on an unfiltered list — but
 * `useSearchParams()` is a render-time dependency that opts the whole subtree
 * out of static rendering unless it sits under a Suspense boundary. The footer
 * switcher is in the marketing layout, which is statically prerendered, so that
 * would have cost the prerender of every marketing page (and is the same trap
 * that crashed the build on /ropa/new). Reading it in an event handler is
 * client-only by definition and costs nothing.
 *
 * The cookie write is for persistence. next-intl sets `NEXT_LOCALE` itself on a
 * switch, but as a session cookie; an explicit max-age is what makes the choice
 * outlast the browser. The middleware no longer resolves a locale from it
 * (see `localeDetection` in i18n/routing.ts), so it records a preference and
 * cannot route anyone against the URL.
 */
export function useLocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: string) {
    if (nextLocale === locale) return;

    document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000;samesite=lax`;

    startTransition(() => {
      // `replace` rather than `push`: a language switch is a correction, not a
      // step you should have to press Back through.
      router.replace(`${pathname}${window.location.search}`, { locale: nextLocale });
    });
  }

  return { locale, isPending, switchLocale };
}
