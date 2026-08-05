import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import IncidentResponsePlanClient from './IncidentResponsePlanClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/incident-response-plan' });
}

export default function IncidentResponsePlanPage() {
  return <IncidentResponsePlanClient />;
}
