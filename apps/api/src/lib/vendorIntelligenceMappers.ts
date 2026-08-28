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

export interface EnrichResult {
  target: EnrichTarget;
  ok: boolean;
  extracted?: ExtractedRecord;
  assessment?: CandidateAssessment;
  /** Stored in the `grounding` column — see `RejectedCandidateUrl`. */
  rejectedUrls?: RejectedCandidateUrl[];
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
  // headquartersCountry, transferMechanisms, securityCertifications and
  // dataProcessingLocations: the five Chapter V fields the model used to write
  // as `ai_grounded`. Nothing sources them in Sprint 5, so nothing writes them.
  push('headquartersCountry', 'headquartersCountry', record.headquartersCountry, null);
  push(
    'transferMechanisms',
    'transferMechanisms',
    Array.isArray(record.transferMechanisms) && record.transferMechanisms.length > 0
      ? record.transferMechanisms
      : null,
    null,
  );
  push(
    'securityCertifications',
    'securityCertifications',
    Array.isArray(record.securityCertifications) && record.securityCertifications.length > 0
      ? record.securityCertifications
      : null,
    null,
  );
  push(
    'dataProcessingLocations',
    'dataProcessingLocations',
    Array.isArray(record.dataProcessingLocations) && record.dataProcessingLocations.length > 0
      ? record.dataProcessingLocations
      : null,
    null,
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
