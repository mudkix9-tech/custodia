import type { TrackerEntry } from './trackerRegistry.js';
import type { ConsentSignal, PostConsentMethod, ScanPass } from './browserPool.js';

// ---------------------------------------------------------------------------
// Consent scan evaluator.
//
// Pure in, pure out: no DB access, no network, no clock. Everything it needs is an
// argument, so it can be run against recorded fixtures in CI. The worker owns
// persistence; this file owns the judgement.
// ---------------------------------------------------------------------------

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingType =
  | 'missing_category'
  | 'prior_consent_violation'
  | 'consent_mode_only'
  | 'cmp_no_enforcement'
  | 'unclassified_cookie'
  | 'untracked_cookie'
  | 'consent_mode_gap'
  | 'vendor_undocumented';

export type EvaluatorObservation = {
  observedHost: string;
  trackerKey: string | null;
  provider: string | null;
  requiredCategory: string | null;
  matchedVendorId?: string | null;
  vendorSlug?: string | null;
  pass: ScanPass;
  resourceType?: string | null;
  carriedIdentifiers: boolean;
  consentSignal: ConsentSignal | null;
  requestCount?: number;
  /** Already sanitised by the scanner. Safe to cite as evidence. */
  sampleUrl?: string | null;
};

export type EvaluatorCookie = {
  cookieName: string;
  category: string;
  provider?: string | null;
  isThirdParty?: boolean;
};

export type EvaluatorDomain = {
  domain: string;
  /** Categories the banner actually offers. */
  categories: string[];
  gcmV2Enabled: boolean;
  tcfEnabled: boolean;
  /** CMP key as detected during the scan, e.g. 'custodia', 'cookiebot', or null. */
  cmp: string | null;
  /** vendor_slug values already on the org's vendor register. */
  knownVendorSlugs?: string[];
};

export type EvaluatorRun = {
  postConsentMethod: PostConsentMethod;
};

export type Finding = {
  findingType: FindingType;
  severity: FindingSeverity;
  trackerKey: string | null;
  provider: string | null;
  /** Empty string for domain-level findings; it is part of the upsert key. */
  observedHost: string;
  /**
   * Discriminator for findings that are not about a host — the cookie name, for
   * instance. Also part of the upsert key: without it every unclassified_cookie on
   * a domain shared the key (domain, type, '') and all but one were overwritten.
   */
  subject: string;
  requiredCategory: string | null;
  matchedVendorId: string | null;
  evidence: Record<string, any>;
  confidence: number;
};

const FULL_CONFIDENCE = 0.9;
const UNRELIABLE_CONFIDENCE = 0.5;

/**
 * Findings drawn from pass 1 keep full confidence even when pass 2 failed: a
 * tracker firing before any consent is a fact about the unconsented load, and a
 * failure to accept does not weaken it.
 *
 * Findings drawn from the post-consent tracker set are the ones that suffer. If we
 * could not reliably reach a consented state, a request we attribute to "after
 * consent" may have been an unconsented load, so those drop to 0.5 and the UI must
 * not present them as definitive.
 */
function postConsentConfidence(run: EvaluatorRun): number {
  return run.postConsentMethod === 'unknown' ? UNRELIABLE_CONFIDENCE : FULL_CONFIDENCE;
}

function isNecessary(category: string | null | undefined): boolean {
  return category === 'necessary';
}

/** Picks the observation that best justifies a finding about a host. */
function strongestObservation(observations: EvaluatorObservation[]): EvaluatorObservation | undefined {
  return observations
    .slice()
    .sort((a, b) => {
      if (a.carriedIdentifiers !== b.carriedIdentifiers) return a.carriedIdentifiers ? -1 : 1;
      return (b.requestCount ?? 1) - (a.requestCount ?? 1);
    })[0];
}

