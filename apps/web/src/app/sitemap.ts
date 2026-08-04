import { MetadataRoute } from 'next';
import { db } from '../db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://trycustodia.com';
  const locales = ['en', 'de', 'fr'];
  const staticRoutes = [
    '', 
    '/features', 
    '/pricing', 
    '/for-agencies', 
    '/cookie-consent', 
    '/security', 
    '/about', 
    '/contact', 
    '/tools/cookie-checker', 
    '/changelog',
    '/legal/privacy-policy',
    '/legal/terms-of-service',
    '/legal/cookie-policy',
    '/legal/dpa'
  ];
  
  const competitors = ['iubenda', 'onetrust', 'cookieyes', 'usercentrics', 'cookiebot'];
  const gdprRoutes = [
    '/gdpr/consent-mode-v2',
    '/gdpr/compliance-guide-agencies',
    '/gdpr/ropa-template',
  ];
  
  const vendors = await db.query.vendors.findMany({
    columns: { slug: true }
  });
  
  const entries: MetadataRoute.Sitemap = [];
  
  for (const locale of locales) {
    // Add static routes
    for (const route of staticRoutes) {
      entries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      });
    }

    // Add competitors
    for (const competitor of competitors) {
      entries.push({
        url: `${baseUrl}/${locale}/compare/${competitor}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    // Add GDPR guide pages
    for (const route of gdprRoutes) {
      entries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    // Add vendors
    for (const vendor of vendors) {
      if (vendor.slug) {
        entries.push({
          url: `${baseUrl}/${locale}/gdpr/vendors/${vendor.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  }
  
  return entries;
}
