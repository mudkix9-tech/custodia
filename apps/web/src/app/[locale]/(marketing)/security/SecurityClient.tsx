"use client";

import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// Kept on the .online domain because that is the mailbox the security team
// actually monitors; the marketing site is .com. Worth reconciling.
const SECURITY_EMAIL = 'security@trycustodia.online';

export default function SecurityClient() {
  const t = useTranslations('marketing.securityPage');
  const principles = t.raw('principles') as { label: string; title: string; desc: string }[];
  const gdprPoints = t.raw('gdprPoints') as string[];

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

      {/* PRINCIPLES */}
      <section className="border-b border-white/7">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/8 border border-white/8">
            {principles.map((p) => (
              <div key={p.title} className="bg-surface-base p-6.5 pb-7 flex flex-col gap-2.5">
                <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-accent-gold">{p.label}</span>
                <span className="text-[16px] font-medium tracking-[-0.012em] text-[#EDEFF0]">{p.title}</span>
                <span className="text-[13.5px] leading-relaxed text-[#868C91] text-pretty">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DETAIL */}
      <section className="border-b border-white/7 bg-[#0B0C0E]">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 py-16 sm:py-20 grid gap-14">

          <div>
            <h2 className="text-[22px] sm:text-[28px] font-normal tracking-[-0.025em] text-text-heading text-balance">{t('gdprTitle')}</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-text-muted text-pretty">{t('gdprBody')}</p>
            <div className="mt-6 grid gap-2.5">
              {gdprPoints.map((point) => (
                <div key={point} className="grid grid-cols-[12px_1fr] gap-2.5 items-start text-[14px] leading-relaxed text-[#868C91]">
                  <Check className="w-3 h-3 mt-1 text-accent-gold" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-12 border-t border-white/8">
            <h2 className="text-[22px] sm:text-[28px] font-normal tracking-[-0.025em] text-text-heading text-balance">{t('subTitle')}</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-text-muted text-pretty">{t('subBody')}</p>
            <Link
              href="/legal/subprocessors"
              className="mt-6 inline-flex items-center gap-2 text-[14px] text-accent-gold hover:text-accent-gold-hover transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
            >
              {t('subLink')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="pt-12 border-t border-white/8">
            <h2 className="text-[22px] sm:text-[28px] font-normal tracking-[-0.025em] text-text-heading text-balance">{t('contactTitle')}</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-text-muted text-pretty">{t('contactBody')}</p>
            <a
              href={`mailto:${SECURITY_EMAIL}`}
              className="mt-6 inline-block text-[14px] text-text-primary border border-white/16 hover:border-white/40 px-5 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
            >
              {t('contactCta')}
            </a>
            <div className="mt-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-text-subtle">{SECURITY_EMAIL}</div>
          </div>

        </div>
      </section>

    </div>
  );
}
