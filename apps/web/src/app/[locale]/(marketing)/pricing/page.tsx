import { Metadata } from 'next';
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

export default function PricingPage() {
  return <PricingClient />;
}
