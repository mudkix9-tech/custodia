import React from 'react';
import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/about' });
}

export default function AboutPage() {
  return (
    <div className="pt-24 pb-32 max-w-4xl mx-auto px-6 [font-family:var(--font-plex-sans)]">
      <h1 className="text-4xl text-text-heading mb-6 tracking-tight">About Custodia</h1>
      <p className="text-xl text-text-muted mb-10">We believe GDPR compliance shouldn't be a blocker for innovation.</p>

      <div className="marketing-prose">
        <p>Custodia was built out of the frustration of seeing digital and marketing agencies struggle with fragmented, expensive compliance tools and consultants. We decided to build a platform that speaks the language of modern agencies.</p>
        <p>Our mission is to turn compliance from a liability into a competitive advantage.</p>
      </div>
    </div>
  );
}
