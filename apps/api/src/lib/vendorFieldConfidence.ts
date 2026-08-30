/**
 * Per-field confidence and routing — audit P-7.
 *
 * The gatherer's acceptance gate was `isHighConfidence = dpaOk && privacyOk`:
 * an AND across two independent artefacts, which discarded eight records with a
 * verified DPA because their privacy policy failed. "The DPA is the field that
 * matters most and it is being discarded for the field that matters least."
 *
 * Confidence is now per field, each field has its own accept/review rule, and
 * the candidate-level score is a weighted mean — so a record can be accepted on
 * its DPA while its privacy policy sits at 0 waiting for a re-probe.
 */
import { classifyDocumentDomain } from './vendorDomains.js';

/**
 * The fields the pipeline collects, weighted by how much the risk engine and
 * the register actually use them. The DPA is worth three times the privacy
 * policy: it feeds dpaUrl, the clause analysis (P-9) and the audit pack.
 */
export const FIELD_WEIGHTS: Readonly<Record<string, number>> = {
  dpaUrl: 3,
  subProcessorListUrl: 2,
  headquartersCountry: 2,
  transferMechanisms: 2,
  securityCertifications: 1.5,
  dataProcessingLocations: 1,
  euHostingAvailable: 1,
  privacyPolicyUrl: 1,
  description: 0.5,
};

/**
 * The provenance vocabulary — the whole of it, Sprint 5 (VD-2).
 *
 * `ai_grounded` left and `trust_centre` entered in one change because they are
 * one change: the superseded plan specified a trust-centre channel and a
 * vocabulary with nowhere to record its output, while the code it was written
 * against stored five Chapter V fields under a value that meant "a model said
 * so". The zero-model policy is enforced here rather than in prose — a
 * model-sourced value now has no member of this union to be stored under.
 *
 * Ordered as the sourcing programme's pyramid orders it: official publisher,
 * the vendor's own domain, a compliance portal, a named human, the tenant's own
 * contract. Absent is the sixth tier and is represented by no row at all.
 */
export const VENDOR_SOURCE_TYPES = [
  'registry',
  'http_probe',
  'trust_centre',
  'analyst',
  'customer',
] as const;

export type VendorSourceType = (typeof VENDOR_SOURCE_TYPES)[number];

/**
 * What each tier is called in a document a person reads.
 *
 * The web catalogues carry translations of these under `provenance.*`, but the
 * Article 28 dossier is rendered server-side and printed `\`registry\`` — the
 * machine vocabulary, in backticks, in the evidence pack a customer hands a
 * regulator. The slug is kept beside the label rather than dropped, because an
 * auditor tracing a value back to `vendor_field_provenance` needs the word the
 * column actually holds.
 */
export const VENDOR_SOURCE_TYPE_LABELS: Readonly<Record<VendorSourceType, string>> = {
  registry: 'Official register',
  http_probe: 'Verified on the vendor’s own site',
  trust_centre: 'Trust portal',
  analyst: 'Reviewed by a named person',
  customer: 'Your own executed contract',
};

/** The label for a stored value, tolerating one written before its tier existed. */
export function vendorSourceTypeLabel(sourceType: string): string {
  return (VENDOR_SOURCE_TYPE_LABELS as Record<string, string>)[sourceType] ?? 'Unrecognised source';
}

export interface FieldEvidence {
  /** What the registry, probe or reviewer concluded for this field. */
  value: unknown;
  /** Which tier of the pyramid this value came off. */
  sourceType: VendorSourceType;
  probeStatus?: 'verified_probed_success' | 'partially_probed' | 'failed_gated' | 'failed_probed';
  domainOk?: boolean;
  resolvedUrl?: string | null;
}

/**
 * Map a source tier plus its probe outcome to a 0–100 confidence for one field.
 *
 * There is no "asserted but unprobed" tier any more (Sprint 5, VD-1). The old
 * `evidence.value ? 40 : 0` line scored a model sentence at 40, which
 * `fieldDecision` routed to `review` — a number that reads like measurement
 * rendering the same as a half-confirmed probe in the review queue. A field
 * is now registry-sourced, probe-sourced, portal-sourced, human-sourced, or
 * absent, and absent means no evidence object and no provenance row rather than
 * a row at zero.
 */
