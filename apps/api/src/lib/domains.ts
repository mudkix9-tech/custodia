// Shared domain normalisation. Previously inlined inside findMatchedVendor() in
// workers/vendors.ts; the tracker registry needs the identical rules so that a
// host matched against a tracker and against a vendor agree with each other.

// Registrable-suffix list is deliberately short. It covers the two-label public
// suffixes that show up in vendor/tracker hosts rather than attempting a full
// Public Suffix List, which would be a dependency for very little gain here.
const MULTI_LABEL_SUFFIXES = [
  'co.uk', 'org.uk', 'net.uk', 'ac.uk', 'gov.uk',
  'com.br', 'com.au', 'net.au', 'org.au',
  'co.jp', 'or.jp', 'ne.jp',
  'co.nz', 'co.za', 'co.in', 'com.mx', 'com.tr', 'com.cn', 'com.sg',
];

export function getRootDomain(domain: string): string {
  const host = domain.toLowerCase().replace(/^www\./, '');
  const parts = host.split('.');
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.includes(lastTwo) && parts.length > 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/** Strips scheme, credentials, www., port and path from a URL or bare host. */
export function normaliseHost(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.replace(/^[^@/]*@/, '');
  const slash = host.indexOf('/');
  if (slash !== -1) host = host.slice(0, slash);
  host = host.replace(/:\d+$/, '');
  return host.replace(/^www\./, '');
}

/** True when `host` is the same site as `base`, or a subdomain of it. */
export function isSameSite(host: string, base: string): boolean {
  const h = normaliseHost(host);
  const b = normaliseHost(base);
  if (h === b) return true;
  if (h.endsWith('.' + b)) return true;
  return getRootDomain(h) === getRootDomain(b);
}
