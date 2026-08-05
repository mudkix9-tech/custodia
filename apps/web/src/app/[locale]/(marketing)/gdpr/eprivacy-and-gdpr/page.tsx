import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import EprivacyAndGdprClient from './EprivacyAndGdprClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/eprivacy-and-gdpr' });
}

export default function EprivacyAndGdprPage() {
  return <EprivacyAndGdprClient />;
}
