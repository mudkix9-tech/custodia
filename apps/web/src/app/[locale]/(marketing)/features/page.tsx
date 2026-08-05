import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';
import FeaturesClient from './FeaturesClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/features' });
}

export default function FeaturesPage() {
  return <FeaturesClient />;
}
