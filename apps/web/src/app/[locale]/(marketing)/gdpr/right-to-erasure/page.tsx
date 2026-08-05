import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import RightToErasureClient from './RightToErasureClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/right-to-erasure' });
}

export default function RightToErasurePage() {
  return <RightToErasureClient />;
}
