import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';
import CookieConsentClient from './CookieConsentClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/cookie-consent' });
}

export default function CookieConsentPage() {
  return <CookieConsentClient />;
}
