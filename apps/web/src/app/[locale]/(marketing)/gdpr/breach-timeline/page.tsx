import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import BreachTimelineClient from './BreachTimelineClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/breach-timeline' });
}

export default function BreachTimelinePage() {
  return <BreachTimelineClient />;
}
