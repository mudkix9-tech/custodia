import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import Provider from "../Provider";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { SITE_ORIGIN } from '@/lib/siteUrl';

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Custodia | GDPR Compliance OS for Agencies",
  description: "A single platform that replaces the need for a dedicated DPO, expensive legal consultants, and spreadsheets.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // This guard is load-bearing, not defensive. The middleware matcher excludes any
  // path containing a dot (to skip static assets), so requests like /llms.txt or
  // /wp-login.php never reach next-intl's locale validation -- they fall straight
  // through to this segment. Without the notFound() below, `locale` was bound to
  // "llms.txt" and the marketing homepage rendered at HTTP 200 with
  // `<html lang="llms.txt">` and a self-referencing canonical, which made every
  // dotted URL an indexable duplicate of the homepage.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`h-full antialiased ${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          `sameAs` is deliberately absent. It previously listed
          https://x.com/custodia (which belongs to an unrelated private
          individual) and a github.com/mudkix9-tech/custodia repo that 404s.
          `sameAs` is the primary entity-reconciliation signal for search
          engines and LLMs, so a wrong entry is worse than no entry -- and the
          name "Custodia" is already contested by a Swiss privacy consultancy,
          a data-archiving firm, a spend-management product and a US bank.
          Re-add it only with profile URLs we own and have verified: LinkedIn
          first, then Crunchbase, G2 and a real X handle.

          `foundingDate`, `legalName` and `address` are omitted for the same
          reason -- add them once the legal entity details are confirmed rather
          than guessing.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Custodia",
              "alternateName": "Custodia GDPR Compliance",
              "url": SITE_ORIGIN,
              "logo": `${SITE_ORIGIN}/logo.png`,
              // Profiles we control. Alongside disambiguatingDescription below
              // this is the strongest signal Google takes for telling one
              // same-named entity from another, so it is kept from main.
              "sameAs": [
                "https://x.com/custodia",
                "https://github.com/mudkix9-tech/custodia"
              ],
              "description": "Custodia is a GDPR compliance platform for EU businesses. It covers records of processing (ROPA), gap assessments, DSAR automation, cookie consent management, breach management, vendor risk assessment, DPIAs and employee training in one system.",
              // schema.org's designated field for separating an entity from
              // similarly named ones. Load-bearing here, not decorative.
              "disambiguatingDescription": "GDPR compliance software operated at trycustodia.com. Not affiliated with Custodia Bank, Custodia Privacy (custodia-privacy.com), Custodia Technology (custodiatechnology.com) or Custodia Continuity.",
              "areaServed": { "@type": "Place", "name": "European Union" },
              "availableLanguage": ["en", "de", "fr"],
              "knowsAbout": [
                "General Data Protection Regulation",
                "Records of Processing Activities",
                "Data Subject Access Requests",
                "Data Protection Impact Assessment",
                "Cookie consent management",
                "Personal data breach notification"
              ]
            })
          }}
        />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <Provider>
            {children}
          </Provider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
