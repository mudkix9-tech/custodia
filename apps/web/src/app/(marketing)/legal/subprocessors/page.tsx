import React from 'react';

export default function SubprocessorsPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 font-sans">
      <h1 className="text-4xl font-serif text-ink-900 mb-4">Sub-processors</h1>
      <p className="text-sm text-ink-500 mb-12">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-sage max-w-none text-ink-600 mb-10">
        <p>To support delivery of our Services, Privaro OS engages and uses data processors with access to certain Customer Data (each, a "Sub-processor").</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-3 px-4 border-b border-ink-900/10 text-sm font-semibold text-ink-900 bg-bone-50/50">Sub-processor</th>
              <th className="py-3 px-4 border-b border-ink-900/10 text-sm font-semibold text-ink-900 bg-bone-50/50">Purpose</th>
              <th className="py-3 px-4 border-b border-ink-900/10 text-sm font-semibold text-ink-900 bg-bone-50/50">Location</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {[
              { name: 'Amazon Web Services (AWS)', purpose: 'Cloud Infrastructure & Hosting', location: 'Ireland (EU)' },
              { name: 'Paddle', purpose: 'Payment Processing', location: 'UK' },
              { name: 'Resend', purpose: 'Transactional Emails', location: 'USA (DPA + SCCs)' },
              { name: 'Sentry', purpose: 'Error Tracking', location: 'USA (DPA + SCCs)' },
            ].map((sub, i) => (
              <tr key={i} className="hover:bg-bone-100/30 transition-colors">
                <td className="py-3 px-4 border-b border-ink-900/5 text-ink-900 font-medium">{sub.name}</td>
                <td className="py-3 px-4 border-b border-ink-900/5 text-ink-600">{sub.purpose}</td>
                <td className="py-3 px-4 border-b border-ink-900/5 text-ink-500">{sub.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
