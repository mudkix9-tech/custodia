"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

// --- Illustrative dashboard mockup data ---

const NAV_ITEMS = [
  { label: 'Overview', count: '' },
  { label: 'Records of processing', count: '214' },
  { label: 'Gap assessment', count: '3' },
  { label: 'Vendors & transfers', count: '48' },
  { label: 'Data subject requests', count: '7' },
  { label: 'Consent', count: '' },
  { label: 'Breach register', count: '1' },
  { label: 'Advisor', count: '' },
];

const BAR_VALUES = [38, 46, 41, 55, 62, 58, 66, 61, 72, 69, 75, 80, 74, 82, 88, 84, 91, 86, 94, 90, 97, 93, 88, 95, 99, 92];

const DASHBOARD_ROWS = [
  { name: 'Art. 30 register — Nordlicht GmbH', meta: '12 processes', status: 'COMPLETE', color: '#7FA88B', due: '—' },
  { name: 'DSAR · erasure request #1184', meta: 'day 6 of 30', status: 'IN PROGRESS', color: '#C9A227', due: '14 Aug' },
  { name: 'Transfer assessment — Segment (US)', meta: 'SCC module 2', status: 'REVIEW DUE', color: '#C48A3F', due: '02 Aug' },
  { name: 'Cookie banner — 4 client domains', meta: 'TCF v2.2', status: 'LIVE', color: '#7FA88B', due: '—' },
  { name: 'Breach log — vendor incident 0042', meta: '72h clock closed', status: 'REPORTED', color: '#8A9095', due: '—' },
];

// --- Pain points ---

const PAINS = [
  {
    index: '01',
    tag: 'Fragmentation',
    title: "Your compliance programme is eleven files and one person's memory.",
    body: 'Processing records in a spreadsheet, DPAs in a shared drive, assessments in a consultant’s Word template, decisions in email. Nothing reconciles, and no one can prove what was true on a given date.',
    stat: 'Average agency: 4 tools, 0 audit trail',
  },
  {
    index: '02',
    tag: 'Exposure',
    title: 'Enforcement no longer waits for a data breach.',
    body: 'Supervisory authorities across the EU open inquiries from complaints, cookie sweeps and vendor chains. Fines reach 4% of global turnover, and "we intended to document it" has never been a defence.',
    stat: '€1.2bn+ in GDPR fines issued in 2025',
  },
  {
    index: '03',
    tag: 'Cost of manual work',
    title: 'DSARs and ROPA upkeep consume billable weeks.',
    body: 'Every request means chasing systems, exporting data, redacting third parties and hitting a statutory clock by hand. Every new vendor means re-reading the register nobody has updated since onboarding.',
    stat: '9–14 hours per data subject request',
  },
];

// --- Modules ---

const MODULES = [
  { index: '01', title: 'Records of processing', body: 'A living Art. 30 register with lawful basis, retention, recipients and transfer routes per activity. Versioned, so you can show what the record said last March.', ref: 'Art. 30' },
  { index: '02', title: 'Gap assessment', body: '38 controls mapped to the Regulation, scored and prioritised by risk and effort. Re-run quarterly to evidence continuous improvement.', ref: 'Art. 24 · 32' },
  { index: '03', title: 'Vendor intelligence', body: 'A maintained profile for every common processor: sub-processors, hosting region, transfer mechanism, DPA link and known enforcement history.', ref: 'Art. 28 · 44' },
  { index: '04', title: 'DSAR automation', body: 'Intake form, identity verification, system-by-system collection tasks, redaction workflow and a statutory clock that escalates before day 30.', ref: 'Art. 15–22' },
  { index: '05', title: 'Cookie consent (CMP)', body: 'IAB TCF v2.2 certified banner, per-domain configuration, Google Consent Mode signals and a tamper-evident consent proof log.', ref: 'ePrivacy' },
  { index: '06', title: 'Breach management', body: 'Severity assessment against EDPB criteria, the 72-hour notification clock, notifiable-authority routing and a defensible incident record.', ref: 'Art. 33 · 34' },
  { index: '07', title: 'Audit readiness dashboard', body: 'One score per entity, one evidence pack per request. Everything a supervisory authority or an enterprise procurement team asks for, exported in a click.', ref: 'Art. 5(2)' },
  { index: '08', title: 'AI compliance advisor', body: 'Retrieval-grounded answers over the actual legal corpus, scoped to the jurisdiction you are working in and cited down to the paragraph.', ref: 'RAG · cited' },
];

