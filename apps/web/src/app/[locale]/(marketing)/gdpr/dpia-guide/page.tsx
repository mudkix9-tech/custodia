import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import DpiaGuideClient from './DpiaGuideClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/dpia-guide' });
}

export default function DpiaGuidePage() {
  return <DpiaGuideClient />;
}
