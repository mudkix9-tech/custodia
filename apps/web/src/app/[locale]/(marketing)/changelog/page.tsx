import React from 'react';

export default function ChangelogPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 font-sans">
      <h1 className="text-4xl font-serif text-ink-900 mb-6 tracking-tight">Changelog</h1>
      <p className="text-lg text-ink-500 mb-16">New updates, features, and improvements to Custodia OS.</p>

      <div className="space-y-16">
        <div className="border-l-2 border-sage-500/20 pl-8 relative">
          <div className="absolute w-4 h-4 rounded-full bg-sage-500 -left-[9px] top-1"></div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">Google Consent Mode v2 Support</h2>
          <div className="text-sm text-ink-400 mb-4">May 10, 2026</div>
          <div className="prose prose-sage max-w-none text-ink-600 text-sm">
            <p>Our CMP now natively supports Google Consent Mode v2, allowing you to pass consent states to Google tags seamlessly. Read our documentation for setup instructions.</p>
          </div>
        </div>

        <div className="border-l-2 border-sage-500/20 pl-8 relative">
          <div className="absolute w-4 h-4 rounded-full bg-bone-200 border-2 border-bone-50 -left-[9px] top-1"></div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">Automated Vendor Sync</h2>
          <div className="text-sm text-ink-400 mb-4">April 28, 2026</div>
          <div className="prose prose-sage max-w-none text-ink-600 text-sm">
            <p>You can now connect your SSO provider or financial stack to automatically detect new vendors used by your team and add them to your assessment queue.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
