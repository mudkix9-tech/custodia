"use client";

import React from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function EnterpriseClient() {
  const t = useTranslations('marketing.enterprisePage');
  const blocks = t.raw('blocks') as { label: string; title: string; desc: string; points: string[] }[];

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
        </div>
      </section>

      {/* CAPABILITY BLOCKS */}
      <section className="border-b border-white/7">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/8 border border-white/8">
            {blocks.map((block) => (
              <div key={block.title} className="bg-surface-base p-7 pb-8 flex flex-col gap-3.5">
                <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-accent-gold">{block.label}</span>
                <h2 className="text-[19px] font-medium tracking-[-0.015em] text-[#EDEFF0] text-balance">{block.title}</h2>
                <p className="text-[14.5px] leading-relaxed text-[#868C91] text-pretty">{block.desc}</p>
                <div className="mt-auto pt-4.5 grid gap-2">
                  {block.points.map((point) => (
                    <div key={point} className="grid grid-cols-[12px_1fr] gap-2.5 items-start text-[13.5px] leading-relaxed text-text-muted">
                      <Check className="w-3 h-3 mt-1 text-accent-gold" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-b border-white/7">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(90%_90%_at_50%_50%,#000,transparent_75%)]" />
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-24 flex flex-col items-center text-center">
          <h2 className="max-w-2xl text-[26px] sm:text-[40px] font-normal tracking-[-0.03em] leading-[1.12] text-text-heading text-balance">
            {t('ctaTitle')}
          </h2>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-text-muted text-pretty">{t('ctaDesc')}</p>
          <Link
            href="/contact"
            className="mt-8 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-7 py-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            {t('ctaBtn')}
          </Link>
        </div>
      </section>

    </div>
  );
}
