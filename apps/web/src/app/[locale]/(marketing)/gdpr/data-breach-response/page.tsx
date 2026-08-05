import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import DataBreachResponseClient from './DataBreachResponseClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/data-breach-response' });
}

export default function DataBreachResponsePage() {
  return <DataBreachResponseClient />;
}
