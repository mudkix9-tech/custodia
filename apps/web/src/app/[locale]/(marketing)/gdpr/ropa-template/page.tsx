import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import RopaTemplateClient from './RopaTemplateClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/ropa-template' });
}

export default function RopaTemplatePage() {
  return <RopaTemplateClient />;
}
