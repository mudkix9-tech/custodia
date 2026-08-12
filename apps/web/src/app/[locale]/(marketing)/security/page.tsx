import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { buildMarketingMetadata } from '../seo';
import SecurityClient from './SecurityClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/security' });
}

export default async function SecurityPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SecurityClient />;
}
