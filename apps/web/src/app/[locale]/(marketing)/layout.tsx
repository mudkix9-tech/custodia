import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Lock, Server } from 'lucide-react';
import { MarketingHeader, Logo } from '@/components/layout/MarketingHeader';
import { FooterLocaleSwitcher } from '@/components/layout/FooterLocaleSwitcher';
import { plexSans, plexMono, spectral } from '../fonts';

import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.seo' });

  return {
    title: t('title'),
    description: t('desc'),
    keywords: ['GDPR', 'ROPA', 'Consent Management', 'ePrivacy', 'Data Protection', 'Privacy Policy', 'DSAR', 'Compliance OS', 'Agency Compliance'],
    openGraph: {
      title: t('title'),
      description: t('desc'),
      url: `https://trycustodia.com/${locale}`,
      siteName: 'Custodia',
      type: 'website',
      images: [{ url: 'https://trycustodia.com/api/og', width: 1200, height: 630, alt: 'Custodia — GDPR Compliance OS' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('desc'),
      images: ['https://trycustodia.com/api/og'],
    },
    alternates: {
      canonical: `https://trycustodia.com/${locale}`,
      languages: {
        'en': 'https://trycustodia.com/en',
        'de': 'https://trycustodia.com/de',
        'fr': 'https://trycustodia.com/fr',
      }
    },
  };
}

export default async function MarketingLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.layout' });

  // Update FOOTER_COLUMNS with translations inline to avoid global scope issues
  const FOOTER_COLUMNS = [
    {
      title: t('footer_columns.platform'),
      links: [
        { name: t('footer_links.features'), href: '/features' },
        { name: t('footer_links.pricing'), href: '/pricing' },
        { name: t('footer_links.security'), href: '/security' },
      ],
    },
    {
      title: t('footer_columns.company'),
      links: [
        { name: t('footer_links.about'), href: '/about' },
        { name: t('footer_links.enterprise'), href: '/enterprise' },
        { name: t('footer_links.for_agencies'), href: '/for-agencies' },
        { name: t('footer_links.contact'), href: '/contact' },
      ],
    },
    {
      title: t('footer_columns.resources'),
      links: [
        { name: t('footer_links.gdpr_guides'), href: '/gdpr' },
        { name: t('footer_links.changelog'), href: '/changelog' },
      ],
    },
    {
      title: t('footer_columns.legal'),
      links: [
        { name: t('footer_links.terms'), href: '/legal/terms' },
        { name: t('footer_links.privacy'), href: '/legal/privacy' },
        { name: t('footer_links.cookies'), href: '/legal/cookies' },
        { name: t('footer_links.dpa'), href: '/legal/dpa' },
      ],
    },
  ];

  return (
    <div
      className={`min-h-screen bg-surface-base text-text-primary font-sans selection:bg-accent-gold selection:text-surface-base overflow-x-hidden flex flex-col relative antialiased ${plexSans.variable} ${plexMono.variable} ${spectral.variable}`}
    >
      {/* Force body background to dark theme to prevent white overscroll bounce */}
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background-color: var(--color-surface-base) !important; color: var(--color-text-primary) !important; }
      `}} />

      {/* Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-surface-panel-top focus:text-text-primary focus:px-4 focus:py-2.5 focus:rounded-lg focus:border focus:border-accent-gold/30 focus:outline-none"
      >
        {t('skip_to_content')}
      </a>

      {/* Precision Grid Background */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />
      <div aria-hidden="true" className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-accent-transparent rounded-full blur-[120px] pointer-events-none" />
      <div aria-hidden="true" className="absolute top-[30%] right-1/4 w-[500px] h-[500px] bg-accent-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main id="main-content" role="main" className="flex-grow relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer role="contentinfo" className="[font-family:var(--font-plex-sans)] bg-surface-base border-t border-white/7 pt-16 pb-10 relative z-10 text-xs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
            <div className="col-span-2">
              <Logo />
              <p className="text-text-subtle text-xs leading-relaxed max-w-xs mt-4 mb-6">
                {t('footer_description')}
              </p>
              <div className="flex items-center gap-4 text-[#5C6266] [font-family:var(--font-plex-mono)] text-[10px]">
                <span className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-accent-gold" /> AWS Dublin</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-accent-gold" /> {t('secured')}</span>
              </div>
            </div>

            {/* Footer Links */}
            {FOOTER_COLUMNS.map((col, i) => (
              <div key={i}>
                <h4 className="[font-family:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.14em] text-text-subtle mb-4">{col.title}</h4>
                <ul className="space-y-2.5 text-text-muted">
                  {col.links.map((link, j) => (
                    <li key={j}><Link href={link.href} className="hover:text-text-primary transition-colors">{link.name}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/7 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#5C6266] [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.02em]">{t('rights', { year: new Date().getFullYear() })}</p>
            <FooterLocaleSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
