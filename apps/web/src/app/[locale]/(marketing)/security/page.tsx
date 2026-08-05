import { Metadata } from 'next';
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

export default function SecurityPage() {
  return <SecurityClient />;
}
