/**
 * Pure mapping and diffing functions for vendor intelligence.
 *
 * Extracted from `vendorIntelligence.ts` so that standalone test fixtures
 * (such as `vendors.test.ts`) can exercise candidate mapping and freshness
 * diffing in memory without importing `db.js` (which throws when DATABASE_URL
 * is not set).
 */
import { fieldConfidence, type CandidateAssessment, type VendorSourceType } from './vendorFieldConfidence.js';
import { isTrustCentreUrl } from './vendorUrlCandidates.js';
import type { ProbeDocType } from './vendorProbe.js';

export interface EnrichTarget {
  name: string;
  website?: string | null;
  category?: string | null;
  /**
   * The catalogue row this target is, when it is one.
   *
   * Absent for a brand-new candidate, which is the ordinary case: rules belong
   * to a vendor, and a vendor nobody has reviewed has nothing taught about it.
   * Present on a re-verification, which is where taught rules actually apply.
   */
  vendorId?: string | null;
}

export interface ExtractedRecord {
  name?: string;
  slug?: string;
  website?: string;
  description?: string | null;
  category?: string | null;
  headquartersCountry?: string | null;
  dataProcessingLocations?: string[] | null;
  dpaUrl?: string | null;
  privacyPolicyUrl?: string | null;
  subProcessorListUrl?: string | null;
  transferMechanisms?: string[] | null;
  euHostingAvailable?: boolean | null;
  securityCertifications?: string[] | null;
  aliases?: string[] | null;
}

/**
 * One enumerated candidate URL that did not become a field.
 *
 * This is what `vendor_candidates.grounding` holds after Sprint 5. The column
 * used to carry `groundingMetadata` — the pages a search tool retrieved while
 * a model generated a sentence, which is a plausible-looking citation rather
 * than the source of the asserted fact. It now carries the audit trail for the
 * opposite and more useful question: which URLs were tried for this vendor, and
 * why each one failed to produce evidence. That is what makes an absent field
 * reviewable instead of merely empty.
 */
export interface RejectedCandidateUrl {
  url: string;
  type: ProbeDocType;
  /** Where the URL came from: enumeration, a trust portal, or a page link. */
  origin: string;
  /** The probe's own verdict — `url_not_found`, `gated_content`, and so on. */
  failureClass?: string;
  httpStatus?: number | null;
}

/** One page a run read, on its way to `vendor_probe_documents`. */
export interface StoredProbeDocument {
  url: string;
  docType: string;
  httpStatus: number | null;
  outcome: string;
  text: string;
  isPdf: boolean;
}

/**
 * Collapse a run's documents to one row per URL.
 *
 * Two enumerated candidates can redirect to the *same* resolved URL — a site
 * answering `/legal/dpa`, `/dpa` and `/privacy/dpa` from one page is ordinary —
 * and each pushes a document keyed on where it landed. Postgres refuses a
 * statement whose `ON CONFLICT DO UPDATE` would touch one row twice (`cannot
 * affect row a second time`), so a sweep died on the first vendor that
 * redirected two paths together. Same collapse-before-insert the DPF sync needs
 * for its duplicate participant listings, and found the same way: by running it
 * over enough real sites.
 *
 * A verified reading wins over a failed one for the same URL, because the row
 * answers "what is on this page" and one probe having asked for the wrong
 * document type does not make the page unreadable. Between two readings of equal
 * standing, the longer body wins — a truncated or partial fetch tells a reviewer
 * less than a complete one.
 */
export function collapseProbeDocuments(
  documents: readonly StoredProbeDocument[],
): StoredProbeDocument[] {
  const byUrl = new Map<string, StoredProbeDocument>();
  for (const doc of documents) {
    const key = doc.url.toLowerCase();
    const held = byUrl.get(key);
    if (!held) {
      byUrl.set(key, doc);
      continue;
    }
    const better =
      (doc.outcome === 'verified' && held.outcome !== 'verified') ||
      (doc.outcome === held.outcome && doc.text.length > held.text.length);
    if (better) byUrl.set(key, doc);
  }
  return [...byUrl.values()];
}

