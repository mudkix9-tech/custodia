import { db } from '../db.js';
import { trackerRegistry } from 'db';
import { eq } from 'drizzle-orm';
import { getRootDomain, normaliseHost } from './domains.js';

export type TrackerEntry = {
  trackerKey: string;
  provider: string;
  matchDomains: string[];
  cookiePrefixes: string[];
  requiredCategory: string;
  consentModeSupported: boolean;
  consentSignalParams: string[];
  vendorSlug: string | null;
};

/**
 * When two entries match equally well, the stricter category wins. Over-classifying
 * a shared cookie such as MUID as marketing is the conservative error; under-
 * classifying it would silently exempt it from consent.
 */
const CATEGORY_STRICTNESS: Record<string, number> = {
  marketing: 4,
  analytics: 3,
  functional: 2,
  necessary: 1,
};

let cache: { entries: TrackerEntry[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export function invalidateTrackerRegistryCache() {
  cache = null;
}

export async function loadTrackerRegistry(dbInstance: any = db): Promise<TrackerEntry[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.entries;

  const rows = await dbInstance
    .select()
    .from(trackerRegistry)
    .where(eq(trackerRegistry.isActive, true));

  const entries: TrackerEntry[] = rows.map((r: any) => ({
    trackerKey: r.trackerKey,
    provider: r.provider,
    matchDomains: (r.matchDomains ?? []) as string[],
    cookiePrefixes: (r.cookiePrefixes ?? []) as string[],
    requiredCategory: r.requiredCategory,
    consentModeSupported: r.consentModeSupported ?? false,
    consentSignalParams: (r.consentSignalParams ?? []) as string[],
    vendorSlug: r.vendorSlug ?? null,
  }));

  cache = { entries, loadedAt: Date.now() };
  return entries;
}

function betterMatch(
  candidate: { entry: TrackerEntry; specificity: number },
  incumbent: { entry: TrackerEntry; specificity: number } | null
): boolean {
  if (!incumbent) return true;
  if (candidate.specificity !== incumbent.specificity) {
    return candidate.specificity > incumbent.specificity;
  }
  const candidateStrictness = CATEGORY_STRICTNESS[candidate.entry.requiredCategory] ?? 0;
  const incumbentStrictness = CATEGORY_STRICTNESS[incumbent.entry.requiredCategory] ?? 0;
  if (candidateStrictness !== incumbentStrictness) {
    return candidateStrictness > incumbentStrictness;
  }
  // Final tiebreak on key so repeated scans classify identically.
  return candidate.entry.trackerKey < incumbent.entry.trackerKey;
}

/**
 * Resolves an observed host (optionally with a request path) to a tracker.
 *
 * `matchDomains` entries may be a bare host, a host suffix, or a host with a path
 * prefix such as `facebook.com/tr`. The longest pattern that matches wins, so
 * `connect.facebook.net` is preferred over the broader `facebook.net`.
 */
export function matchTrackerByDomain(
  host: string,
  registry: TrackerEntry[],
  path = ''
): TrackerEntry | null {
  const target = normaliseHost(host);
  if (!target) return null;
  const targetRoot = getRootDomain(target);
  const normalisedPath = path.startsWith('/') ? path : path ? '/' + path : '';

  let best: { entry: TrackerEntry; specificity: number } | null = null;

  for (const entry of registry) {
    for (const raw of entry.matchDomains) {
      const pattern = String(raw).toLowerCase().trim();
      if (!pattern) continue;

      const slash = pattern.indexOf('/');
      const patternHost = normaliseHost(slash === -1 ? pattern : pattern.slice(0, slash));
      const patternPath = slash === -1 ? '' : pattern.slice(slash);
      if (!patternHost) continue;

      const hostMatches =
        target === patternHost ||
        target.endsWith('.' + patternHost) ||
        (patternHost.split('.').length <= 2 && targetRoot === patternHost);
      if (!hostMatches) continue;

      // A pattern that names a path only matches when the request is under it.
      if (patternPath && !normalisedPath.startsWith(patternPath)) continue;

      const candidate = { entry, specificity: pattern.length };
      if (betterMatch(candidate, best)) best = candidate;
    }
  }

  return best?.entry ?? null;
}

/** Resolves a cookie name to a tracker by longest matching prefix. */
export function matchTrackerByCookieName(
  cookieName: string,
  registry: TrackerEntry[]
): TrackerEntry | null {
  const name = cookieName.trim();
  if (!name) return null;

  let best: { entry: TrackerEntry; specificity: number } | null = null;

  for (const entry of registry) {
    for (const raw of entry.cookiePrefixes) {
      const prefix = String(raw);
      if (!prefix || !name.startsWith(prefix)) continue;
      const candidate = { entry, specificity: prefix.length };
      if (betterMatch(candidate, best)) best = candidate;
    }
  }

  return best?.entry ?? null;
}

export type CookieClassification = {
  category: string;
  provider: string;
  trackerKey: string | null;
  confidence: number;
};

/**
 * Registry-backed replacement for the 11-entry KNOWN_COOKIES map that used to live
 * in the cookie scanner.
 */
export function classifyCookieName(
  cookieName: string,
  registry: TrackerEntry[]
): CookieClassification {
  const match = matchTrackerByCookieName(cookieName, registry);
  if (!match) {
    return { category: 'uncategorized', provider: 'Unknown', trackerKey: null, confidence: 0 };
  }
  return {
    category: match.requiredCategory,
    provider: match.provider,
    trackerKey: match.trackerKey,
    confidence: 0.9,
  };
}
