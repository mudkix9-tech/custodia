import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
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

export default async function ForAgenciesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ForAgenciesClient />;
}
