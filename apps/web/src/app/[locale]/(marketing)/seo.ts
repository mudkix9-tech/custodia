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

// Per-page title/description live in `marketing.seo.pages.<key>` and the key is
// derived from the route path, so the 32 static marketing pages need no change
// beyond the `path` they already pass. '/' is 'home'; everything else is the
// path with separators flattened ('/gdpr/dpia-guide' -> 'gdpr_dpia-guide').
//
// Flattening with '_' rather than nesting on '.' matters: next-intl treats '.'
// as a namespace separator, so a nested key would collide with the namespace
// lookup for any path prefix that is itself a page (e.g. '/gdpr').
export function metadataKeyFor(path: string) {
  if (path === '/') return 'home';
  return path.replace(/^\//, '').replace(/\//g, '_');
}

// Routes with a slug in the path (/compare/[competitor], /gdpr/vendors/[slug],
// /blog/[slug]) can't have a static message key, so they pass `title` and
// `description` explicitly. Everything else resolves from the message catalogue
// and falls back to the shared pair only if a page's key is missing -- which is
// the state the whole site was in until August 2026, when all 36 pages shared
// one title and one description and therefore targeted no keyword at all.
export async function buildMarketingMetadata({
  locale,
  path,
  title: titleOverride,
  description: descriptionOverride,
}: {
  locale: string;
  path: string;
  title?: string;
  description?: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'marketing.seo' });
  const key = metadataKeyFor(path);

  const titleKey = `pages.${key}.title`;
  const descKey = `pages.${key}.desc`;

  const title = titleOverride ?? (t.has(titleKey) ? t(titleKey) : t('title'));
  const description =
    descriptionOverride ?? (t.has(descKey) ? t(descKey) : t('desc'));

  const canonicalUrl = buildLocaleUrl(path, locale);

  // The OG route renders the headline it is given, so each page gets a distinct
  // social card instead of 36 pages sharing one image.
  const ogImage = `${SITE_ORIGIN}/api/og?title=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Custodia',
      type: 'website',
      locale,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
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
