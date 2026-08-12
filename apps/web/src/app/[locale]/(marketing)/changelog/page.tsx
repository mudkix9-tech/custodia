import React from 'react';
import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/changelog' });
}

export default function ChangelogPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 [font-family:var(--font-plex-sans)]">
      <h1 className="text-4xl text-text-heading mb-6 tracking-tight">Changelog</h1>
      <p className="text-lg text-text-muted mb-16">New updates, features, and improvements to Custodia OS.</p>

      <div className="space-y-16">
        <div className="border-l-2 border-accent-gold/30 pl-8 relative">
          <div className="absolute w-4 h-4 bg-accent-gold -left-[9px] top-1"></div>
          <h2 className="text-xl font-bold text-text-heading mb-2">Google Consent Mode v2 Support</h2>
          <div className="text-sm text-text-subtle mb-4">May 10, 2026</div>
          <div className="marketing-prose">
            <p>Our CMP now natively supports Google Consent Mode v2, allowing you to pass consent states to Google tags seamlessly. Read our documentation for setup instructions.</p>
          </div>
        </div>

        <div className="border-l-2 border-accent-gold/30 pl-8 relative">
          <div className="absolute w-4 h-4 bg-surface-panel-bottom border-2 border-white/8 -left-[9px] top-1"></div>
          <h2 className="text-xl font-bold text-text-heading mb-2">Automated Vendor Sync</h2>
          <div className="text-sm text-text-subtle mb-4">April 28, 2026</div>
          <div className="marketing-prose">
            <p>You can now connect your SSO provider or financial stack to automatically detect new vendors used by your team and add them to your assessment queue.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
