import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import BlogPostClient from './BlogPostClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  return buildMarketingMetadata({ locale, path: `/blog/${slug}` });
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  return <BlogPostClient params={params} />;
}
