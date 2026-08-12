import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { buildMarketingMetadata } from '../seo';
import EnterpriseClient from './EnterpriseClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/enterprise' });
}

export default async function EnterprisePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EnterpriseClient />;
}
