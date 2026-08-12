import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
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

export default async function FeaturesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FeaturesClient />;
}
