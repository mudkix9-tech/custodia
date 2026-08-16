"use client";

import { useTranslations } from 'next-intl';
import { LOCALE_LABELS, useLocaleSwitcher } from '@/hooks/useLocaleSwitcher';
import { routing } from '@/i18n/routing';
import { Check, ChevronUp, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * In-product language switcher.
 *
 * The product ships in three languages and had no way to change between them
 * once you were inside it — this component existed, styled for the retired
 * light theme (`text-gray-900`, `ring-gray-300`, an indigo focus ring) and
 * imported by nothing at all. Repainted and mounted in the sidebar footer,
 * beside Settings and Support.
 *
 * A native `<select>` was the first pass, and it never sat right: the option
 * list is drawn by the OS rather than the page, so it arrived white-on-white
 * against the dark panel, and `appearance-none` left the row with no affordance
 * at all. This is the same button-plus-upward-popup shape as the account menu
 * directly below it, so the whole sidebar footer reads as one control surface.
 *
 * Switching keeps you on the page you were reading, filters and all, rather
 * than sending you back to the dashboard to re-navigate — see
 * `useLocaleSwitcher`.
 */
export default function LanguageSelector() {
  const t = useTranslations('common');
  const { locale, isPending, switchLocale } = useLocaleSwitcher();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        // Focus would otherwise be left on a button that no longer exists,
        // which drops a keyboard user back at the top of the document.
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function onSelect(nextLocale: string) {
    setIsOpen(false);
    switchLocale(nextLocale);
  }

  const currentLabel = LOCALE_LABELS[locale] ?? locale;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${t('language')}: ${currentLabel}`}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[#9BA1A6] hover:bg-white/[0.04] hover:text-[#E6E8EA] focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none transition-colors disabled:opacity-50"
      >
        <Globe size={16} className="text-[#6E747A] shrink-0" />
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <ChevronUp
          size={14}
          className="text-[#6E747A] shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t('language')}
          className="absolute bottom-full left-0 mb-2 w-full bg-[#1A1D21] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 z-50"
        >
          {routing.locales.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                lang={code}
                onClick={() => onSelect(code)}
                className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none ${
                  active ? 'text-[#C9A227]' : 'text-[#E6E8EA]'
                }`}
              >
                <span className="flex-1 truncate">{LOCALE_LABELS[code] ?? code}</span>
                {active && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
