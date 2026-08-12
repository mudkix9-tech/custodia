import React from 'react';
import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/legal/cookies' });
}

export default function CookiePolicyPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 [font-family:var(--font-plex-sans)]">
      <h1 className="text-4xl text-text-heading mb-4">Cookie Policy</h1>
      <p className="text-sm text-text-muted mb-12">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="marketing-prose">
        <h2>1. What are cookies?</h2>
        <p>Cookies are small text files placed on your device to store data that can be recalled by a web server in the domain that placed the cookie.</p>

        <h2>2. How we use cookies</h2>
        <p>We use essential cookies to keep you logged in and functional cookies to remember your preferences. As a privacy-focused company, we do not use third-party tracking cookies without your explicit consent.</p>
      </div>
    </div>
  );
}
