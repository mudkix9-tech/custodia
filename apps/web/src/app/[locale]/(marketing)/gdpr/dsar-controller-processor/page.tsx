import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import DsarControllerProcessorClient from './DsarControllerProcessorClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/dsar-controller-processor' });
}

export default function DsarControllerProcessorPage() {
  return <DsarControllerProcessorClient />;
}
