import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { IBM_Plex_Sans, IBM_Plex_Mono, Spectral } from 'next/font/google';
import { Lock, Server } from 'lucide-react';
import { MarketingHeader, Logo } from '@/components/layout/MarketingHeader';
import { FooterLocaleSwitcher } from '@/components/layout/FooterLocaleSwitcher';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
  display: 'swap',
});

const spectral = Spectral({
  subsets: ['latin'],
  variable: '--font-spectral',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  
  const translations: Record<string, { title: string, desc: string, keywords: string[] }> = {
    en: {
      title: 'Custodia — GDPR Compliance Operating System for EU Agencies',
      desc: 'The complete GDPR compliance platform built for EU marketing, digital, and design agencies. Replace consultants and spreadsheets.',
      keywords: ['GDPR', 'ROPA', 'Consent Management', 'ePrivacy', 'Data Protection', 'Privacy Policy', 'DSAR', 'Compliance OS', 'Agency Compliance']
    },
    de: {
      title: 'Custodia — GDPR-Compliance-Betriebssystem für EU-Agenturen',
      desc: 'Die komplette GDPR-Compliance-Plattform für EU-Marketing-, Digital- und Design-Agenturen. Ersetzen Sie Berater und Tabellen.',
      keywords: ['GDPR', 'DSGVO', 'ROPA', 'Einwilligungsmanagement', 'ePrivacy', 'Datenschutz', 'Datenschutzerklärung', 'DSAR', 'Compliance OS']
    },
    fr: {
      title: "Custodia — Système d'exploitation de conformité RGPD pour les agences de l'UE",
      desc: "La plateforme de conformité RGPD complète conçue pour les agences de marketing, de numérique et de design de l'UE.",
      keywords: ['GDPR', 'RGPD', 'ROPA', 'Gestion du consentement', 'ePrivacy', 'Protection des données', 'Politique de confidentialité', 'DSAR']
    }
  };

  const t = translations[locale] || translations.en;

  return {
    title: t.title,
    description: t.desc,
    keywords: t.keywords,
    openGraph: {
      title: t.title,
      description: t.desc,
      url: `https://custodia.io/${locale}`,
      siteName: 'Custodia',
      images: [
        {
          url: 'https://custodia.io/og/homepage.png',
          width: 1200,
          height: 630,
          alt: t.title,
        }
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.title,
      description: t.desc,
      images: ['https://custodia.io/og/homepage.png'],
    },
    alternates: {
      canonical: `https://custodia.io/${locale}`,
      languages: {
        'en': 'https://custodia.io/en',
        'de': 'https://custodia.io/de',
        'fr': 'https://custodia.io/fr',
      }
    },
  };
}

const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { name: 'Features', href: '/features' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Security', href: '/security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About Custodia', href: '/about' },
      { name: 'Enterprise', href: '/enterprise' },
      { name: 'For Agencies', href: '/for-agencies' },
      { name: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'GDPR guides', href: '/gdpr' },
      { name: 'Blog', href: '/blog' },
      { name: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Terms of service', href: '/legal/terms' },
      { name: 'Privacy notice', href: '/legal/privacy' },
      { name: 'Cookie policy', href: '/legal/cookies' },
      { name: 'Data processing agreement', href: '/legal/dpa' },
    ],
  },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`min-h-screen bg-[#08090A] text-[#E6E8EA] font-sans selection:bg-[#C9A227] selection:text-[#08090A] overflow-x-hidden flex flex-col relative antialiased ${plexSans.variable} ${plexMono.variable} ${spectral.variable}`}
    >

      {/* Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#1a1c1e] focus:text-[#E6E8EA] focus:px-4 focus:py-2.5 focus:rounded-lg focus:border focus:border-[#C9A227]/30 focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Precision Grid Background */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />
      <div aria-hidden="true" className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#C9A227]/5 rounded-full blur-[120px] pointer-events-none" />
      <div aria-hidden="true" className="absolute top-[30%] right-1/4 w-[500px] h-[500px] bg-[#C9A227]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main id="main-content" role="main" className="flex-grow relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer role="contentinfo" className="[font-family:var(--font-plex-sans)] bg-[#08090A] border-t border-white/7 pt-16 pb-10 relative z-10 text-xs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
            <div className="col-span-2">
              <Logo />
              <p className="text-[#6E747A] text-xs leading-relaxed max-w-xs mt-4 mb-6">
                The compliance automation platform designed for modern agencies.
              </p>
              <div className="flex items-center gap-4 text-[#5C6266] [font-family:var(--font-plex-mono)] text-[10px]">
                <span className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-[#C9A227]" /> AWS Dublin</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#C9A227]" /> SSL Secured</span>
              </div>
            </div>

            {/* Footer Links */}
            {FOOTER_COLUMNS.map((col, i) => (
              <div key={i}>
                <h4 className="[font-family:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.14em] text-[#6E747A] mb-4">{col.title}</h4>
                <ul className="space-y-2.5 text-[#9BA1A6]">
                  {col.links.map((link, j) => (
                    <li key={j}><Link href={link.href} className="hover:text-[#E6E8EA] transition-colors">{link.name}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/7 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#5C6266] [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.02em]">© {new Date().getFullYear()} Custodia. All rights reserved.</p>
            <FooterLocaleSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
