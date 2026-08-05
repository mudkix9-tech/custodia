import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';
import ForAgenciesClient from './ForAgenciesClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/for-agencies' });
}

export default function ForAgenciesPage() {
  return <ForAgenciesClient />;
}