// --- AI advisor ---

type JurisdictionCode = 'IE' | 'FR' | 'DE' | 'NL' | 'ES';

const JURISDICTIONS: JurisdictionCode[] = ['IE', 'FR', 'DE', 'NL', 'ES'];

const ADVISOR_CONTENT: Record<JurisdictionCode, { q: string; a: string; cites: { ref: string; text: string }[] }> = {
  IE: {
    q: 'A client wants to run a prize draw using their newsletter list. Is consent still valid?',
    a: 'No. Consent obtained for newsletter delivery does not extend to a prize draw — the new purpose is incompatible with the one disclosed at collection, and the DPC treats re-purposing of marketing lists as a separate processing operation requiring fresh, specific consent.',
    cites: [
      { ref: 'Art. 6(4)', text: 'Compatibility test for further processing' },
      { ref: 'EDPB 05/2020', text: 'Consent must be specific to each purpose (§ 56)' },
      { ref: 'DPC IE', text: 'Guidance on direct marketing, 2023 — § 4.2' },
    ],
  },
  FR: {
    q: 'A client wants to run a prize draw using their newsletter list. Is consent still valid?',
    a: "No. The CNIL's position is stricter than the baseline: prospection for a distinct operation requires its own opt-in, and the collection notice must name the promotional purpose. Re-use of an existing list exposes the client to a sanction under Article 82 of the Loi Informatique et Libertés.",
    cites: [
      { ref: 'Art. 6(4)', text: 'Compatibility test for further processing' },
      { ref: 'CNIL', text: 'Référentiel prospection commerciale, § 2.1' },
      { ref: 'LIL Art. 82', text: 'National consent requirement for tracking' },
    ],
  },
  DE: {
    q: 'A client wants to run a prize draw using their newsletter list. Is consent still valid?',
    a: 'No, and there is an additional national dimension: the coupling prohibition under § 7 UWG plus BGH case law on Kopplungsverbot mean the draw cannot be conditioned on marketing consent. A separate, documented opt-in is required and must be logged with its timestamp.',
    cites: [
      { ref: 'Art. 7(4)', text: 'Freely given consent — no bundling' },
      { ref: '§ 7 UWG', text: 'Unzumutbare Belästigung — German marketing rules' },
      { ref: 'DSK', text: 'Orientierungshilfe Direktwerbung, 2022' },
    ],
  },
  NL: {
    q: 'A client wants to run a prize draw using their newsletter list. Is consent still valid?',
    a: 'No. The Autoriteit Persoonsgegevens requires purpose-specific consent, and the Telecommunicatiewet soft opt-in for existing customers does not cover promotional draws. Document the new consent and retain the withdrawal mechanism in the same record.',
    cites: [
      { ref: 'Art. 6(4)', text: 'Compatibility test for further processing' },
      { ref: 'Tw Art. 11.7', text: 'Dutch electronic marketing consent' },
      { ref: 'AP', text: 'Normuitleg toestemming, 2021' },
    ],
  },
  ES: {
    q: 'A client wants to run a prize draw using their newsletter list. Is consent still valid?',
    a: 'No. The AEPD requires consent granular to each purpose, and LSSI Article 21 governs the electronic communication itself. Prize-draw terms must also disclose the retention period for entrant data separately from the newsletter retention rule.',
    cites: [
      { ref: 'Art. 6(4)', text: 'Compatibility test for further processing' },
      { ref: 'LSSI Art. 21', text: 'Spanish commercial communications' },
      { ref: 'AEPD', text: 'Guía consentimiento, 2023 — § 3' },
    ],
  },
};

