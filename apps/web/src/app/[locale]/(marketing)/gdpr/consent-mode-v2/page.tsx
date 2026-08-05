import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import ConsentModeV2Client from './ConsentModeV2Client';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/consent-mode-v2' });
}

export default function ConsentModeV2Page() {
  return <ConsentModeV2Client />;
}
