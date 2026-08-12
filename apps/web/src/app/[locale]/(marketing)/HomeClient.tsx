"use client";

import React, { useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

// All display copy for this page lives in `marketing.home` so the German and
// French builds are not 74% English. Shapes for the arrays read back out of the
// catalogue with t.raw().

type Row = { name: string; meta: string; status: string; due: string };
type Pain = { tag: string; title: string; body: string; stat: string };
type Module = { title: string; ref: string; body: string };
type Corpus = { source: string; detail: string };
type Trust = { label: string; title: string; body: string };
type Advice = { q: string; a: string; cites: { ref: string; text: string }[] };

const NAV_COUNTS = ['', '214', '3', '48', '7', '', '1', ''];
const BAR_VALUES = [38, 46, 41, 55, 62, 58, 66, 61, 72, 69, 75, 80, 74, 82, 88, 84, 91, 86, 94, 90, 97, 93, 88, 95, 99, 92];
const ROW_COLOURS = ['#7FA88B', '#C9A227', '#C48A3F', '#7FA88B', '#8A9095'];

type JurisdictionCode = 'IE' | 'FR' | 'DE' | 'NL' | 'ES';
const JURISDICTIONS: JurisdictionCode[] = ['IE', 'FR', 'DE', 'NL', 'ES'];

export default function HomeClient() {
  const t = useTranslations('marketing');
  const tHome = useTranslations('marketing.home');
  // Tier copy is read from the pricing page's namespace rather than duplicated,
  // so the homepage and /pricing cannot drift apart on price, features or CTA.
  const tPricing = useTranslations('marketing.pricingPage');
  const [annual, setAnnual] = useState(true);

  const [jurisdiction, setJurisdiction] = useState<JurisdictionCode>('IE');

  const mock = tHome.raw('mock') as Record<string, string>;
  const navLabels = tHome.raw('nav') as string[];
  const rows = tHome.raw('rows') as Row[];
  const pains = tHome.raw('pains') as Pain[];
  const modules = tHome.raw('modules') as Module[];
  const corpus = tHome.raw('corpus') as Corpus[];
  const trust = tHome.raw('trust') as Trust[];
  const advisorActions = tHome.raw('advisorActions') as string[];
  const advisor = (tHome.raw('advisorJurisdictions') as Record<JurisdictionCode, Advice>)[jurisdiction];

  const tiers = [
    {
      name: tPricing('professionalName'),
      badge: tPricing('professionalBadge'),
      blurb: tPricing('professionalBlurb'),
      features: tPricing.raw('professionalFeatures') as string[],
      cta: tPricing('professionalCta'),
      href: '/signup',
      price: annual ? 79 : 99,
      period: annual ? tPricing('perMonthAnnual') : tPricing('perMonth'),
      highlight: true,
    },
    {
      name: tPricing('enterpriseName'),
      badge: '',
      blurb: tPricing('enterpriseBlurb'),
      features: tPricing.raw('enterpriseFeatures') as string[],
      cta: tPricing('enterpriseCta'),
      href: '/contact',
      price: null,
      period: '',
      highlight: false,
    },
  ];

  return (
    <div className="[font-family:var(--font-plex-sans)] pt-16">

      {/* HERO */}
      <section id="top" className="relative border-b border-white/7 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)]" />
        <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 pt-20 sm:pt-28 pb-0">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
              <span className="w-6 h-px bg-accent-gold" />
              <span>{t('hero.badge')}</span>
            </div>
            <h1 className="mt-6 text-[40px] sm:text-6xl lg:text-7xl leading-[1.03] tracking-[-0.032em] font-normal text-text-heading text-balance">
              {t('hero.titlePrefix')}<br />
              <span className="text-accent-gold">{t('hero.titleAccent')}</span> {t('hero.titleSuffix')}
            </h1>
            <p className="mt-7 max-w-xl text-[17px] sm:text-[19px] leading-relaxed text-text-muted text-pretty">
              {t('hero.subheadline')}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link href="/assessment" className="text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-6 py-3.5 transition-colors">
                {t('hero.ctaAssessment')}
              </Link>
              <a
                href="#modules"
                onClick={(e) => { e.preventDefault(); document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="text-[15px] text-text-primary border border-white/16 hover:border-white/40 px-6 py-3.5 transition-colors"
              >
                {t('hero.ctaPlatform')}
              </a>
              <span className="[font-family:var(--font-plex-mono)] text-[11.5px] tracking-[0.06em] text-text-subtle pl-1.5">{t('hero.note')}</span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="mt-16 sm:mt-20 relative">
            <div className="border border-white/9 border-b-0 bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom shadow-panel-elevated">
              <div className="flex items-center gap-4 px-4.5 h-11 border-b border-white/7 [font-family:var(--font-plex-mono)] text-[11px] text-text-subtle">
                <span className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/14" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/14" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/14" />
                </span>
                <span className="text-text-muted">{mock.org}</span>
                <span>&mdash;</span>
                <span>{mock.view}</span>
                <span className="flex-1" />
                <span className="text-accent-gold">{mock.region}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-[360px]">
                <div className="hidden md:block border-r border-white/7 py-4.5">
                  {navLabels.map((label, i) => (
                    <div key={label} className="flex items-center justify-between gap-2 px-4.5 py-2.5 text-[12.5px] text-[#8A9095]">
                      <span>{label}</span>
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] text-[#5C6266]">{NAV_COUNTS[i]}</span>
                    </div>
                  ))}
                </div>
                <div className="relative p-5 sm:p-6 overflow-hidden">
                  <div className="flex items-end justify-between gap-5 flex-wrap">
                    <div>
                      <div className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-text-subtle">{mock.scoreLabel}</div>
                      <div className="flex items-baseline gap-2.5 mt-2">
                        <span className="text-[44px] leading-none font-light tracking-[-0.03em] text-text-heading">82</span>
                        <span className="text-[15px] text-text-subtle">/ 100</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px] text-[#7FA88B]">&#9650; {mock.scoreDelta}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] text-accent-gold border border-[#C9A227]/35 px-2.5 py-1.5">{mock.actionExport}</span>
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] text-[#8A9095] border border-white/12 px-2.5 py-1.5">{mock.actionRegister}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end gap-1 h-[74px]">
                    {BAR_VALUES.map((v, i) => (
                      <div key={i} className="flex-1" style={{ height: `${v}%`, background: i > 21 ? '#C9A227' : 'rgba(255,255,255,0.13)' }} />
                    ))}
                  </div>

                  <div className="mt-7 border-t border-white/7">
                    {rows.map((row, i) => (
                      <div key={row.name} className="grid grid-cols-[1.6fr_1fr_0.9fr_0.7fr] gap-3 items-center py-3 border-b border-white/5.5 text-[12.5px] text-text-muted">
                        <span className="text-[#DDE0E2] truncate">{row.name}</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px]">{row.meta}</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px]" style={{ color: ROW_COLOURS[i] }}>{row.status}</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px] text-right text-[#5C6266]">{row.due}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="border-b border-white/7 bg-[#0B0C0E]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
          <div className="flex flex-wrap gap-6 items-baseline justify-between">
            <h2 className="text-[26px] sm:text-[34px] font-normal tracking-[-0.025em] text-text-heading max-w-xl text-balance">{t('pains.title')}</h2>
            <p className="max-w-sm text-[15px] leading-relaxed text-[#7E8489]">{t('pains.subheadline')}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/8 border border-white/8">
            {pains.map((pain, i) => (
              <div key={pain.title} className="bg-[#0B0C0E] p-7 pb-8.5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.12em] text-text-subtle">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[#B0554E]">{pain.tag}</span>
                </div>
                <h3 className="text-[19px] font-medium tracking-[-0.015em] text-[#EDEFF0]">{pain.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-[#8A9095] text-pretty">{pain.body}</p>
                <div className="mt-auto pt-4.5 [font-family:var(--font-plex-mono)] text-[11.5px] text-accent-gold">{pain.stat}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="border-b border-white/7 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-22">
          <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
            <span className="w-6 h-px bg-accent-gold" />
            <span>{t('modules.badge')}</span>
          </div>
          <h2 className="mt-5.5 max-w-2xl text-[28px] sm:text-[42px] font-normal tracking-[-0.028em] leading-[1.12] text-text-heading text-balance">{t('modules.title')}</h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[#8A9095]">{t('modules.subheadline')}</p>

          <div className="mt-13 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/8 border border-white/8">
            {modules.map((mod, i) => (
              <div key={mod.title} className="bg-surface-base hover:bg-surface-panel-top transition-colors p-6.5 pb-7.5 flex flex-col gap-3 min-h-[210px]">
                <div className="flex items-center justify-between">
                  <span className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.12em] text-[#5C6266]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="w-1.5 h-1.5 bg-accent-gold" />
                </div>
                <h3 className="mt-1.5 text-[17.5px] font-medium tracking-[-0.012em] text-[#EDEFF0] text-balance">{mod.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#868C91] text-pretty">{mod.body}</p>
                <div className="mt-auto pt-4 [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.1em] uppercase text-text-subtle">{mod.ref}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI ADVISOR */}
      <section id="advisor" className="relative border-b border-white/7 bg-[#0B0C0E] overflow-hidden scroll-mt-20">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_10%,rgba(201,162,39,0.09),transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-23 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
              <span className="w-6 h-px bg-accent-gold" />
              <span>{t('advisor.badge')}</span>
            </div>
            <h2 className="mt-5.5 text-[28px] sm:text-[40px] font-normal tracking-[-0.028em] leading-[1.13] text-text-heading text-balance">{t('advisor.title')}</h2>
            <p className="mt-5.5 text-[16.5px] leading-relaxed text-text-muted text-pretty">{t('advisor.subheadline')}</p>
            <p className="mt-4.5 [font-family:var(--font-spectral)] italic text-[16.5px] leading-relaxed text-[#B9BEC2] border-l border-[#C9A227]/50 pl-5">{t('advisor.quote')}</p>

            <div className="mt-8.5 grid gap-px bg-white/8 border border-white/8">
              {corpus.map((c) => (
                <div key={c.source} className="bg-[#0B0C0E] grid grid-cols-[1fr_auto] gap-4 items-center px-5 py-3.5">
                  <span className="text-[14.5px] text-[#DDE0E2]">{c.source}</span>
                  <span className="[font-family:var(--font-plex-mono)] text-[11px] text-text-subtle text-right">{c.detail}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-text-subtle">{t('advisor.corpusNote')} 12 July 2026</div>
          </div>

          <div className="border border-white/10 bg-gradient-to-b from-[#0E1012] to-surface-panel-bottom shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2.5 px-4.5 py-3.5 border-b border-white/7 [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.12em] uppercase text-text-subtle">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7FA88B]" />
              <span>{tHome('advisorPanelLabel')} {jurisdiction}</span>
            </div>
            <div className="px-4.5 pt-5 pb-2 flex flex-wrap gap-2">
              {JURISDICTIONS.map((code) => {
                const active = code === jurisdiction;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setJurisdiction(code)}
                    className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.08em] px-2.5 py-1.5 transition-colors border"
                    style={{
                      background: active ? 'rgba(201,162,39,0.14)' : 'transparent',
                      color: active ? '#C9A227' : '#8A9095',
                      borderColor: active ? 'rgba(201,162,39,0.5)' : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            <div className="p-4.5">
              <div className="border border-white/8 bg-[#0F1114] px-4.5 py-4 text-[14.5px] text-[#DDE0E2] leading-relaxed">{advisor.q}</div>
              <div className="mt-3.5 p-4.5 border-l border-[#C9A227] bg-accent-gold/[0.045]">
                <p className="text-[15px] leading-relaxed text-text-primary text-pretty">{advisor.a}</p>
                <div className="mt-4.5 grid gap-2">
                  {advisor.cites.map((cite) => (
                    <div key={cite.ref} className="grid grid-cols-[auto_1fr] gap-2.5 items-baseline [font-family:var(--font-plex-mono)] text-[11px] text-[#8A9095]">
                      <span className="text-accent-gold">{cite.ref}</span>
                      <span>{cite.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {advisorActions.map((a) => (
                  <span key={a} className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.08em] text-[#8A9095] border border-white/12 px-2.5 py-1.5">{a}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-b border-white/7 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-20 sm:py-22">
          <div className="flex flex-wrap gap-7 items-end justify-between">
            <div>
              <div className="flex items-center gap-3 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
                <span className="w-6 h-px bg-accent-gold" />
                <span>{t('pricing.badge')}</span>
              </div>
              <h2 className="mt-5.5 max-w-xl text-[28px] sm:text-[42px] font-normal tracking-[-0.028em] leading-[1.12] text-text-heading">{t('pricing.title')}</h2>
              <p className="mt-4.5 max-w-lg text-[15.5px] leading-relaxed text-[#8A9095]">{t('pricing.subheadline')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className="[font-family:var(--font-plex-mono)] text-[11.5px] tracking-[0.08em] px-3.5 py-2.5 border border-white/14 transition-colors"
                style={{ background: annual ? 'transparent' : 'rgba(201,162,39,0.14)', color: annual ? '#8A9095' : '#C9A227' }}
              >
                {t('pricing.monthlyLabel').toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className="[font-family:var(--font-plex-mono)] text-[11.5px] tracking-[0.08em] px-3.5 py-2.5 border border-white/14 transition-colors"
                style={{ background: annual ? 'rgba(201,162,39,0.14)' : 'transparent', color: annual ? '#C9A227' : '#8A9095' }}
              >
                {t('pricing.annualLabel').toUpperCase()}
              </button>
            </div>
          </div>

          <div className="mt-11.5 grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-px bg-white/8 border border-white/8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="p-6.5 pb-7.5 flex flex-col justify-between min-h-[400px]"
                style={{
                  background: tier.highlight ? '#1F241D0d' : '#08090A',
                  border: tier.highlight ? '1px solid rgba(201,162,39,0.5)' : undefined,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase" style={{ color: tier.highlight ? '#C9A227' : '#8A9095' }}>{tier.name}</span>
                    {tier.badge && (
                      <span className="[font-family:var(--font-plex-mono)] text-[9.5px] tracking-[0.1em] text-surface-base bg-accent-gold px-1.5 py-0.5">{tier.badge}</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-4 flex-wrap">
                    <span className="text-[34px] font-light tracking-[-0.03em] leading-none text-text-heading [font-family:var(--font-plex-mono)]">
                      {tier.price === null ? tPricing('custom') : `€${tier.price}`}
                    </span>
                    <span className="text-[13px] text-text-subtle">{tier.period}</span>
                  </div>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-[#868C91] min-h-[42px] text-pretty">{tier.blurb}</p>
                  <div className="grid gap-2.5 pt-4 mt-2 border-t border-white/7">
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
                  className="mt-7 text-center text-[13.5px] font-medium py-2.5 transition-colors"
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
          <div className="mt-6 flex flex-wrap gap-7 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-text-subtle">
            <span>{t('pricing.footnote1')}</span>
            <span>{t('pricing.footnote2')}</span>
            <span>{t('pricing.footnote3')}</span>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="border-b border-white/7 bg-[#0B0C0E] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-18 sm:py-20">
          <div className="flex flex-wrap gap-7 items-baseline justify-between">
            <h2 className="max-w-lg text-[24px] sm:text-[32px] font-normal tracking-[-0.025em] text-text-heading text-balance">{t('trust.title')}</h2>
            <p className="max-w-sm text-[15px] leading-relaxed text-[#7E8489]">{t('trust.subheadline')}</p>
          </div>
          <div className="mt-11 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-white/8 border border-white/8">
            {trust.map((cred) => (
              <div key={cred.title} className="bg-[#0B0C0E] p-6.5 pb-7 flex flex-col gap-2.5">
                <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-accent-gold">{cred.label}</span>
                <span className="text-[16px] font-medium tracking-[-0.012em] text-[#EDEFF0]">{cred.title}</span>
                <span className="text-[13.5px] leading-relaxed text-[#868C91] text-pretty">{cred.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="assessment" className="relative overflow-hidden border-b border-white/7">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(90%_90%_at_50%_50%,#000,transparent_75%)]" />
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-24 sm:py-26 flex flex-col items-center text-center">
          <div className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">{t('assessment.badge')}</div>
          <h2 className="mt-6 max-w-2xl text-[30px] sm:text-[50px] font-normal tracking-[-0.03em] leading-[1.1] text-text-heading text-balance">{t('assessment.title')}</h2>
          <p className="mt-5.5 max-w-xl text-[17px] leading-relaxed text-text-muted text-pretty">{t('assessment.subheadline')}</p>
          <div className="mt-9 flex flex-wrap gap-3.5 justify-center">
            <Link href="/assessment" className="text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-7 py-3.5 transition-colors">
              {t('assessment.ctaAssessment')}
            </Link>
            <Link href="/contact" className="text-[15px] text-text-primary border border-white/16 hover:border-white/40 px-7 py-3.5 transition-colors">
              {t('assessment.ctaWalkthrough')}
            </Link>
          </div>
          <div className="mt-7 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-text-subtle">{t('assessment.usedBy')}</div>
        </div>
      </section>

    </div>
  );
}
