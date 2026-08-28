/**
 * Candidate URL enumeration — Sprint 5, VD-1.
 *
 * The model was doing one job this pipeline genuinely needs (guess where a
 * vendor publishes its DPA) and several it should never have had (assert the
 * Chapter V fields). Guessing a URL over a known domain is a path-permutation
 * problem: deterministic, enumerable, and checkable by a probe afterwards.
 * Everything else the model asserted is now a registry lookup, a probe result,
 * or an explicit gap.
 *
 * Pure and network-free on purpose. It lives beside `vendorProbe.ts` rather
 * than inside `vendorIntelligence.ts` so the standalone fixtures can exercise
 * it without `DATABASE_URL` and without a fetch — the same reason
 * `utils/cursor.ts` is split from `pagination.ts`.
 *
 * Three sources of candidates, in the order the service should spend requests:
 *
 *   1. `enumerateCandidateUrls` — the permutation over the vendor's own domain
 *      plus the third-party trust portals, ordered most-likely-first.
 *   2. `indexPageUrls` — the pages worth fetching purely to read links off.
 *   3. `extractLinkCandidates` — link extraction from those pages, which is
 *      what actually replaces the model for the long tail. A vendor who
 *      publishes a DPA anywhere reachable links to it from a legal index page;
 *      a vendor who does not is a genuine gap, and a gap is an acceptable
 *      output.
 */
import { classifyDocumentDomain, getRegistrableDomain } from './vendorDomains.js';
import type { ProbeDocType } from './vendorProbe.js';

export type CandidateOrigin = 'path' | 'trust_centre' | 'link';

export interface CandidateUrl {
  url: string;
  type: ProbeDocType;
  /** Which of the three generators produced it — carried into the reject log. */
  origin: CandidateOrigin;
}

/**
 * Probe order across document types. The DPA carries three times the weight of
 * the privacy policy in `FIELD_WEIGHTS`, and the per-type search stops at the
 * first verified hit, so spending the host's patience on it first is the
 * cheapest way to a useful record.
 */
export const DOC_TYPE_ORDER: readonly ProbeDocType[] = ['dpa', 'subprocessors', 'privacy'];

/**
 * Where vendors actually put these documents, most common first. Ordering is
 * the whole budget control: a host that answers `/legal/dpa` is never asked
 * the other eight.
 */
const DOC_PATHS: Readonly<Record<ProbeDocType, readonly string[]>> = {
  dpa: [
    '/legal/dpa',
    '/legal/data-processing-agreement',
    '/legal/data-processing-addendum',
    '/dpa',
    '/terms/dpa',
    '/privacy/dpa',
    '/legal/dpa.pdf',
    '/legal/data-processing-agreement.pdf',
    '/policies/dpa',
  ],
  subprocessors: [
    '/legal/subprocessors',
    '/legal/sub-processors',
    '/subprocessors',
    '/sub-processors',
    '/legal/dpa/subprocessors',
    '/privacy/subprocessors',
    '/policies/subprocessors',
  ],
  privacy: [
    '/privacy',
    '/legal/privacy',
    '/privacy-policy',
    '/legal/privacy-policy',
    '/policies/privacy',
    '/privacy/policy',
  ],
};

/** Pages fetched only to read their links — never probed as documents. */
export const INDEX_PATHS: readonly string[] = ['/legal', '/privacy', '/terms'];

/**
 * Tier 3 portals. Deliberately *only* the third-party ones: `trust.stripe.com`
 * is on Stripe's own registrable domain, which makes it Tier 2 evidence about
 * Stripe, not a portal rendering a badge about Stripe.
 */
export const TRUST_CENTRE_DOMAINS: readonly string[] = [
  'safebase.io',
  'vanta.com',
  'drata.com',
  'conveyor.com',
];

const TRUST_CENTRE_PORTALS: readonly string[] = [
  'https://trust.safebase.io',
  'https://trust.vanta.com',
  'https://trust.drata.com',
  'https://app.conveyor.com',
];

/**
 * Does this URL's evidence come from a compliance portal rather than the
 * vendor's own site? Drives the `trust_centre` provenance tier, whose ceiling
 * sits below `fieldDecision`'s accept bar because a badge is HTML: what a
 * SafeBase page proves is that SafeBase renders a badge.
 */
export function isTrustCentreUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return TRUST_CENTRE_DOMAINS.includes(getRegistrableDomain(url));
}

/** Portal slugs worth trying: the folded vendor name and the domain's own label. */
function portalSlugs(name: string, domain: string): string[] {
  const slugs = new Set<string>();
  const fromName = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (fromName) slugs.add(fromName);
  const label = domain.split('.')[0];
  if (label) slugs.add(label);
  return Array.from(slugs).slice(0, 2);
}

/** The vendor's registrable domain, or null when the website is unusable. */
function vendorDomain(website: string): string | null {
  const domain = getRegistrableDomain(website || '');
  if (!domain || !domain.includes('.')) return null;
  return domain;
}

