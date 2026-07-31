"use client";

import { useLocale } from 'next-intl';
import { usePathname, useRouter, routing } from '@/i18n/routing';
import { useTransition } from 'react';

export function FooterLocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                router.replace(pathname, { locale: code });
              })
            }
            className={`[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.08em] px-2.5 py-1.5 uppercase transition-colors border ${
              active
                ? 'bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/50'
                : 'bg-transparent text-[#8A9095] border-white/10 hover:text-[#E6E8EA]'
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
