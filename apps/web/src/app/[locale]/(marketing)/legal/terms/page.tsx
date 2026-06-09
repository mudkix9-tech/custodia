import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 font-sans">
      <h1 className="text-4xl font-serif text-ink-900 mb-4">Terms of Service</h1>
      <p className="text-sm text-ink-500 mb-12">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-sage max-w-none text-ink-600">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using Privaro OS, you agree to be bound by these Terms of Service.</p>

        <h2>2. Description of Service</h2>
        <p>Privaro OS provides a GDPR compliance platform tailored for EU agencies.</p>

        <h2>3. Subscription and Billing</h2>
        <p>Certain aspects of the Service are provided for a fee. You agree to pay all fees associated with the subscription plan you select.</p>
      </div>
    </div>
  );
}
