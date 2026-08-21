/**
 * C34–C36. Discovery — the register telling you what it is missing, from evidence
 * the product already holds.
 *
 * Three sources, and the reason all three are worth having is that each of them
 * is a *different kind* of blind spot:
 *
 *   - **The vendor register (C34)** knows about processing somebody has already
 *     paid for. "You have 43 vendors and 12 are referenced by no activity" is not
 *     a guess; it is an accounting identity, and every one of those twelve is
 *     either an unrecorded disclosure or a vendor that should not be there.
 *   - **The tracker scanner (C35)** knows about processing on the website that
 *     nobody signed a contract for. Marketing adds a pixel; the register never
 *     hears about it.
 *   - **The SaaS connectors (C36)** know about processing that was never procured
 *     at all — the shadow IT a DPO finds out about during a breach.
 *
 * This module builds the *signals*. It does not query and it does not write: the
 * worker fetches, this shapes, the router upserts. Pure for the usual reason — a
 * suggestion that names the wrong vendor reads exactly like one that names the
 * right one.
 */

export type DiscoverySource = 'vendor_register' | 'tracker_scan' | 'saas_connector';

export type DiscoverySignal = {
  source: DiscoverySource;
  /** Natural key inside the source. The unique constraint's second half. */
  sourceKey: string;
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';

  suggestedName: string;
  suggestedPurpose: string | null;
  suggestedLawfulBasis: string | null;
  suggestedDataCategories: string[];
  suggestedDataSubjects: string[];
  suggestedRecipients: { name: string; role: string | null; vendorId?: string | null }[];
  suggestedTransfers: { destinationCountry: string; destinationEntity?: string | null; transferMechanism?: string | null }[];

  /** What the rule saw, rendered on the card. A suggestion with no evidence is a guess. */
  evidence: Record<string, unknown>;

  vendorId?: string | null;
  consentDomainId?: string | null;
  integrationId?: string | null;
};

// ---------------------------------------------------------------------------
// C34 — the vendor register
// ---------------------------------------------------------------------------

export type UnreferencedVendor = {
  vendorId: string;
  organizationVendorId: string;
  name: string;
  category?: string | null;
  description?: string | null;
  headquartersCountry?: string | null;
  dataProcessingLocations?: unknown;
  typicalDataCategories?: unknown;
  transferMechanisms?: unknown;
  dpaStatus?: string | null;
  dataCategoriesShared?: unknown;
};

/**
 * A linked vendor that no activity names as a recipient.
 *
 * Confidence is `high` where the organisation has recorded what it shares with the
 * vendor and `medium` where it has not, because the second case has a legitimate
 * innocent explanation — a vendor linked for evaluation and never used. Marking
 * both `high` would be the fastest way to teach someone to dismiss the queue.
 */
export function vendorSignal(vendor: UnreferencedVendor): DiscoverySignal {
  const shared = asStrings(vendor.dataCategoriesShared);
  const typical = asStrings(vendor.typicalDataCategories);
  const categories = shared.length > 0 ? shared : typical;
  const country = (vendor.headquartersCountry ?? '').toUpperCase();

  return {
    source: 'vendor_register',
    sourceKey: vendor.vendorId,
    title: `${vendor.name} is in your vendor register but in no processing activity`,
    description: vendor.dpaStatus === 'signed'
      // A signed DPA is an admission that personal data is processed. A register
      // that does not mention the activity is missing an Art. 30(1)(d) entry, and
      // saying so plainly is more useful than a neutral "consider adding".
      ? `You have a signed data processing agreement with ${vendor.name}, which is an agreement about processing personal data. No activity in the register names them as a recipient.`
      : `${vendor.name} is linked to your organisation but no processing activity names them as a recipient.`,
    confidence: shared.length > 0 || vendor.dpaStatus === 'signed' ? 'high' : 'medium',

    suggestedName: vendor.category ? `${vendor.category} — ${vendor.name}` : `Processing via ${vendor.name}`,
    suggestedPurpose: vendor.description ? `Use of ${vendor.name}: ${vendor.description}` : null,
    suggestedLawfulBasis: null,
    suggestedDataCategories: categories.slice(0, 12),
    suggestedDataSubjects: [],
    suggestedRecipients: [{ name: vendor.name, role: 'processor', vendorId: vendor.vendorId }],
    suggestedTransfers: buildVendorTransfers(vendor, country),

    evidence: {
      dpaStatus: vendor.dpaStatus ?? null,
      headquartersCountry: country || null,
      dataProcessingLocations: asStrings(vendor.dataProcessingLocations),
      sharedCategories: shared,
      organizationVendorId: vendor.organizationVendorId,
    },
    vendorId: vendor.vendorId,
  };
}

