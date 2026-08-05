import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import ComplianceGuideAgenciesClient from './ComplianceGuideAgenciesClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/compliance-guide-agencies' });
}

export default function ComplianceGuideAgenciesPage() {
  return <ComplianceGuideAgenciesClient />;
}
