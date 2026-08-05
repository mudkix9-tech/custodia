import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import LawfulBasesClient from './LawfulBasesClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/lawful-bases' });
}

export default function LawfulBasesPage() {
  return <LawfulBasesClient />;
}