/**
 * The transfer draft that comes with a vendor.
 *
 * D17's lesson is in here: adequacy is not decided in this module. The draft names
 * the destination and leaves the mechanism as whatever the vendor record itself
 * claims, so the reviewer picks from the enum-backed picker against the served
 * adequacy list rather than inheriting a guess.
 */
function buildVendorTransfers(vendor: UnreferencedVendor, country: string): DiscoverySignal['suggestedTransfers'] {
  const locations = asStrings(vendor.dataProcessingLocations)
    .map((l) => l.trim().toUpperCase())
    .filter((l) => /^[A-Z]{2}$/.test(l));
  const destinations = [...new Set([country, ...locations].filter(Boolean))];
  const mechanisms = asStrings(vendor.transferMechanisms);
  return destinations.map((destinationCountry) => ({
    destinationCountry,
    destinationEntity: vendor.name,
    transferMechanism: mechanisms[0] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// C35 — the tracker scanner
// ---------------------------------------------------------------------------

export type UnexplainedTracker = {
  domainId: string;
  domain: string;
  trackerKey?: string | null;
  provider?: string | null;
  observedHost: string;
  requiredCategory?: string | null;
  purpose?: string | null;
  matchedVendorId?: string | null;
  /** Whether the request carried cookies or identifier-shaped parameters. */
  carriedIdentifiers?: boolean | null;
  /** Whether it fired before any consent was given. */
  firedPreConsent?: boolean | null;
  requestCount?: number | null;
};

/**
 * A tracker observed on a domain that no activity accounts for.
 *
 * The lawful-basis suggestion is the one opinionated thing here, and it is
 * opinionated in the direction the law actually points: a marketing or analytics
 * tracker that sets or reads identifiers on terminal equipment needs consent under
 * Art. 5(3) of the ePrivacy Directive *before* Art. 6 is even reached, whatever
 * the controller would prefer to rely on. Suggesting legitimate interests for a
 * marketing pixel would be a product teaching its customers to get this wrong.
 */
export function trackerSignal(tracker: UnexplainedTracker): DiscoverySignal {
  const name = tracker.provider ?? tracker.trackerKey ?? tracker.observedHost;
  const category = tracker.requiredCategory ?? 'unknown';
  const consentRequired = category === 'marketing' || category === 'analytics' || category === 'personalization';

  return {
    source: 'tracker_scan',
    // Host rather than tracker key: an unrecognised host is exactly the case worth
    // surfacing, and it has no key.
    sourceKey: `${tracker.domain}|${tracker.observedHost}`.slice(0, 255),
    title: `${name} is active on ${tracker.domain} and no activity accounts for it`,
    description: tracker.firedPreConsent
      ? `${name} was observed on ${tracker.domain} before any consent was given, and no processing activity in the register describes it.`
      : `${name} was observed on ${tracker.domain}, and no processing activity in the register describes it.`,
    confidence: tracker.carriedIdentifiers ? 'high' : 'medium',

    suggestedName: `Website ${category === 'marketing' ? 'advertising' : category === 'analytics' ? 'analytics' : 'tracking'} — ${name}`,
    suggestedPurpose: tracker.purpose
      ? `${tracker.purpose} Operated on ${tracker.domain} through ${name}.`
      : `Use of ${name} on ${tracker.domain}.`,
    suggestedLawfulBasis: consentRequired ? 'consent' : null,
    suggestedDataCategories: [
      'Online identifiers',
      'IP address',
      ...(tracker.carriedIdentifiers ? ['Device and browser information'] : []),
      ...(category === 'marketing' ? ['Browsing behaviour'] : []),
    ],
    suggestedDataSubjects: ['Website visitors'],
    suggestedRecipients: [{ name, role: 'processor', vendorId: tracker.matchedVendorId ?? null }],
    suggestedTransfers: [],

    evidence: {
      domain: tracker.domain,
      observedHost: tracker.observedHost,
      requiredCategory: category,
      carriedIdentifiers: !!tracker.carriedIdentifiers,
      firedPreConsent: !!tracker.firedPreConsent,
      requestCount: tracker.requestCount ?? null,
    },
    consentDomainId: tracker.domainId,
    vendorId: tracker.matchedVendorId ?? null,
  };
}

// ---------------------------------------------------------------------------
// C36 — SaaS connectors
// ---------------------------------------------------------------------------

/**
 * What a connected provider implies about processing, before anything is fetched.
 *
 * The connectors in this product are OAuth links to systems the organisation
 * already runs, so the *presence* of the connection is itself the finding: an
 * organisation with Google Workspace connected is processing employee data in
 * Google Workspace, whatever its register says. That is a stronger signal than
 * anything an app-inventory API would add, and it needs no extra scope.
 *
 * Kept as data rather than code, in the same spirit as REGULATOR_TEMPLATES: adding
 * Okta is a table entry.
 */
export const CONNECTOR_PROFILES: Record<string, {
  label: string;
  activityName: string;
  purpose: string;
  dataCategories: string[];
  dataSubjects: string[];
  lawfulBasis: string | null;
  defaultCountry: string | null;
}> = {
  google: {
    label: 'Google Workspace',
    activityName: 'Business communications and collaboration — Google Workspace',
    purpose: 'Email, calendar, file storage and collaboration for staff, using Google Workspace.',
    dataCategories: ['Name', 'Work email address', 'Email content', 'Calendar entries', 'Documents and files'],
    dataSubjects: ['Employees', 'Customers', 'Supplier contacts'],
    lawfulBasis: 'legitimate_interest',
    defaultCountry: 'US',
  },
  microsoft: {
    label: 'Microsoft 365',
    activityName: 'Business communications and collaboration — Microsoft 365',
    purpose: 'Email, calendar, file storage and collaboration for staff, using Microsoft 365.',
    dataCategories: ['Name', 'Work email address', 'Email content', 'Calendar entries', 'Documents and files'],
    dataSubjects: ['Employees', 'Customers', 'Supplier contacts'],
    lawfulBasis: 'legitimate_interest',
    defaultCountry: 'US',
  },
  okta: {
    label: 'Okta',
    activityName: 'Identity and access management — Okta',
    purpose: 'Authenticating staff and controlling access to internal systems.',
    dataCategories: ['Name', 'Work email address', 'Authentication logs', 'Device information'],
    dataSubjects: ['Employees'],
    lawfulBasis: 'legitimate_interest',
    defaultCountry: 'US',
  },
  slack: {
    label: 'Slack',
    activityName: 'Internal messaging — Slack',
    purpose: 'Internal messaging and collaboration between staff.',
    dataCategories: ['Name', 'Work email address', 'Message content', 'Shared files'],
    dataSubjects: ['Employees'],
    lawfulBasis: 'legitimate_interest',
    defaultCountry: 'US',
  },
  hubspot: {
    label: 'HubSpot',
    activityName: 'Customer relationship management — HubSpot',
    purpose: 'Managing relationships with customers and prospects, including marketing communications.',
    dataCategories: ['Name', 'Email address', 'Telephone number', 'Company', 'Communication history', 'Marketing preferences'],
    dataSubjects: ['Customers', 'Prospective customers'],
    // Deliberately null. A CRM holds both contract-basis customer records and
    // consent-basis marketing contacts, and suggesting one for both is how a
    // register ends up asserting the wrong basis over half its contacts.
    lawfulBasis: null,
    defaultCountry: 'US',
  },
  salesforce: {
    label: 'Salesforce',
    activityName: 'Customer relationship management — Salesforce',
    purpose: 'Managing relationships with customers and prospects.',
    dataCategories: ['Name', 'Email address', 'Telephone number', 'Company', 'Communication history'],
    dataSubjects: ['Customers', 'Prospective customers'],
    lawfulBasis: null,
    defaultCountry: 'US',
  },
  stripe: {
    label: 'Stripe',
    activityName: 'Payment processing — Stripe',
    purpose: 'Taking and reconciling payments from customers.',
    dataCategories: ['Name', 'Email address', 'Billing address', 'Payment card details (tokenised)', 'Transaction history'],
    dataSubjects: ['Customers'],
    lawfulBasis: 'contract',
    defaultCountry: 'US',
  },
  aws: {
    label: 'Amazon Web Services',
    activityName: 'Application hosting — Amazon Web Services',
    purpose: 'Hosting the systems in which personal data is stored and processed.',
    dataCategories: ['All categories processed by the hosted systems'],
    dataSubjects: ['Customers', 'Employees'],
    lawfulBasis: 'legitimate_interest',
    defaultCountry: 'US',
  },
};

export function connectorSignal(integration: {
  id: string;
  provider: string;
  providerAccountName?: string | null;
  connectedAt?: Date | string | null;
}): DiscoverySignal | null {
  const profile = CONNECTOR_PROFILES[integration.provider.toLowerCase()];
  // An unknown provider produces no signal rather than a generic one. "You have
  // connected something and it probably processes personal data" is not a finding
  // anyone can act on, and it would fill the queue on every new connector shipped.
  if (!profile) return null;

  const account = integration.providerAccountName ? ` (${integration.providerAccountName})` : '';
  return {
    source: 'saas_connector',
    sourceKey: `${integration.provider.toLowerCase()}|${integration.id}`.slice(0, 255),
    title: `${profile.label} is connected and no activity describes it`,
    description: `${profile.label}${account} is connected to your organisation, so personal data is being processed in it. No processing activity in the register covers it.`,
    confidence: 'high',

    suggestedName: profile.activityName,
    suggestedPurpose: profile.purpose,
    suggestedLawfulBasis: profile.lawfulBasis,
    suggestedDataCategories: profile.dataCategories,
    suggestedDataSubjects: profile.dataSubjects,
    suggestedRecipients: [{ name: profile.label, role: 'processor' }],
    suggestedTransfers: profile.defaultCountry
      ? [{ destinationCountry: profile.defaultCountry, destinationEntity: profile.label, transferMechanism: null }]
      : [],

    evidence: {
      provider: integration.provider,
      account: integration.providerAccountName ?? null,
      connectedAt: integration.connectedAt ? new Date(integration.connectedAt).toISOString() : null,
    },
    integrationId: integration.id,
  };
}

// ---------------------------------------------------------------------------

/**
 * Whether a vendor is already accounted for by an activity.
 *
 * Name matching as well as id matching, because a recipient row typed by hand
 * before the vendor register existed says "Mailchimp" with no `vendor_id`, and a
 * discovery queue that reported it as unaccounted-for would be reporting the
 * register's history rather than its gaps.
 */
export function isVendorReferenced(
  vendorId: string,
  vendorName: string,
  recipients: { vendorId?: string | null; name?: string | null }[],
): boolean {
  const name = vendorName.trim().toLowerCase();
  return recipients.some((r) =>
    (r.vendorId && r.vendorId === vendorId)
    || (r.name ?? '').trim().toLowerCase() === name);
}

/**
 * Whether a tracker is already accounted for.
 *
 * Matched against recipient names and against the activity purposes, because the
 * register's answer to "we use Google Analytics" is as often a sentence in a
 * purpose as it is a recipient row.
 */
export function isTrackerReferenced(
  tracker: { provider?: string | null; trackerKey?: string | null; observedHost: string },
  haystacks: string[],
): boolean {
  const needles = [tracker.provider, tracker.trackerKey, rootDomain(tracker.observedHost)]
    .filter((v): v is string => !!v && v.length > 2)
    .map((v) => v.toLowerCase());
  if (needles.length === 0) return false;
  const text = haystacks.join('   ').toLowerCase();
  return needles.some((n) => text.includes(n));
}

function rootDomain(host: string): string {
  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return host;
  return parts.slice(-2).join('.');
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim());
}