/** What a taught `field_extract` rule produced on this run. */
export interface FieldRuleOutcome {
  ruleId: string;
  fieldName: string;
  url: string;
  value: string | string[] | null;
  matched: boolean;
}

export interface EnrichResult {
  target: EnrichTarget;
  ok: boolean;
  extracted?: ExtractedRecord;
  assessment?: CandidateAssessment;
  /** Stored in the `grounding` column — see `RejectedCandidateUrl`. */
  rejectedUrls?: RejectedCandidateUrl[];
  /**
   * Every page the run read, bound for `vendor_probe_documents`.
   *
   * Typed loosely here rather than importing `ProbeDocumentRecord` from
   * `vendorIntelligence.ts`: this module is the one the fixtures import, and it
   * deliberately does not depend on the service that imports it.
   */
  documents?: Array<{
    url: string;
    docType: string;
    httpStatus: number | null;
    outcome: string;
    text: string;
    isPdf: boolean;
  }>;
  /**
   * Taught field rules and whether each did what it promised.
   *
   * Carried out of the run rather than resolved inside it because a rule that
   * failed has to be *recorded* as failed — that is what turns a silent
   * regression into a signal a reviewer sees.
   */
  fieldOutcomes?: FieldRuleOutcome[];
  failureClass?: string;
  error?: string;
}

export interface ProvenanceWrite {
  fieldName: string;
  value: unknown;
  sourceType: VendorSourceType;
  sourceUrl?: string | null;
  confidence: number;
  evidenceSnippet?: string | null;
}

export interface StoredCatalogueFields {
  dpaUrl?: string | null;
  privacyPolicyUrl?: string | null;
  subProcessorListUrl?: string | null;
  headquartersCountry?: string | null;
}

export interface ReverifyOutcome {
  vendorId: string;
  ok: boolean;
  changes: Array<{ field: string; current: unknown; fresh: unknown; confidence: number }>;
  assessment?: CandidateAssessment;
}

