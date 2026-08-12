"use client";

import React from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

type Block = {
  label: string;
  title: string;
  desc: string;
  points: string[];
  panelLabel: string;
  panelA: string;
  panelARole: string;
  panelB: string;
  panelBRole: string;
};

export default function ForAgenciesClient() {
  const t = useTranslations('marketing.agenciesPage');
  const blocks = t.raw('blocks') as Block[];

  return (
    <div className="[font-family:var(--font-plex-sans)] pt-16">

      {/* HERO */}
      <section className="relative border-b border-white/7 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)]" />
        <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 pt-20 sm:pt-24 pb-16 sm:pb-18">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
              <span className="w-6 h-px bg-accent-gold" />
              <span>{t('badge')}</span>
            </div>
            <h1 className="mt-6 text-[34px] sm:text-[52px] lg:text-[58px] leading-[1.06] tracking-[-0.032em] font-normal text-text-heading text-balance">
              {t('title')}<br />
              <span className="text-accent-gold">{t('titleAccent')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-text-muted text-pretty">
              {t('subheadline')}
            </p>
            <Link
              href="/assessment"
              className="mt-8 inline-block text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-6 py-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            >
              {t('ctaHero')}
            </Link>
          </div>
        </div>
      </section>

      {/* BLOCKS */}
      {blocks.map((block, i) => (
        <section key={block.title} className={`border-b border-white/7 ${i % 2 === 1 ? 'bg-[#0B0C0E]' : ''}`}>
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
              <div className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase text-text-subtle">
                {String(i + 1).padStart(2, '0')} · {block.label}
              </div>
              <h2 className="mt-4 text-[24px] sm:text-[32px] font-normal tracking-[-0.026em] leading-[1.14] text-text-heading text-balance">
                {block.title}
              </h2>
              <p className="mt-4.5 text-[15.5px] leading-relaxed text-text-muted text-pretty">{block.desc}</p>
              <div className="mt-6 grid gap-2.5">
                {block.points.map((point) => (
                  <div key={point} className="grid grid-cols-[12px_1fr] gap-2.5 items-start text-[14px] leading-relaxed text-[#868C91]">
                    <Check className="w-3 h-3 mt-1 text-accent-gold" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
              <div className="border border-white/9 bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom shadow-panel-elevated">
                <div className="px-5 h-11 flex items-center border-b border-white/7 [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.12em] uppercase text-text-subtle">
                  {block.panelLabel}
                </div>
                <div className="px-5 py-7">
                  {block.panelA ? (
                    // The controller/processor pair is the one diagram that carries
                    // information here rather than decorating the column.
                    <div className="flex items-center justify-center gap-5">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 border border-white/14 flex items-center justify-center text-[13px] text-text-primary">{block.panelA}</div>
                        <span className="[font-family:var(--font-plex-mono)] text-[10px] tracking-[0.12em] uppercase text-text-subtle">{block.panelARole}</span>
                      </div>
                      <span aria-hidden="true" className="w-10 h-px bg-white/16" />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 border border-[#C9A227]/50 bg-accent-gold/[0.06] flex items-center justify-center text-[13px] text-accent-gold">{block.panelB}</div>
                        <span className="[font-family:var(--font-plex-mono)] text-[10px] tracking-[0.12em] uppercase text-accent-gold">{block.panelBRole}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {block.points.map((point) => (
                        <div key={point} className="grid grid-cols-[auto_1fr] gap-2.5 items-baseline [font-family:var(--font-plex-mono)] text-[11px] text-[#8A9095]">
                          <span className="w-1 h-1 bg-accent-gold translate-y-[-2px]" />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
