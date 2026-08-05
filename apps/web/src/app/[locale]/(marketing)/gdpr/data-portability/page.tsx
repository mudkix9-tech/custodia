import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import DataPortabilityClient from './DataPortabilityClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/data-portability' });
}

export default function DataPortabilityPage() {
  return <DataPortabilityClient />;
}
