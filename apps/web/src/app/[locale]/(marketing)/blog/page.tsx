import { Metadata } from 'next';
import { buildMarketingMetadata } from '../seo';
import BlogClient from './BlogClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/blog' });
}

export default function BlogPage() {
  return <BlogClient />;
}
