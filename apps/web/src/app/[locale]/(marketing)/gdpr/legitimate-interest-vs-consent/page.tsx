import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import LegitimateInterestVsConsentClient from './LegitimateInterestVsConsentClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/legitimate-interest-vs-consent' });
}

export default function LegitimateInterestVsConsentPage() {
  return <LegitimateInterestVsConsentClient />;
}
