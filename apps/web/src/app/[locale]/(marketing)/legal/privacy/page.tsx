import React from 'react';
import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/legal/privacy' });
}

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 font-sans">
      <h1 className="text-4xl font-serif text-ink-900 mb-4">Privacy Policy</h1>
      <p className="text-sm text-ink-500 mb-12">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-sage max-w-none text-ink-600">
        <h2>1. Introduction</h2>
        <p>This Privacy Policy explains how Custodia OS ("we", "us", or "our") collects, uses, and discloses your information. As a privacy-focused company, we practice data minimization and strictly adhere to the GDPR.</p>

        <h2>2. Information We Collect</h2>
        <p>We collect information that you provide directly to us when using our marketing site, taking the assessment, or creating an account.</p>

        <h2>3. How We Use Your Information</h2>
        <p>We use the information we collect primarily to provide, maintain, and improve our services, and to communicate with you.</p>

        <h2>4. Your Rights</h2>
        <p>Under the GDPR, you have the right to access, rectify, port, and delete your data, as well as the right to restrict and object to certain processing of your data.</p>
      </div>
    </div>
  );
}
