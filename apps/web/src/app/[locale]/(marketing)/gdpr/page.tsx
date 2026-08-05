import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';
import GdprHubClient from './GdprHubClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr' });
}

export default function GdprHubPage() {
  return <GdprHubClient />;
}
