import { MetadataRoute } from 'next';
import { db } from '../db';
import { routing } from '../i18n/routing';
import { SITE_ORIGIN } from '../lib/siteUrl';
import { COMPETITOR_SLUGS } from './[locale]/(marketing)/compare/competitors';

// `routing.localePrefix` is 'as-needed': the default locale is served
// unprefixed (e.g. /pricing), while others are prefixed (e.g. /de/pricing).
// Sitemap URLs must match the actual served URLs or they won't align with
// each page's self-referencing canonical tag.
function buildUrl(locale: string, route: string) {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${SITE_ORIGIN}${prefix}${route}` || SITE_ORIGIN;
}

// Google wants every language version of a page annotated with the full set of
// alternates, including itself. Emitting them here as well as in each page's
// metadata is deliberate belt-and-braces: the sitemap is the annotation Google
// documents as most reliable.
function alternatesFor(route: string) {
  return {
    languages: {
      en: buildUrl('en', route),
      de: buildUrl('de', route),
      fr: buildUrl('fr', route),
      'x-default': buildUrl(routing.defaultLocale, route),
    },
  };
}

// Which routes belong in the sitemap is an editorial decision, not something to
// derive from the filesystem -- so the list is explicit. `npm run check:sitemap
// --workspace=apps/web` fails if a marketing page exists that is neither listed
// here nor in EXCLUDED_ROUTES, which is what let this file drift far enough to
// advertise four URLs that 404 (/legal/privacy-policy, /legal/terms-of-service,
// /legal/cookie-policy, /tools/cookie-checker) while omitting twelve of the
// fifteen GDPR guides.
const CORE_ROUTES = ['/features', '/pricing', '/for-agencies', '/enterprise', '/cookie-consent'];

const COMPANY_ROUTES = ['/about', '/security', '/contact', '/changelog'];

const GDPR_ROUTES = [
  '/gdpr',
  '/gdpr/breach-timeline',
  '/gdpr/compliance-guide-agencies',
  '/gdpr/consent-mode-v2',
  '/gdpr/data-breach-response',
  '/gdpr/data-portability',
  '/gdpr/dpia-guide',
  '/gdpr/dsar-controller-processor',
  '/gdpr/eprivacy-and-gdpr',
  '/gdpr/incident-response-plan',
  '/gdpr/lawful-bases',
  '/gdpr/legitimate-interest-vs-consent',
  '/gdpr/right-to-erasure',
  '/gdpr/ropa-template',
  '/gdpr/sccs-dpf-schrems',
  '/gdpr/vendor-audit',
];

const LEGAL_ROUTES = [
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/dpa',
  '/legal/subprocessors',
];

// The free gap assessment lives in the (public) route group rather than
// (marketing), which is why it was missing here -- it is still the primary
// lead-capture page and the highest-intent URL on the site.
const LEAD_ROUTES = ['/assessment'];

const BLOG_ROUTES = ['/blog'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = routing.locales;

  // `lastModified` is deliberately absent. Every entry previously claimed
  // `new Date()` -- "modified right now", on every rebuild, for every URL --
  // which is the pattern crawlers learn to discount, and it cost the site the
  // ability to signal genuine freshness on the guides that do get revised.
  // Re-add it per route once there is a real content-revision date to read.
  const entries: MetadataRoute.Sitemap = [];

  const push = (route: string, priority: number) => {
    for (const locale of locales) {
      entries.push({
        url: buildUrl(locale, route),
        priority,
        alternates: alternatesFor(route),
      });
    }
  };

  push('', 1.0);
  for (const route of CORE_ROUTES) push(route, 0.9);
  for (const route of GDPR_ROUTES) push(route, 0.8);
  for (const slug of COMPETITOR_SLUGS) push(`/compare/${slug}`, 0.8);
  for (const route of LEAD_ROUTES) push(route, 0.9);
  for (const route of COMPANY_ROUTES) push(route, 0.6);
  for (const route of BLOG_ROUTES) push(route, 0.6);
  for (const route of LEGAL_ROUTES) push(route, 0.3);

  // Vendor pages are the one genuinely dynamic set. A database blip should
  // degrade the sitemap to its static routes rather than fail the whole render
  // and leave the site with no sitemap at all.
  try {
    const vendors = await db.query.vendors.findMany({ columns: { slug: true } });
    for (const vendor of vendors) {
      if (vendor.slug) push(`/gdpr/vendors/${vendor.slug}`, 0.7);
    }
  } catch (error) {
    console.error('[sitemap] vendor lookup failed, emitting static routes only', error);
  }

  return entries;
}
