import { Metadata } from 'next';
import { buildMarketingMetadata } from '../../seo';
import BlogPostClient from './BlogPostClient';

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  // A slug-derived path can't resolve to a static message key, so this route
  // passes its title and description explicitly. Once posts are backed by real
  // records rather than the hard-coded list in BlogClient, take the title and
  // excerpt from the post itself instead of reconstructing them from the slug.
  return buildMarketingMetadata({
    locale,
    path: `/blog/${slug}`,
    title: `${titleFromSlug(slug)} | Custodia`,
    description: `${titleFromSlug(slug)} — practical GDPR guidance for agencies and EU businesses from the Custodia compliance team.`,
  });
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  return <BlogPostClient params={params} />;
}