export function fieldConfidence(evidence: FieldEvidence): number {
  if (evidence.sourceType === 'http_probe') {
    if (evidence.probeStatus === 'verified_probed_success') {
      // A verified probe whose document lives off-domain still counts — but
      // visibly less than one on the vendor's own site (P-7's outcome shape).
      return evidence.domainOk === false ? 60 : 90;
    }
    if (evidence.probeStatus === 'partially_probed') {
      return evidence.domainOk === false ? 30 : 45;
    }
    // failed_gated / failed_probed
    return evidence.probeStatus === 'failed_gated' ? 15 : 5;
  }
  if (evidence.sourceType === 'trust_centre') {
    // Tier 3 tops out below the accept bar on purpose. A SafeBase or Vanta page
    // is HTML with a badge on it: there is no signature and nothing to verify,
    // so what it proves is that the portal renders a badge, not that the SOC 2
    // report behind it says what the badge says. That is a claim a human should
    // read before it reaches a customer's register.
    if (evidence.probeStatus === 'verified_probed_success') return 75;
    if (evidence.probeStatus === 'partially_probed') return 35;
    return evidence.probeStatus === 'failed_gated' ? 15 : 5;
  }
  // An official publisher's dated row.
  if (evidence.sourceType === 'registry') return 95;
  // A named human read the document and recorded a finding, with an excerpt.
  // Whether an analyst row *supersedes* a registry or probe row for its field is
  // a precedence question, not a confidence one — see VD-20.
  if (evidence.sourceType === 'analyst') return 90;
  // The tenant's own executed contract. Authoritative about that tenant and
  // never written back to the shared catalogue.
  return 95;
}

/**
 * Accept / review / reject per field. The AND gate is gone; each field carries
 * its own decision, and only the DPA is allowed to be decisive on its own.
 */
export function fieldDecision(
  evidence: FieldEvidence,
): 'accept' | 'review' | 'reject' {
  const c = fieldConfidence(evidence);
  if (c >= 85) return 'accept';
  if (c >= 30) return 'review';
  return 'reject';
}

export interface CandidateAssessment {
  confidence: number; // 0–100
  /** True when the record is good enough to approve in bulk without reading it. */
  autoAcceptable: boolean;
  needsConfirmation: string[];
  perField: Record<string, { confidence: number; decision: 'accept' | 'review' | 'reject'; domainOutcome?: string }>;
}

/**
 * Assess a whole extracted record.
 *
 * `parentMap` feeds the P-7 outcome: a document on `netsuite.com` for vendor
 * Oracle no longer rejects the record, it lands as `parent_domain` and the
 * candidate joins the review queue flagged "needs confirmation".
 */
export function assessCandidate(
  name: string,
  website: string,
  fields: Record<string, FieldEvidence>,
  parentMap: Readonly<Record<string, string>> = {},
): CandidateAssessment {
  const perField: CandidateAssessment['perField'] = {};
  const needsConfirmation: string[] = [];
  let weightSum = 0;
  let weightedTotal = 0;
  let hasVerifiedDpa = false;
  let corroboratingProbe = false;

  for (const [fieldName, evidence] of Object.entries(fields)) {
    const weight = FIELD_WEIGHTS[fieldName] ?? 0.5;
    const confidence = fieldConfidence(evidence);
    const decision = fieldDecision(evidence);
    const domainOutcome =
      typeof evidence.resolvedUrl === 'string'
        ? classifyDocumentDomain(evidence.resolvedUrl, website, parentMap)
        : undefined;

    perField[fieldName] = { confidence, decision, domainOutcome };
    weightSum += weight;
    weightedTotal += weight * confidence;

    if (fieldName === 'dpaUrl' && evidence.probeStatus === 'verified_probed_success') {
      hasVerifiedDpa = true;
    }
    // Corroboration means a *second* verified field. The DPA vouching for
    // itself was always vacuous, and it stopped being harmless when Sprint 5
    // removed the five model-asserted fields that used to drag the weighted
    // mean below the bulk-approve bar on a one-field record.
    if (
      fieldName !== 'dpaUrl' &&
      evidence.probeStatus === 'verified_probed_success' &&
      evidence.domainOk !== false
    ) {
      corroboratingProbe = true;
    }
    if (domainOutcome === 'parent_domain') {
      needsConfirmation.push(`${fieldName}: hosted on parent-company domain`);
    }
  }

  // The mean is over the fields the record actually asserts, not over
  // FIELD_WEIGHTS in full: it answers "how sure are we of what we are saying",
  // and a vendor whose DPA verified and whose sub-processor list does not exist
  // is not less certain, only less complete. Completeness is a separate axis
  // and absent fields carry no evidence object to average in.
  const confidence = weightSum > 0 ? Math.round(weightedTotal / weightSum) : 0;

  return {
    confidence,
    // Bulk-approve requires the DPA verified AND at least one more corroborating
    // probe — the audit's complaint was not that the bar was high but that it
    // was the wrong shape. A verified DPA alone puts the candidate at the front
    // of the queue rather than in the bin.
    autoAcceptable: hasVerifiedDpa && corroboratingProbe && confidence >= 70,
    needsConfirmation,
    perField,
  };
}
