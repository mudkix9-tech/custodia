import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { SITE_ORIGIN } from '@/lib/siteUrl';

// `routing.localePrefix` is 'as-needed': the default locale is served
// unprefixed (e.g. /pricing), while others are prefixed (e.g. /de/pricing).
// Canonical/hreflang URLs must match that exactly, or Google sees the
// canonical as pointing to a different page than the one being served.
//
// `path` must be the locale-agnostic route path (e.g. '/', '/pricing',
// '/gdpr/dpia-guide') -- each page passes its own static, known path here
// rather than deriving it from the request, so this stays SSG-compatible
// (no headers()/cookies() dependency).
export function buildLocaleUrl(path: string, locale: string) {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  const normalizedPath = path === '/' ? '' : path;
  return `${SITE_ORIGIN}${prefix}${normalizedPath}` || SITE_ORIGIN;
}

// TODO: marketing.seo only has one shared title/desc pair today, reused
// across every marketing page. Per-page title/desc would be a real SEO
// improvement (duplicate titles/descriptions across 36 pages hurts
// ranking) but is a content-writing task, not a code change -- out of
// scope here. This keeps title/desc as-is while fixing canonical/hreflang
// per page.
export async function buildMarketingMetadata({
  locale,
  path,
}: {
  locale: string;
  path: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'marketing.seo' });
  const title = t('title');
  const description = t('desc');
  const canonicalUrl = buildLocaleUrl(path, locale);

  return {
    title,
    description,
    keywords: ['GDPR', 'ROPA', 'Consent Management', 'ePrivacy', 'Data Protection', 'Privacy Policy', 'DSAR', 'Compliance OS', 'Agency Compliance'],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Custodia',
      type: 'website',
      images: [{ url: `${SITE_ORIGIN}/api/og`, width: 1200, height: 630, alt: 'Custodia — GDPR Compliance OS' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_ORIGIN}/api/og`],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: buildLocaleUrl(path, 'en'),
        de: buildLocaleUrl(path, 'de'),
        fr: buildLocaleUrl(path, 'fr'),
        'x-default': buildLocaleUrl(path, routing.defaultLocale),
      },
    },
  };
}
