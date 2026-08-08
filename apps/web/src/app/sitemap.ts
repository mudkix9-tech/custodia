import { MetadataRoute } from 'next';
import { db } from '../db';
import { routing } from '../i18n/routing';
import { SITE_ORIGIN } from '../lib/siteUrl';

// `routing.localePrefix` is 'as-needed': the default locale is served
// unprefixed (e.g. /pricing), while others are prefixed (e.g. /de/pricing).
// Sitemap URLs must match the actual served URLs or they won't align with
// each page's self-referencing canonical tag.
function buildUrl(baseUrl: string, locale: string, route: string) {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${baseUrl}${prefix}${route}` || baseUrl;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_ORIGIN;
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
        url: buildUrl(baseUrl, locale, route),
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      });
    }

    // Add competitors
    for (const competitor of competitors) {
      entries.push({
        url: buildUrl(baseUrl, locale, `/compare/${competitor}`),
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    // Add GDPR guide pages
    for (const route of gdprRoutes) {
      entries.push({
        url: buildUrl(baseUrl, locale, route),
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    // Add vendors
    for (const vendor of vendors) {
      if (vendor.slug) {
        entries.push({
          url: buildUrl(baseUrl, locale, `/gdpr/vendors/${vendor.slug}`),
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  }
  
  return entries;
}
