import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { buildMarketingMetadata } from '../seo';
import PricingClient from './PricingClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/pricing' });
}

export default async function PricingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PricingClient />;
}
