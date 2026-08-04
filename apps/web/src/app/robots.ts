import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/onboarding/', '/settings/', '/auth/'],
    },
    sitemap: 'https://trycustodia.com/sitemap.xml',
  };
}