/**
 * The deterministic replacement for the model's URL guessing. Returns an
 * ordered, de-duplicated candidate list; a URL appears once, under the first
 * document type that claims it, because `evaluateContentSignals` is what
 * decides whether it really is that document.
 */
export function enumerateCandidateUrls(
  target: { name: string; website?: string | null },
): CandidateUrl[] {
  const domain = vendorDomain(target.website || '');
  if (!domain) return [];
  const base = `https://${domain}`;

  const out: CandidateUrl[] = [];
  const seen = new Set<string>();
  const push = (url: string, type: ProbeDocType, origin: CandidateOrigin) => {
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url, type, origin });
  };

  for (const type of DOC_TYPE_ORDER) {
    for (const path of DOC_PATHS[type]) push(`${base}${path}`, type, 'path');
  }

  // The vendor's own trust centre. Same registrable domain, so `http_probe`
  // and not `trust_centre`; probed as a DPA because that is the field it most
  // often fronts and the per-type stop keeps it to one request.
  push(`https://trust.${domain}/`, 'dpa', 'path');

  for (const portal of TRUST_CENTRE_PORTALS) {
    for (const slug of portalSlugs(target.name, domain)) {
      push(`${portal}/${slug}`, 'dpa', 'trust_centre');
    }
  }

  return out;
}

/** The index pages to fetch for link extraction, for one vendor. */
export function indexPageUrls(website: string | null | undefined): string[] {
  const domain = vendorDomain(website || '');
  if (!domain) return [];
  return INDEX_PATHS.map((path) => `https://${domain}${path}`);
}

/**
 * Anchor-text and href token families, in en/de/fr.
 *
 * Three languages from the first line rather than English-only-then-widen:
 * that is VD-5 in miniature, and the module ships in three languages. A German
 * legal index links *Auftragsverarbeitungsvertrag*, and an English-only matcher
 * reports "no DPA published" with total confidence.
 *
 * Order matters — sub-processor pages are checked before DPAs, because a link
 * reading "DPA — Sub-processors" is a sub-processor list.
 */
const LINK_TOKENS: ReadonlyArray<{ type: ProbeDocType; re: RegExp }> = [
  {
    type: 'subprocessors',
    re: /sub[\s\-_]?process(or|ing)|unterauftragsverarbeiter|unter[\s\-_]?auftragnehmer|sous[\s\-_]traitants?[\s\-_]ult[ée]rieurs?|third[\s\-_]part(y|ies)[\s\-_]list/i,
  },
  {
    type: 'dpa',
    re: /data[\s\-_]?process(ing|or)[\s\-_]?(agreement|addendum)|data[\s\-_]?protection[\s\-_]?(agreement|addendum)|auftragsverarbeitung(svertrag)?|\bavv\b|(accord|contrat)[\s\-_]de[\s\-_]sous[\s\-_]traitance|\bdpa\b/i,
  },
  {
    type: 'privacy',
    re: /privacy[\s\-_](policy|statement|notice)|datenschutz(erkl[äa]rung|hinweise)?|politique[\s\-_]de[\s\-_]confidentialit[ée]|confidentialite/i,
  },
];

const ANCHOR_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi;

/** Strip tags and collapse whitespace out of anchor inner HTML. */
function anchorText(inner: string): string {
  return inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * How many links one index page may contribute. A legal index with two hundred
 * links must not turn into two hundred probes against one host.
 */
export const MAX_LINK_CANDIDATES = 12;

/**
 * Pull document links off a fetched index page.
 *
 * This is a link extraction, not an inference: the URL comes from the vendor's
 * own markup and the classification comes from the vendor's own anchor text.
 * Only same-registrable-domain links and known trust portals survive — an
 * outbound link to a law firm's template is not evidence about this vendor.
 */
export function extractLinkCandidates(
  html: string,
  pageUrl: string,
  vendorWebsite: string,
): CandidateUrl[] {
  const out: CandidateUrl[] = [];
  const seen = new Set<string>();

  ANCHOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_RE.exec(html)) !== null) {
    if (out.length >= MAX_LINK_CANDIDATES) break;
    const href = (match[1] ?? '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;

    let resolved: string;
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      url.hash = '';
      resolved = url.toString();
    } catch {
      continue;
    }

    const ownership = classifyDocumentDomain(resolved, vendorWebsite);
    if (ownership === 'unknown' && !isTrustCentreUrl(resolved)) continue;

    let decoded = resolved;
    try {
      decoded = decodeURIComponent(resolved);
    } catch {
      // A malformed escape sequence is not a reason to drop the link; match the
      // raw form instead.
    }
    const haystack = `${anchorText(match[2] ?? '')} ${decoded}`;
    const family = LINK_TOKENS.find((entry) => entry.re.test(haystack));
    if (!family) continue;

    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: resolved, type: family.type, origin: 'link' });
  }

  return out;
}
