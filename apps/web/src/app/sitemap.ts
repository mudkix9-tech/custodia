import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://custodia.io';
  const locales = ['en', 'de', 'fr'];
  const routes = ['', '/assessment', '/pricing', '/about', '/contact'];
  
  const entries: MetadataRoute.Sitemap = [];
  
  for (const locale of locales) {
    for (const route of routes) {
      entries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      });
    }
  }
  
  return entries;
}
