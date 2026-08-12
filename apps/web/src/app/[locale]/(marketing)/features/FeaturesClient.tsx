"use client";

import React from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

type FeatureItem = {
  id: string;
  ref: string;
  title: string;
  subtitle: string;
  desc: string;
  highlights: string[];
  cta: string;
  href: string;
  output: string;
};

export default function FeaturesClient() {
  const t = useTranslations('marketing.featuresPage');
  const items = t.raw('items') as FeatureItem[];

  return (
    <div className="[font-family:var(--font-plex-sans)] pt-16">

      {/* HEADER */}
      <section className="relative border-b border-white/7 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)]" />
        <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 pt-20 sm:pt-24 pb-16 sm:pb-18">
          <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
            <span className="w-6 h-px bg-accent-gold" />
            <span>{t('badge')}</span>
          </div>
          <h1 className="mt-5.5 max-w-2xl text-[32px] sm:text-[46px] font-normal tracking-[-0.03em] leading-[1.1] text-text-heading text-balance">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-text-muted text-pretty">
            {t('subheadline')}
          </p>

          {/* Module index — the ten article references double as in-page navigation. */}
          <nav aria-label={t('badge')} className="mt-9 flex flex-wrap gap-2">
            {items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.08em] text-[#8A9095] hover:text-text-primary border border-white/12 hover:border-white/30 px-2.5 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
              >
                {item.ref}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* MODULES */}
      {items.map((item, i) => (
        <section
          key={item.id}
          id={item.id}
          className={`border-b border-white/7 scroll-mt-20 ${i % 2 === 1 ? 'bg-[#0B0C0E]' : ''}`}
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
              <div className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase text-text-subtle">
                {String(i + 1).padStart(2, '0')} · {item.subtitle}
              </div>
              <h2 className="mt-4 text-[24px] sm:text-[32px] font-normal tracking-[-0.026em] leading-[1.14] text-text-heading text-balance">
                {item.title}
              </h2>
              <p className="mt-4.5 text-[15.5px] leading-relaxed text-text-muted text-pretty">{item.desc}</p>

              <div className="mt-7 grid gap-2.5">
                {item.highlights.map((h) => (
                  <div key={h} className="grid grid-cols-[12px_1fr] gap-2.5 items-start text-[14px] leading-relaxed text-[#868C91]">
                    <Check className="w-3 h-3 mt-1 text-accent-gold" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>

              <Link
                href={item.href}
                className="mt-8 inline-block text-[14px] text-text-primary border border-white/16 hover:border-white/40 px-5 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
              >
                {item.cta}
              </Link>
            </div>

            {/* The artefact this module produces. This slot used to hold an empty
                cream box with a 20%-opacity icon, commented "Visual Placeholder";
                a real product screenshot belongs here once one exists. */}
            <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
              <div className="border border-white/9 bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom shadow-panel-elevated">
                <div className="flex items-center justify-between gap-4 px-5 h-11 border-b border-white/7 [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.12em] uppercase text-text-subtle">
                  <span>{t('producesLabel')}</span>
                  <span className="text-accent-gold">{item.ref}</span>
                </div>
                <div className="px-5 py-6">
                  <p className="text-[16px] leading-relaxed text-[#DDE0E2] text-pretty">{item.output}</p>
                  <div className="mt-5 pt-4 border-t border-white/7 grid gap-2">
                    {item.highlights.slice(0, 3).map((h) => (
                      <div key={h} className="grid grid-cols-[auto_1fr] gap-2.5 items-baseline [font-family:var(--font-plex-mono)] text-[10.5px] text-[#8A9095]">
                        <span className="w-1 h-1 bg-accent-gold translate-y-[-2px]" />
                        <span className="truncate">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      ))}

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-b border-white/7">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(90%_90%_at_50%_50%,#000,transparent_75%)]" />
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-24 flex flex-col items-center text-center">
          <h2 className="max-w-2xl text-[26px] sm:text-[40px] font-normal tracking-[-0.03em] leading-[1.12] text-text-heading text-balance">
            {t('ctaTitle')}
          </h2>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-text-muted text-pretty">{t('ctaDesc')}</p>
          <Link
            href="/assessment"
            className="mt-8 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-7 py-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            {t('ctaBtn')}
          </Link>
        </div>
      </section>

    </div>
  );
}
