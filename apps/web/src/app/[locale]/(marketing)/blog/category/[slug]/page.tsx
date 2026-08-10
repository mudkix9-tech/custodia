import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../../seo';
import BlogCategoryClient from './BlogCategoryClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // A slug-derived path can't resolve to a static message key, so this route
  // passes its title and description explicitly.
  return buildMarketingMetadata({
    locale,
    path: `/blog/category/${slug}`,
    title: `${category} — GDPR Guides & Articles | Custodia`,
    description: `Every Custodia article filed under ${category}: practical GDPR guidance, regulatory updates and step-by-step guides for EU businesses and agencies.`,
  });
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <BlogCategoryClient params={resolvedParams} />;
}
