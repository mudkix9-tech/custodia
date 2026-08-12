import React from 'react';
import { Metadata } from 'next';
import { FileDown } from 'lucide-react';
import { buildMarketingMetadata } from '../../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/legal/dpa' });
}

export default function DPAPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 [font-family:var(--font-plex-sans)] text-center">
      <h1 className="text-4xl text-text-heading mb-6">Data Processing Agreement</h1>
      <p className="text-lg text-text-muted mb-10">
        Our DPA outlines our commitment to processing data in compliance with the GDPR. It is incorporated into our Terms of Service.
      </p>

      <div className="bg-accent-gold/[0.06] border border-accent-gold/30 p-8 flex flex-col items-center max-w-md mx-auto">
        <FileDown className="w-12 h-12 text-accent-gold mb-4" />
        <h3 className="text-xl font-bold text-text-heading mb-2">Download DPA</h3>
        <p className="text-text-muted text-sm mb-6">PDF Format • Version 1.0 • Pre-signed by Custodia</p>
        <button className="bg-accent-gold hover:bg-accent-gold-hover text-surface-base font-semibold py-2.5 px-6 transition-all w-full shadow-panel-elevated">
          Download PDF
        </button>
      </div>
    </div>
  );
}
