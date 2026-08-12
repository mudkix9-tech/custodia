import React from 'react';
import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/legal/subprocessors' });
}

export default function SubprocessorsPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 [font-family:var(--font-plex-sans)]">
      <h1 className="text-4xl text-text-heading mb-4">Sub-processors</h1>
      <p className="text-sm text-text-muted mb-12">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="text-text-muted mb-10">
        <p>To support delivery of our Services, Custodia OS engages and uses data processors with access to certain Customer Data (each, a "Sub-processor").</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-3 px-4 border-b border-white/10 text-sm font-semibold text-text-heading bg-surface-panel-top/50">Sub-processor</th>
              <th className="py-3 px-4 border-b border-white/10 text-sm font-semibold text-text-heading bg-surface-panel-top/50">Purpose</th>
              <th className="py-3 px-4 border-b border-white/10 text-sm font-semibold text-text-heading bg-surface-panel-top/50">Location</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {[
              { name: 'Amazon Web Services (AWS)', purpose: 'Cloud Infrastructure & Hosting', location: 'Ireland (EU)' },
              { name: 'Paddle', purpose: 'Payment Processing', location: 'UK' },
              { name: 'Resend', purpose: 'Transactional Emails', location: 'USA (DPA + SCCs)' },
              { name: 'Sentry', purpose: 'Error Tracking', location: 'USA (DPA + SCCs)' },
            ].map((sub, i) => (
              <tr key={i} className="hover:bg-surface-panel-top/30 transition-colors">
                <td className="py-3 px-4 border-b border-white/8 text-text-heading font-medium">{sub.name}</td>
                <td className="py-3 px-4 border-b border-white/8 text-text-muted">{sub.purpose}</td>
                <td className="py-3 px-4 border-b border-white/8 text-text-muted">{sub.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
