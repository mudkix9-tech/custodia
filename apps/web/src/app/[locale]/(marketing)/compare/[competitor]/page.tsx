import React from 'react';
import { Link } from '@/i18n/routing';
import { Metadata } from 'next';
import { ArrowRight, Check, X } from 'lucide-react';
import { notFound } from 'next/navigation';
import { buildMarketingMetadata } from '../../seo';
import { COMPETITOR_NAMES, COMPETITOR_SLUGS } from '../competitors';

// Only the five competitors we have actually written a comparison for get a
// page; `dynamicParams = false` turns every other slug into a 404 instead of a
// thin auto-generated page.
export const dynamicParams = false;

export function generateStaticParams() {
  return COMPETITOR_SLUGS.map((competitor) => ({ competitor }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; competitor: string }>;
}): Promise<Metadata> {
  const { locale, competitor } = await params;
  const name = COMPETITOR_NAMES[competitor];

  // A slug-derived path can't resolve to a static message key, so this route
  // passes its title and description explicitly.
  return buildMarketingMetadata({
    locale,
    path: `/compare/${competitor}`,
    title: `Custodia vs ${name}: GDPR Platform Comparison`,
    description: `A feature-by-feature comparison of Custodia and ${name} for GDPR compliance: records of processing, DSAR automation, cookie consent, vendor tracking and pricing.`,
  });
}

export default async function CompetitorComparison({ params }: { params: Promise<{ competitor: string }> }) {
  const resolvedParams = await params;
  const competitorName = COMPETITOR_NAMES[resolvedParams.competitor];

  if (!competitorName) {
    notFound();
  }

  return (
    <div className="pt-24 pb-32 [font-family:var(--font-plex-sans)]">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-accent-gold/[0.06] border border-accent-gold/30 px-4 py-1.5 mb-8 text-sm font-medium text-accent-gold">
          Agency Compliance Platform Comparison
        </div>
        <h1 className="text-4xl md:text-6xl text-text-heading mb-6 tracking-tight">
          Custodia vs {competitorName}: <br/>Which GDPR tool is right for your agency?
        </h1>
        <p className="text-xl text-text-muted max-w-2xl mx-auto mb-10">
          A fair, feature-by-feature comparison between Custodia and {competitorName} to help you make the best choice for your agency's compliance needs.
        </p>
        <Link href="/assessment" className="inline-flex bg-accent-gold hover:bg-accent-gold-hover text-surface-base text-base font-semibold py-3.5 px-8 transition-all items-center justify-center gap-2 shadow-panel-elevated">
           Try Custodia Free <ArrowRight className="w-4 h-4"/>
        </Link>
      </section>

      {/* Feature Comparison Table */}
      <section className="max-w-5xl mx-auto px-6 mb-32">
        <h2 className="text-3xl text-text-heading mb-10 text-center tracking-tight">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-1/3 py-4 px-6 border-b border-white/10 text-sm font-semibold text-text-heading bg-surface-panel-top">Feature / Module</th>
                <th className="w-1/3 py-4 px-6 border-b border-accent-gold/20 text-sm font-semibold text-center text-accent-gold bg-accent-gold/[0.08] border-x border-accent-gold/30">Custodia (For Agencies)</th>
                <th className="w-1/3 py-4 px-6 border-b border-white/10 text-sm font-semibold text-center text-text-heading bg-surface-panel-top">{competitorName}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { name: 'Gap Assessment', custodia: true, comp: true },
                { name: 'ROPA Management', custodia: true, comp: true },
                { name: 'Vendor register (maintained profiles)', custodia: true, comp: false },
                { name: 'Dynamic Privacy Policies', custodia: true, comp: true },
                { name: 'Cookie Consent (CMP)', custodia: true, comp: true },
                { name: 'DSAR Automation', custodia: true, comp: false },
                { name: 'Client Trust Portals', custodia: true, comp: false },
                { name: 'Audit File Generator', custodia: true, comp: false },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-4 px-6 border-b border-white/8 text-text-muted font-medium">{row.name}</td>
                  <td className="py-4 px-6 border-b border-accent-gold/20 text-center text-accent-gold bg-accent-gold/[0.05] border-x border-accent-gold/20 font-medium">
                    {row.custodia ? <Check className="w-4 h-4 mx-auto text-accent-gold" /> : <X className="w-4 h-4 mx-auto text-text-subtle" />}
                  </td>
                  <td className="py-4 px-6 border-b border-white/8 text-center text-text-muted">
                    {row.comp ? <Check className="w-4 h-4 mx-auto text-text-subtle" /> : <X className="w-4 h-4 mx-auto text-text-subtle" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary / Who should choose what */}
      <section className="max-w-5xl mx-auto px-6 mb-32">
        <div className="grid md:grid-cols-2 gap-8">
           <div className="bg-surface-panel-top p-8 border border-white/8">
              <h3 className="text-xl font-bold text-text-heading mb-4">{competitorName} is better if...</h3>
              <p className="text-text-muted leading-relaxed mb-6">
                 You are a single small business looking for basic compliance, or an enterprise looking for heavily customizable workflows and you have the budget to pay per module.
              </p>
           </div>
           <div className="bg-accent-gold/[0.06] border border-accent-gold/30 p-8">
              <h3 className="text-xl font-bold text-text-heading mb-4">Custodia is better if...</h3>
              <p className="text-text-muted leading-relaxed mb-6">
                 You are an agency that acts as both a controller and processor, needs to manage compliance across multiple clients, and wants an all-in-one OS without hidden module fees.
              </p>
           </div>
        </div>
      </section>

    </div>
  );
}
