"use client";

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// The single source of truth for what Professional costs. The annual figure and
// the advertised saving are both derived from these two numbers — the page used
// to hardcode "Save up to €432/year" alongside a €99/€79 pair that actually
// saves €240, a leftover from a tier that no longer exists.
const MONTHLY_PRICE = 99;
const ANNUAL_MONTHLY_PRICE = 79;
const ANNUAL_SAVING = (MONTHLY_PRICE - ANNUAL_MONTHLY_PRICE) * 12;

export default function PricingClient() {
  const t = useTranslations('marketing.pricingPage');
  const [annual, setAnnual] = useState(true);

  const professionalFeatures = t.raw('professionalFeatures') as string[];
  const enterpriseFeatures = t.raw('enterpriseFeatures') as string[];
  const faqs = t.raw('faqs') as { q: string; a: string }[];

  const tiers = [
    {
      name: t('professionalName'),
      badge: t('professionalBadge'),
      blurb: t('professionalBlurb'),
      cta: t('professionalCta'),
      href: '/signup',
      features: professionalFeatures,
      price: annual ? ANNUAL_MONTHLY_PRICE : MONTHLY_PRICE,
      period: annual ? t('perMonthAnnual') : t('perMonth'),
      highlight: true,
    },
    {
      name: t('enterpriseName'),
      badge: '',
      blurb: t('enterpriseBlurb'),
      cta: t('enterpriseCta'),
      href: '/contact',
      features: enterpriseFeatures,
      price: null,
      period: '',
      highlight: false,
    },
  ];

  return (
    <div className="[font-family:var(--font-plex-sans)] pt-16">

      {/* HEADER */}
      <section className="relative border-b border-white/7 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)]" />
        <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 pt-20 sm:pt-24 pb-16 sm:pb-18">
          <div className="flex flex-wrap gap-7 items-end justify-between">
            <div>
              <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
                <span className="w-6 h-px bg-accent-gold" />
                <span>{t('badge')}</span>
              </div>
              <h1 className="mt-5.5 max-w-xl text-[32px] sm:text-[46px] font-normal tracking-[-0.03em] leading-[1.1] text-text-heading text-balance">
                {t('title')}
              </h1>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-text-muted text-pretty">
                {t('subheadline')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className="[font-family:var(--font-plex-mono)] text-[11.5px] tracking-[0.08em] px-3.5 py-3 border border-white/14 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
                style={{ background: annual ? 'transparent' : 'rgba(201,162,39,0.14)', color: annual ? '#8A9095' : '#C9A227' }}
              >
                {t('monthlyLabel').toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className="[font-family:var(--font-plex-mono)] text-[11.5px] tracking-[0.08em] px-3.5 py-3 border border-white/14 transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
                style={{ background: annual ? 'rgba(201,162,39,0.14)' : 'transparent', color: annual ? '#C9A227' : '#8A9095' }}
              >
                {t('annualLabel').toUpperCase()}
                <span className="text-[10px] text-[#7FA88B]">{t('annualSaveBadge')}</span>
              </button>
            </div>
          </div>

          {/* Reserved height so toggling billing does not shift the cards below. */}
          <div className="mt-5 min-h-[1.25em] [font-family:var(--font-plex-mono)] text-[11.5px] tracking-[0.06em] text-[#7FA88B]">
            {annual && t('savingsNote', { amount: ANNUAL_SAVING })}
          </div>
        </div>
      </section>

      {/* TIERS */}
      <section className="border-b border-white/7">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-px bg-white/8 border border-white/8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="p-6.5 pb-7.5 flex flex-col justify-between min-h-[460px]"
                style={{
                  background: tier.highlight ? '#1F241D0d' : '#08090A',
                  border: tier.highlight ? '1px solid rgba(201,162,39,0.5)' : undefined,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase"
                      style={{ color: tier.highlight ? '#C9A227' : '#8A9095' }}
                    >
                      {tier.name}
                    </span>
                    {tier.badge && (
                      <span className="[font-family:var(--font-plex-mono)] text-[9.5px] tracking-[0.1em] uppercase text-surface-base bg-accent-gold px-1.5 py-0.5">
                        {tier.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1.5 mt-4 flex-wrap">
                    <span className="text-[38px] font-light tracking-[-0.03em] leading-none text-text-heading [font-family:var(--font-plex-mono)]">
                      {tier.price === null ? t('custom') : `€${tier.price}`}
                    </span>
                    {tier.period && <span className="text-[13px] text-text-subtle">{tier.period}</span>}
                  </div>

                  <p className="mt-4 text-[13.5px] leading-relaxed text-[#868C91] min-h-[42px] text-pretty">{tier.blurb}</p>

                  <div className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-text-subtle pt-5 mt-1 border-t border-white/7">
                    {t('included')}
                  </div>
                  <div className="grid gap-2.5 pt-4">
                    {tier.features.map((feat) => (
                      <div key={feat} className="grid grid-cols-[12px_1fr] gap-2.5 items-start text-[13.5px] leading-normal text-text-muted">
                        <Check className="w-3 h-3 mt-0.5" style={{ color: tier.highlight ? '#C9A227' : '#5F655A' }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={tier.href}
                  className="mt-7 text-center text-[13.5px] font-medium py-3 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
                  style={
                    tier.highlight
                      ? { background: '#C9A227', color: '#08090A' }
                      : { background: 'transparent', color: '#E6E8EA', border: '1px solid rgba(255,255,255,0.18)' }
                  }
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-7 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-text-subtle">
            <span>{t('footnote1')}</span>
            <span>{t('footnote2')}</span>
            <span>{t('footnote3')}</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-white/7 bg-[#0B0C0E]">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
          <h2 className="text-[24px] sm:text-[32px] font-normal tracking-[-0.025em] text-text-heading text-balance">
            {t('faqTitle')}
          </h2>
          <div className="mt-10 grid gap-px bg-white/8 border border-white/8">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-[#0B0C0E] px-6 py-5.5">
                <h3 className="text-[15.5px] font-medium tracking-[-0.01em] text-[#EDEFF0] text-balance">{faq.q}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#868C91] text-pretty">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
