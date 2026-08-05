import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import VendorAuditClient from './VendorAuditClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/gdpr/vendor-audit' });
}

export default function VendorAuditPage() {
  return <VendorAuditClient />;
}