const CORPUS = [
  { source: 'Regulation (EU) 2016/679 — full text', detail: '99 articles · 173 recitals' },
  { source: 'EDPB guidelines, opinions & recommendations', detail: '142 documents' },
  { source: 'CJEU judgments on data protection', detail: 'Schrems II → 2026' },
  { source: 'National DPA guidance — IE, FR, DE, NL, ES', detail: 'DPC · CNIL · DSK · AP · AEPD' },
  { source: 'Published enforcement decisions & sanctions', detail: '2,400+ decisions' },
];

// --- Pricing (aligned to the real Paddle tiers in settings/billing) ---

const annualPrice = (monthly: number) => Math.round(monthly * 0.8);

const TIERS = [
  {
    name: 'Free', badge: '', bg: '#08090A',
    price: 0, period: 'forever',
    blurb: 'The gap assessment, in full. No trial clock.',
    features: ['38-control gap assessment', 'Scored readiness report', 'Prioritised remediation list', '1 entity'],
    cta: 'Start assessment', href: '/assessment', highlight: false,
  },
  {
    name: 'Starter', badge: '', bg: '#08090A',
    price: 39, period: '/mo', blurb: 'Essential compliance for a single business.',
    features: ['1 organisation, unlimited users', 'Standard DPAs on file', 'Records of processing (ROPA)', 'Gap assessment reruns'],
    cta: 'Choose Starter', href: '/assessment', highlight: false,
  },
  {
    name: 'Professional', badge: 'MOST CHOSEN', bg: '#0D0F11', highlight: true,
    price: 89, period: '/mo', blurb: 'For agencies running compliance for a client book.',
    features: ['Everything in Starter', '100K cookie consent views', 'DPIA workflows', 'DSAR automation'],
    cta: 'Choose Professional', href: '/assessment',
  },
  {
    name: 'Agency', badge: '', bg: '#08090A',
    price: 179, period: '/mo', blurb: 'Multi-tenant management for compliance agencies.',
    features: ['Everything in Professional', '1M cookie consent views', 'White-labelled trust portals', 'Cross-org vendor intelligence'],
    cta: 'Choose Agency', href: '/assessment', highlight: false,
  },
  {
    name: 'Enterprise', badge: '', bg: '#08090A',
    price: null, period: 'annual contract', blurb: 'For groups with regulatory scrutiny and procurement.',
    features: ['Unlimited entities', 'Dedicated EU tenancy', 'Custom DPA & security review', 'SCIM provisioning', 'Named compliance engineer'],
    cta: 'Talk to us', href: '/contact', highlight: false,
  },
];

// --- Trust ---

const TRUST = [
  { label: 'Residency', title: 'EU data residency', body: 'All data stored and processed on AWS Dublin (eu-west-1). No transfer outside the EEA, including for support access.' },
  { label: 'Access', title: 'SSO & granular roles', body: 'SAML and OIDC single sign-on, SCIM provisioning, per-entity roles so client staff see only their own register.' },
  { label: 'Accountability', title: 'Immutable audit logging', body: 'Every change to a record, assessment or consent is written to an append-only log with actor, timestamp and prior value.' },
  { label: 'Infrastructure', title: 'Enterprise-grade operations', body: 'Encrypted at rest and in transit, daily tested restores, ISO 27001-aligned controls, annual penetration testing.' },
  { label: 'Billing', title: 'VAT handled automatically', body: 'Reverse charge and local rates applied per member state, with compliant invoices and your VAT number validated at signup.' },
];

