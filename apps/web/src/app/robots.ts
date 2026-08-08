import { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '../lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/onboarding/', '/settings/', '/auth/'],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
