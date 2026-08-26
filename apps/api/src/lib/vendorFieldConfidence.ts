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

export interface FieldEvidence {
  /** What the model/probe concluded for this field. */
  value: unknown;
  /** Probe outcome for URL fields; 'ai_grounded' for model-only facts. */
  sourceType: 'ai_grounded' | 'http_probe' | 'registry';
  probeStatus?: 'verified_probed_success' | 'partially_probed' | 'failed_gated' | 'failed_probed';
  domainOk?: boolean;
  resolvedUrl?: string | null;
}

/** Map a probe status + domain check to a 0–100 confidence for one field. */
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
  if (evidence.sourceType === 'registry') return 95;
  // Model-asserted without a probe: never above half. This is the ceiling that
  // stops an unprobed DPA URL from bulk-approving itself.
  return evidence.value ? 40 : 0;
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
  let anyProbeVerified = false;

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
    if (evidence.probeStatus === 'verified_probed_success' && evidence.domainOk !== false) {
      anyProbeVerified = true;
    }
    if (domainOutcome === 'parent_domain') {
      needsConfirmation.push(`${fieldName}: hosted on parent-company domain`);
    }
  }

  const confidence = weightSum > 0 ? Math.round(weightedTotal / weightSum) : 0;

  return {
    confidence,
    // Bulk-approve requires the DPA verified AND at least one more corroborating
    // probe — the audit's complaint was not that the bar was high but that it
    // was the wrong shape. A verified DPA alone puts the candidate at the front
    // of the queue rather than in the bin.
    autoAcceptable: hasVerifiedDpa && anyProbeVerified && confidence >= 70,
    needsConfirmation,
    perField,
  };
}
