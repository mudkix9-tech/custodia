import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../../seo';
import BlogCategoryClient from './BlogCategoryClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  return buildMarketingMetadata({ locale, path: `/blog/category/${slug}` });
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <BlogCategoryClient params={resolvedParams} />;
}
