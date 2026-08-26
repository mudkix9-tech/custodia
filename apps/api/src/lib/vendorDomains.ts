/**
 * Registrable-domain comparison — audit P-7.
 *
 * The gatherer's `verifyDomainAuth` rejected a URL whose host was not the
 * vendor's own domain or one of thirteen hardcoded parents, and those thirteen
 * entries alone threw away five true positives (Oracle/NetSuite,
 * Adobe/Magento, Salesforce/Tableau, Atlassian/Loom, Moodle). The audit's
 * instruction: registrable-domain comparison via the public suffix list plus a
 * real ownership source, with **"parent-company domain, needs confirmation" as
 * an outcome instead of a reject**.
 *
 * The PSL is approximated the way `lib/domains.ts` already does it — a short
 * multi-label suffix list rather than a dependency. `lib/domains.ts` answers
 * "same site?"; this module answers "whose site is it?", which needs the extra
 * outcomes.
 */

// Reuse the house list rather than importing across workspaces — packages/db's
// copy is seed-side and apps/api's lib/domains.ts owns the API-side rules.
const MULTI_LABEL_SUFFIXES = [
  'co.uk', 'org.uk', 'net.uk', 'ac.uk', 'gov.uk',
  'com.br', 'com.au', 'net.au', 'org.au',
  'co.jp', 'or.jp', 'ne.jp',
  'co.nz', 'co.za', 'co.in', 'com.mx', 'com.tr', 'com.cn', 'com.sg',
];

function normaliseHost(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const slash = host.indexOf('/');
  if (slash !== -1) host = host.slice(0, slash);
  host = host.replace(/:\d+$/, '');
  return host.replace(/^www\./, '');
}

export function getRegistrableDomain(input: string): string {
  const host = normaliseHost(input);
  if (!host || !host.includes('.')) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  // A multi-label public suffix makes every label above it part of the
  // registrable domain: `service.gov.uk` is one domain, not `gov.uk`. This
  // holds at exactly three labels too — `sub.co.uk` IS the registrable
  // domain, which the previous `parts.length > 3` guard got wrong.
  if (MULTI_LABEL_SUFFIXES.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/** Trust platforms where compliance documents are legitimately hosted. */
const TRUST_PLATFORMS: readonly string[] = [
  'trust.docusign.com',
  // Deliberately bare registrable domains — subdomains covered by suffix match.
  'safebase.io',
  'securityscorecard.io',
  'nira.com',
  'confluence.com',
  'atlassian.net',
  'sharepoint.com',
  'zendesk.com',
  'intercom.help',
];

/**
 * Who owns this document URL relative to the vendor?
 *
 * - `same_site`      — same registrable domain or a subdomain of it. Accept.
 * - `trust_platform` — hosted on a trust-centre platform vendors actually use.
 *                      Accept; these are the vendor's own documents by proxy.
 * - `parent_domain`  — a different domain that appears on the vendor's known
 *                      parent map (NetSuite under Oracle, Tableau under
 *                      Salesforce…). An outcome, not a reject: keep the record,
 *                      mark it for confirmation.
 * - `unknown`        — neither. Reject as before.
 */
export function classifyDocumentDomain(
  documentUrl: string | null | undefined,
  vendorWebsite: string,
  parentMap: Readonly<Record<string, string>> = {},
): 'same_site' | 'trust_platform' | 'parent_domain' | 'unknown' {
  if (!documentUrl) return 'unknown';
  const docDomain = getRegistrableDomain(documentUrl);
  const vendorDomain = getRegistrableDomain(vendorWebsite);
  if (!docDomain) return 'unknown';
  if (docDomain === vendorDomain) return 'same_site';
  if (docDomain.endsWith('.' + vendorDomain)) return 'same_site';

  const docHost = normaliseHost(documentUrl);
  for (const platform of TRUST_PLATFORMS) {
    if (docHost === platform || docHost.endsWith('.' + platform)) return 'trust_platform';
  }

  const parent = parentMap[vendorDomain];
  if (parent) {
    const parentDomain = getRegistrableDomain(parent);
    if (docDomain === parentDomain || docDomain.endsWith('.' + parentDomain)) {
      return 'parent_domain';
    }
  }
  // The map is written vendor-domain -> parent, but the document host is often
  // the parent's own domain for a *subsidiary* target — a DPA on
  // `trust.netsuite.com` probed against the Oracle group's website. Check both
  // directions: is either side the parent of the other?
  for (const [child, parentOwner] of Object.entries(parentMap)) {
    const childDomain = getRegistrableDomain(child);
    const ownerDomain = getRegistrableDomain(parentOwner);
    const docIsChild = docDomain === childDomain;
    const docIsOwner = docDomain === ownerDomain;
    const vendorIsChild = vendorDomain === childDomain;
    const vendorIsOwner = vendorDomain === ownerDomain;
    if ((docIsChild && vendorIsOwner) || (docIsOwner && vendorIsChild)) {
      return 'parent_domain';
    }
  }
  return 'unknown';
}

/** The parent relationships the audit found throwing away true positives. */
export const VENDOR_PARENT_DOMAINS: Readonly<Record<string, string>> = {
  'netsuite.com': 'oracle.com',
  'magento.com': 'adobe.com',
  'tableau.com': 'salesforce.com',
  'loom.com': 'atlassian.com',
  'heroku.com': 'salesforce.com',
  'slack.com': 'salesforce.com',
  'github.com': 'microsoft.com',
  'linkedin.com': 'microsoft.com',
  'youtube.com': 'google.com',
  'doubleclick.net': 'google.com',
};
