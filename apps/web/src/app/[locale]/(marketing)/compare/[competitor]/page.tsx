import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';

export default async function CompetitorComparison({ params }: { params: Promise<{ competitor: string }> }) {
  const resolvedParams = await params;
  const competitorName = resolvedParams.competitor.charAt(0).toUpperCase() + resolvedParams.competitor.slice(1);

  return (
    <div className="pt-24 pb-32">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700">
          Agency Compliance Platform Comparison
        </div>
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight">
          Custodia vs {competitorName}: <br/>Which GDPR tool is right for your agency?
        </h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto mb-10">
          A fair, feature-by-feature comparison between Custodia and {competitorName} to help you make the best choice for your agency's compliance needs.
        </p>
        <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
           Try Custodia Free <ArrowRight className="w-4 h-4"/>
        </Link>
      </section>

      {/* Feature Comparison Table */}
      <section className="max-w-5xl mx-auto px-6 mb-32">
        <h2 className="text-3xl font-serif text-ink-900 mb-10 text-center tracking-tight">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-1/3 py-4 px-6 border-b border-ink-900/10 text-sm font-semibold text-ink-900 bg-bone-50/50 rounded-tl-2xl">Feature / Module</th>
                <th className="w-1/3 py-4 px-6 border-b border-sage-500/10 text-sm font-semibold text-center text-sage-700 bg-sage-50/50 border-x border-sage-500/20 rounded-t-xl">Custodia (For Agencies)</th>
                <th className="w-1/3 py-4 px-6 border-b border-ink-900/10 text-sm font-semibold text-center text-ink-900 bg-bone-50/50 rounded-tr-2xl">{competitorName}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { name: 'Gap Assessment', custodia: true, comp: true },
                { name: 'ROPA Management', custodia: true, comp: true },
                { name: 'Vendor Tracker (1,000+ DB)', custodia: true, comp: false },
                { name: 'Dynamic Privacy Policies', custodia: true, comp: true },
                { name: 'Cookie Consent (CMP)', custodia: true, comp: true },
                { name: 'DSAR Automation', custodia: true, comp: false },
                { name: 'Client Trust Portals', custodia: true, comp: false },
                { name: 'Audit File Generator', custodia: true, comp: false },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-bone-100/30 transition-colors">
                  <td className="py-4 px-6 border-b border-ink-900/5 text-ink-600 font-medium">{row.name}</td>
                  <td className="py-4 px-6 border-b border-sage-500/10 text-center text-sage-700 bg-sage-50/30 border-x border-sage-500/10 font-medium">
                    {row.custodia ? <Check className="w-4 h-4 mx-auto text-sage-600" /> : <X className="w-4 h-4 mx-auto text-ink-300" />}
                  </td>
                  <td className="py-4 px-6 border-b border-ink-900/5 text-center text-ink-500">
                    {row.comp ? <Check className="w-4 h-4 mx-auto text-ink-400" /> : <X className="w-4 h-4 mx-auto text-ink-300" />}
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
           <div className="bg-white p-8 rounded-2xl hairline shadow-sm">
              <h3 className="text-xl font-bold text-ink-900 mb-4">{competitorName} is better if...</h3>
              <p className="text-ink-500 leading-relaxed mb-6">
                 You are a single small business looking for basic compliance, or an enterprise looking for heavily customizable workflows and you have the budget to pay per module.
              </p>
           </div>
           <div className="bg-sage-50 border border-sage-500/20 p-8 rounded-2xl">
              <h3 className="text-xl font-bold text-ink-900 mb-4">Custodia is better if...</h3>
              <p className="text-ink-600 leading-relaxed mb-6">
                 You are an agency that acts as both a controller and processor, needs to manage compliance across multiple clients, and wants an all-in-one OS without hidden module fees.
              </p>
           </div>
        </div>
      </section>

    </div>
  );
}

// Generate static params for the 5 specified competitors
export async function generateStaticParams() {
  return [
    { competitor: 'iubenda' },
    { competitor: 'onetrust' },
    { competitor: 'cookieyes' },
    { competitor: 'usercentrics' },
    { competitor: 'cookiebot' },
  ];
}