export function evaluateConsentScan(
  run: EvaluatorRun,
  observations: EvaluatorObservation[],
  domain: EvaluatorDomain,
  cookies: EvaluatorCookie[],
  // The registry is data, not a data source, so passing it in keeps this pure while
  // still allowing cookie-to-tracker reasoning.
  registry: TrackerEntry[] = []
): Finding[] {
  const findings: Finding[] = [];
  const declaredCategories = new Set(domain.categories ?? []);
  const knownVendorSlugs = new Set(domain.knownVendorSlugs ?? []);
  const usesCustodiaCmp = domain.cmp === 'custodia';

  const preConsent = observations.filter(o => o.pass === 'pre_consent');
  const trackerObservations = observations.filter(o => o.trackerKey);

  // -- prior consent -------------------------------------------------------
  // A non-necessary tracker that fired before any consent *and* carried an
  // identifier. Requiring the identifier is what keeps Consent Mode pings — which
  // fire early on purpose and transmit nothing identifying — out of this bucket.
  const priorConsentOffenders = preConsent.filter(
    o => o.trackerKey && !isNecessary(o.requiredCategory) && o.carriedIdentifiers
  );

  if (usesCustodiaCmp && priorConsentOffenders.length > 0) {
    // Custodia's banner records consent but does not gate script execution, so on a
    // Custodia-CMP domain the cause is our script, not the customer's setup. Naming
    // the customer here would be wrong, so one finding replaces the per-host set.
    findings.push({
      findingType: 'cmp_no_enforcement',
      severity: 'high',
      trackerKey: null,
      provider: 'Custodia',
      observedHost: '',
      subject: '',
      requiredCategory: null,
      matchedVendorId: null,
      evidence: {
        reason:
          'The Custodia consent banner records consent but does not block scripts, so trackers run before the visitor answers it. This is a limitation of Custodia, not of this site configuration.',
        affectedHosts: priorConsentOffenders.map(o => o.observedHost),
        affectedTrackers: Array.from(new Set(priorConsentOffenders.map(o => o.trackerKey))),
        categories: Array.from(new Set(priorConsentOffenders.map(o => o.requiredCategory).filter(Boolean))),
      },
      confidence: FULL_CONFIDENCE,
    });
  } else {
    for (const observation of dedupeByHost(priorConsentOffenders)) {
      findings.push({
        findingType: 'prior_consent_violation',
        severity: 'critical',
        trackerKey: observation.trackerKey,
        provider: observation.provider,
        observedHost: observation.observedHost,
        subject: '',
        requiredCategory: observation.requiredCategory,
        matchedVendorId: observation.matchedVendorId ?? null,
        evidence: {
          pass: 'pre_consent',
          carriedIdentifiers: true,
          consentSignal: observation.consentSignal,
          requestCount: observation.requestCount ?? 1,
          sampleUrl: observation.sampleUrl ?? null,
          cmpDetected: domain.cmp,
        },
        confidence: FULL_CONFIDENCE,
      });
    }
  }

  // -- Consent Mode behaving correctly -------------------------------------
  // Recorded, not flagged. A tag that loads pre-consent while signalling denial and
  // transmitting no identifier is the compliant pattern; surfacing it as a problem
  // is the single fastest way to discredit the whole feature.
  const consentModeOnly = preConsent.filter(
    o =>
      o.trackerKey &&
      !isNecessary(o.requiredCategory) &&
      o.consentSignal === 'denied' &&
      !o.carriedIdentifiers
  );
  for (const observation of dedupeByHost(consentModeOnly)) {
    findings.push({
      findingType: 'consent_mode_only',
      severity: 'info',
      trackerKey: observation.trackerKey,
      provider: observation.provider,
      observedHost: observation.observedHost,
      subject: '',
      requiredCategory: observation.requiredCategory,
      matchedVendorId: observation.matchedVendorId ?? null,
      evidence: {
        pass: 'pre_consent',
        consentSignal: 'denied',
        carriedIdentifiers: false,
        note: 'Tag loaded before consent but signalled denial and sent no identifier. This is correct behaviour.',
        sampleUrl: observation.sampleUrl ?? null,
      },
      confidence: FULL_CONFIDENCE,
    });
  }

  // -- declared categories vs observed trackers ----------------------------
  const missingByCategory = new Map<string, EvaluatorObservation[]>();
  for (const observation of trackerObservations) {
    const category = observation.requiredCategory;
    if (!category || isNecessary(category) || declaredCategories.has(category)) continue;
    const bucket = missingByCategory.get(category) ?? [];
    bucket.push(observation);
    missingByCategory.set(category, bucket);
  }

  for (const [category, categoryObservations] of missingByCategory) {
    for (const observation of dedupeByHost(categoryObservations)) {
      const seenPreConsent = categoryObservations.some(
        o => o.observedHost === observation.observedHost && o.pass === 'pre_consent'
      );
      findings.push({
        findingType: 'missing_category',
        severity: 'high',
        trackerKey: observation.trackerKey,
        provider: observation.provider,
        observedHost: observation.observedHost,
        // Hosts are deduped inside each category bucket, not across them, so one
        // host doing two undeclared things emits two findings. Without the category
        // in the key both would file under (domain, type, host, '') and the second
        // would overwrite the first — the pre-0043 per-cookie bug, one level up.
        subject: category,
        requiredCategory: category,
        matchedVendorId: observation.matchedVendorId ?? null,
        evidence: {
          declaredCategories: Array.from(declaredCategories),
          missingCategory: category,
          reason: `This tracker requires consent for "${category}", which the banner does not offer, so consent for it can never be collected.`,
          seenPreConsent,
        },
        // A host seen pre-consent needs no assumption about pass 2 succeeding.
        confidence: seenPreConsent ? FULL_CONFIDENCE : postConsentConfidence(run),
      });
    }
  }

  // -- cookies with no known classification --------------------------------
  for (const cookie of cookies) {
    if (cookie.category !== 'uncategorized') continue;
    findings.push({
      findingType: 'unclassified_cookie',
      severity: 'medium',
      trackerKey: null,
      provider: cookie.provider ?? null,
      observedHost: '',
      subject: cookie.cookieName,
      requiredCategory: null,
      matchedVendorId: null,
      evidence: {
        cookieName: cookie.cookieName,
        isThirdParty: cookie.isThirdParty ?? false,
        reason:
          'This cookie matches no tracker in the registry, so its purpose and consent category are undocumented.',
      },
      confidence: FULL_CONFIDENCE,
    });
  }

  // -- trackers with no cookie ---------------------------------------------
  // A tracker on the network that wrote none of its known cookies is usually a
  // server-side or Conversions-API deployment: the cookie banner cannot see it, and
  // a cookie-only audit would miss it entirely.
  const registryByKey = new Map(registry.map(entry => [entry.trackerKey, entry]));
  const cookieNames = cookies.map(c => c.cookieName);

  for (const observation of dedupeByHostAndTracker(trackerObservations)) {
    const entry = observation.trackerKey ? registryByKey.get(observation.trackerKey) : undefined;
    if (!entry || entry.cookiePrefixes.length === 0) continue;
    if (isNecessary(observation.requiredCategory)) continue;

    const hasCookie = entry.cookiePrefixes.some(prefix =>
      cookieNames.some(name => name.startsWith(prefix))
    );
    if (hasCookie) continue;

    findings.push({
      findingType: 'untracked_cookie',
      severity: 'medium',
      trackerKey: observation.trackerKey,
      provider: observation.provider,
      observedHost: observation.observedHost,
      // One row per tracker, not per host — see dedupeByHostAndTracker.
      subject: observation.trackerKey ?? '',
      requiredCategory: observation.requiredCategory,
      matchedVendorId: observation.matchedVendorId ?? null,
      evidence: {
        expectedCookiePrefixes: entry.cookiePrefixes,
        reason:
          'This tracker was seen on the network but wrote none of its usual cookies, which points to a server-side or Conversions-API integration that the cookie table does not cover.',
        carriedIdentifiers: observation.carriedIdentifiers,
      },
      confidence: postConsentConfidence(run),
    });
  }

  // -- Consent Mode / TCF configuration gaps -------------------------------
  const consentModeTrackers = dedupeByKey(
    trackerObservations.filter(o => {
      const entry = o.trackerKey ? registryByKey.get(o.trackerKey) : undefined;
      return entry?.consentModeSupported === true;
    })
  );

  if (consentModeTrackers.length > 0 && !domain.gcmV2Enabled) {
    findings.push({
      findingType: 'consent_mode_gap',
      severity: 'medium',
      trackerKey: null,
      provider: null,
      observedHost: '',
      subject: '',
      requiredCategory: null,
      matchedVendorId: null,
      evidence: {
        trackers: consentModeTrackers.map(o => o.trackerKey),
        providers: Array.from(new Set(consentModeTrackers.map(o => o.provider).filter(Boolean))),
        reason:
          'Trackers that read Google Consent Mode v2 are present, but Consent Mode signalling is switched off for this domain, so they receive no consent state.',
        setting: 'gcmV2Enabled',
      },
      confidence: postConsentConfidence(run),
    });
  }

  // The TCF half is deliberately narrow. Flagging every marketing tracker as a TCF
  // gap would be noise, because most sites are not in the IAB framework at all. A
  // TCF consent string on the page is unambiguous: the site is in the framework
  // while Custodia is not configured for it.
  const tcfCookie = cookies.find(
    c => c.cookieName === 'euconsent-v2' || c.cookieName === 'eupubconsent-v2'
  );
  if (tcfCookie && !domain.tcfEnabled) {
    findings.push({
      findingType: 'consent_mode_gap',
      severity: 'medium',
      trackerKey: null,
      provider: null,
      observedHost: 'tcf',
      subject: '',
      requiredCategory: null,
      matchedVendorId: null,
      evidence: {
        cookieName: tcfCookie.cookieName,
        reason:
          'An IAB TCF consent string is present on this domain, but TCF support is switched off in Custodia, so the string Custodia publishes will not match what IAB vendors read.',
        setting: 'tcfEnabled',
      },
      confidence: FULL_CONFIDENCE,
    });
  }

  // -- vendors not on the register -----------------------------------------
  const undocumented = new Map<string, EvaluatorObservation>();
  for (const observation of trackerObservations) {
    const entry = observation.trackerKey ? registryByKey.get(observation.trackerKey) : undefined;
    const slug = observation.vendorSlug ?? entry?.vendorSlug ?? null;
    if (!slug || knownVendorSlugs.has(slug)) continue;
    if (isNecessary(observation.requiredCategory)) continue;
    if (!undocumented.has(slug)) undocumented.set(slug, observation);
  }

  for (const [slug, observation] of undocumented) {
    findings.push({
      findingType: 'vendor_undocumented',
      severity: 'low',
      trackerKey: observation.trackerKey,
      provider: observation.provider,
      observedHost: observation.observedHost,
      // One finding per vendor, but the row is keyed on the host it was seen at, and
      // a single host can serve two vendors. The slug is what makes these distinct.
      subject: slug,
      requiredCategory: observation.requiredCategory,
      matchedVendorId: observation.matchedVendorId ?? null,
      evidence: {
        vendorSlug: slug,
        reason:
          'This tracker belongs to a processor that is not on the organisation\'s vendor register, so it has no recorded DPA or transfer basis.',
      },
      confidence: postConsentConfidence(run),
    });
  }

  return findings;
}