export function normaliseCandidateDomain(urlOrHost: string): string {
  let host = (urlOrHost || '').trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const slash = host.indexOf('/');
  if (slash !== -1) host = host.slice(0, slash);
  host = host.replace(/:\d+$/, '').replace(/^www\./, '');
  return host.slice(0, 255);
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Where a catalogue field's value came from, or `null` for "nothing did".
 *
 * Sprint 5 makes this explicit at every call site rather than inferring it from
 * whether a source URL happened to be passed. The four fields that now pass
 * `null` are the ones the model used to assert; they come back in Sprint 7 off
 * the DPF registry and in Sprint 9 off an analyst reading a document, and until
 * then the honest answer is that the catalogue has not looked.
 */
type FieldSource = { sourceType: VendorSourceType; sourceUrl: string } | null;

/** A probed document is Tier 2 on the vendor's own site, Tier 3 on a portal. */
function probedSource(url: string | null | undefined): FieldSource {
  if (typeof url !== 'string' || !url) return null;
  return { sourceType: isTrustCentreUrl(url) ? 'trust_centre' : 'http_probe', sourceUrl: url };
}

/**
 * Turn a candidate into its catalogue column values and its provenance rows.
 *
 * Pure so the fixtures can assert the mapping — this is where a wrong field
 * name would silently write nothing.
 *
 * **A field with no source writes neither a column nor a provenance row.** A
 * column without provenance is a value the product cannot explain when a
 * reviewer asks where it came from, and a provenance row at confidence 0 still
 * renders as a field the catalogue has an opinion about. Absent is a tier, and
 * it is the tier most fields will occupy; it has to render as "not yet
 * verified" rather than as a confident nothing.
 */
export function buildCatalogueWrites(
  record: ExtractedRecord,
  assessment: CandidateAssessment,
  /**
   * Taught field rules that matched on this run, keyed by field.
   *
   * This is the only thing that unlocks the five Chapter V fields below. Without
   * a rule they stay sourceless and therefore unwritten, which is the Sprint 5
   * position and still the right default: a value with no evidence rendered
   * against a named company is worse than a gap.
   */
  taught: Readonly<Record<string, { url: string }>> = {},
): {
  columns: Partial<Record<string, unknown>>;
  provenance: ProvenanceWrite[];
} {
  const columns: Partial<Record<string, unknown>> = {};
  const provenance: ProvenanceWrite[] = [];

  const push = (
    field: string,
    column: string,
    value: unknown,
    source: FieldSource,
  ) => {
    if (value === null || value === undefined) return;
    if (!source) return;
    columns[column] = value;
    const per = assessment.perField?.[field];
    provenance.push({
      fieldName: field,
      value,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      // Falling back to the unprobed ceiling rather than to a bare number:
      // bulk approval hands this function an empty perField map, and a URL we
      // hold but have not re-probed is exactly `partially_probed`.
      confidence:
        per?.confidence ??
        fieldConfidence({ value, sourceType: source.sourceType, probeStatus: 'partially_probed' }),
      evidenceSnippet: per?.domainOutcome ?? null,
    });
  };

  push('dpaUrl', 'dpaUrl', record.dpaUrl, probedSource(record.dpaUrl));
  push('privacyPolicyUrl', 'privacyPolicyUrl', record.privacyPolicyUrl, probedSource(record.privacyPolicyUrl));
  push('subProcessorListUrl', 'subProcessorListUrl', record.subProcessorListUrl, probedSource(record.subProcessorListUrl));
  /**
   * The five Chapter V fields the model used to write as `ai_grounded`.
   *
   * Sprint 5 removed the model and left them with no source, so nothing wrote
   * them and they have been absent ever since — correctly, because absent is a
   * tier and a guess is not. A taught `field_extract` rule is the first thing
   * to give them one: a page on the vendor's own domain, an anchor a named
   * person selected, re-read on every run. `taughtSource` returns null for any
   * field nobody has taught, so the default is unchanged.
   */
  const taughtSource = (field: string): FieldSource =>
    taught[field] ? probedSource(taught[field]!.url) : null;

  push('headquartersCountry', 'headquartersCountry', record.headquartersCountry, taughtSource('headquartersCountry'));
  push(
    'transferMechanisms',
    'transferMechanisms',
    Array.isArray(record.transferMechanisms) && record.transferMechanisms.length > 0
      ? record.transferMechanisms
      : null,
    taughtSource('transferMechanisms'),
  );
  push(
    'securityCertifications',
    'securityCertifications',
    Array.isArray(record.securityCertifications) && record.securityCertifications.length > 0
      ? record.securityCertifications
      : null,
    taughtSource('securityCertifications'),
  );
  push(
    'dataProcessingLocations',
    'dataProcessingLocations',
    Array.isArray(record.dataProcessingLocations) && record.dataProcessingLocations.length > 0
      ? record.dataProcessingLocations
      : null,
    taughtSource('dataProcessingLocations'),
  );
  // `description` is prose for a card, not a compliance assertion, and it comes
  // off the target rather than off a claim about the outside world.
  if (typeof record.description === 'string' && record.description.trim()) {
    columns.description = record.description.trim().slice(0, 2000);
  }

  return { columns, provenance };
}

/**
 * Diff a fresh extraction against the stored catalogue row. Separate from
 * `reverifyVendor` so fixtures can assert it without a model or network.
 */
export function diffFreshAgainstCatalogue(
  stored: StoredCatalogueFields,
  fresh: ExtractedRecord,
  assessment: CandidateAssessment,
): ReverifyOutcome['changes'] {
  const pairs: Array<[string, unknown, unknown]> = [
    ['dpaUrl', stored.dpaUrl ?? null, fresh.dpaUrl ?? null],
    ['privacyPolicyUrl', stored.privacyPolicyUrl ?? null, fresh.privacyPolicyUrl ?? null],
    ['subProcessorListUrl', stored.subProcessorListUrl ?? null, fresh.subProcessorListUrl ?? null],
    ['headquartersCountry', stored.headquartersCountry ?? null, fresh.headquartersCountry ?? null],
  ];
  return pairs
    .filter(
      ([, current, next]) =>
        normaliseCandidateDomain(String(current ?? '')) !== normaliseCandidateDomain(String(next ?? '')) &&
        String(current ?? '') !== String(next ?? ''),
    )
    .map(([field, current, next]) => ({
      field,
      current,
      fresh: next,
      confidence: assessment.perField?.[field]?.confidence ?? 0,
    }));
}
