import { Metadata } from 'next';
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

export default function EnterprisePage() {
  return <EnterpriseClient />;
}