function dedupeByHost(observations: EvaluatorObservation[]): EvaluatorObservation[] {
  return dedupeBy(observations, o => o.observedHost);
}

/**
 * One observation per host *and* tracker. A host is not an identity on its own: a
 * site proxying several vendors' tags through one of its own hosts to survive
 * blockers puts two trackers behind one name, and collapsing on the host alone drops
 * whichever `strongestObservation` does not pick — silently, and precisely for the
 * server-side deployments a cookie-only audit already cannot see.
 */
function dedupeByHostAndTracker(observations: EvaluatorObservation[]): EvaluatorObservation[] {
  return dedupeBy(observations, o => `${o.observedHost} ${o.trackerKey ?? ''}`);
}

function dedupeBy(
  observations: EvaluatorObservation[],
  keyOf: (observation: EvaluatorObservation) => string
): EvaluatorObservation[] {
  const buckets = new Map<string, EvaluatorObservation[]>();
  for (const observation of observations) {
    const bucket = buckets.get(keyOf(observation)) ?? [];
    bucket.push(observation);
    buckets.set(keyOf(observation), bucket);
  }
  const result: EvaluatorObservation[] = [];
  for (const bucket of buckets.values()) {
    const best = strongestObservation(bucket);
    if (best) result.push(best);
  }
  return result.sort((a, b) => a.observedHost.localeCompare(b.observedHost));
}

function dedupeByKey(observations: EvaluatorObservation[]): EvaluatorObservation[] {
  const byKey = new Map<string, EvaluatorObservation>();
  for (const observation of observations) {
    const key = observation.trackerKey ?? observation.observedHost;
    if (!byKey.has(key)) byKey.set(key, observation);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    String(a.trackerKey).localeCompare(String(b.trackerKey))
  );
}