export default function MarketingSite() {
  const t = useTranslations('marketing');
  const [annual, setAnnual] = useState(true);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionCode>('IE');
  const advisor = ADVISOR_CONTENT[jurisdiction];

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
                <span className="text-text-muted">custodia / nordlicht-agency.eu</span>
                <span>&mdash;</span>
                <span>Audit readiness</span>
                <span className="flex-1" />
                <span className="text-accent-gold">EU-WEST &middot; FRA1</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-[360px]">
                <div className="hidden md:block border-r border-white/7 py-4.5">
                  {NAV_ITEMS.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-4.5 py-2.5 text-[12.5px] text-[#8A9095]">
                      <span>{item.label}</span>
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] text-[#5C6266]">{item.count}</span>
                    </div>
                  ))}
                </div>
                <div className="relative p-5 sm:p-6 overflow-hidden">
                  <div className="flex items-end justify-between gap-5 flex-wrap">
                    <div>
                      <div className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-text-subtle">Readiness score</div>
                      <div className="flex items-baseline gap-2.5 mt-2">
                        <span className="text-[44px] leading-none font-light tracking-[-0.03em] text-text-heading">82</span>
                        <span className="text-[15px] text-text-subtle">/ 100</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px] text-[#7FA88B]">&#9650; 14 this quarter</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] text-accent-gold border border-[#C9A227]/35 px-2.5 py-1.5">Export evidence pack</span>
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] text-[#8A9095] border border-white/12 px-2.5 py-1.5">Art. 30 register</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end gap-1 h-[74px]">
                    {BAR_VALUES.map((v, i) => (
                      <div key={i} className="flex-1" style={{ height: `${v}%`, background: i > 21 ? '#C9A227' : 'rgba(255,255,255,0.13)' }} />
                    ))}
                  </div>

                  <div className="mt-7 border-t border-white/7">
                    {DASHBOARD_ROWS.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1.6fr_1fr_0.9fr_0.7fr] gap-3 items-center py-3 border-b border-white/5.5 text-[12.5px] text-text-muted">
                        <span className="text-[#DDE0E2] truncate">{row.name}</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px]">{row.meta}</span>
                        <span className="[font-family:var(--font-plex-mono)] text-[11px]" style={{ color: row.color }}>{row.status}</span>
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
            {PAINS.map((pain, i) => (
              <div key={i} className="bg-[#0B0C0E] p-7 pb-8.5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.12em] text-text-subtle">
                  <span>{pain.index}</span>
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
            {MODULES.map((mod, i) => (
              <div key={i} className="bg-surface-base hover:bg-surface-panel-top transition-colors p-6.5 pb-7.5 flex flex-col gap-3 min-h-[210px]">
                <div className="flex items-center justify-between">
                  <span className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.12em] text-[#5C6266]">{mod.index}</span>
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
              {CORPUS.map((c, i) => (
                <div key={i} className="bg-[#0B0C0E] grid grid-cols-[1fr_auto] gap-4 items-center px-5 py-3.5">
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
              <span>Advisor &middot; jurisdiction {jurisdiction}</span>
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
                  {advisor.cites.map((cite, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr] gap-2.5 items-baseline [font-family:var(--font-plex-mono)] text-[11px] text-[#8A9095]">
                      <span className="text-accent-gold">{cite.ref}</span>
                      <span>{cite.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Attach to ROPA entry', 'Open remediation task', 'Export as client memo'].map((a, i) => (
                  <span key={i} className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.08em] text-[#8A9095] border border-white/12 px-2.5 py-1.5">{a}</span>
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

          <div className="mt-11.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-white/8 border border-white/8">
            {TIERS.map((tier, i) => (
              <div
                key={i}
                className="p-6.5 pb-7.5 flex flex-col justify-between min-h-[400px]"
                style={{
                  background: tier.highlight ? '#1F241D0d' : tier.bg,
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
                      {tier.price === null ? 'Custom' : `€${tier.price === 0 ? 0 : (annual ? annualPrice(tier.price) : tier.price)}`}
                    </span>
                    <span className="text-[13px] text-text-subtle">{tier.price === null || tier.price === 0 ? tier.period : (annual ? '/mo, billed yearly' : tier.period)}</span>
                  </div>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-[#868C91] min-h-[42px] text-pretty">{tier.blurb}</p>
                  <div className="grid gap-2.5 pt-4 mt-2 border-t border-white/7">
                    {tier.features.map((feat, idx) => (
                      <div key={idx} className="grid grid-cols-[12px_1fr] gap-2.5 items-start text-[13.5px] leading-normal text-text-muted">
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
            {TRUST.map((cred, i) => (
              <div key={i} className="bg-[#0B0C0E] p-6.5 pb-7 flex flex-col gap-2.5">
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
