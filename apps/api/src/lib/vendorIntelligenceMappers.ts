/**
 * Pure mapping and diffing functions for vendor intelligence.
 *
 * Extracted from `vendorIntelligence.ts` so that standalone test fixtures
 * (such as `vendors.test.ts`) can exercise candidate mapping and freshness
 * diffing in memory without importing `db.js` (which throws when DATABASE_URL
 * is not set).
 */
import type { CandidateAssessment } from './vendorFieldConfidence.js';

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

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface EnrichResult {
  target: EnrichTarget;
  ok: boolean;
  extracted?: ExtractedRecord;
  assessment?: CandidateAssessment;
  grounding?: GroundingSource[];
  failureClass?: string;
  error?: string;
}

export interface ProvenanceWrite {
  fieldName: string;
  value: unknown;
  sourceType: 'ai_grounded' | 'http_probe' | 'registry' | 'analyst' | 'customer';
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
 * Turn a candidate into its catalogue column values and its provenance rows.
 *
 * Pure so the fixtures can assert the mapping — this is where a wrong field
 * name would silently write nothing. Only fields with a usable value map; a
 * null dpaUrl writes no column and no provenance row.
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
    sourceUrl?: string | null,
  ) => {
    if (value === null || value === undefined) return;
    columns[column] = value;
    const per = assessment.perField?.[field];
    provenance.push({
      fieldName: field,
      value,
      sourceType: typeof sourceUrl === 'string' ? 'http_probe' : 'ai_grounded',
      sourceUrl: sourceUrl ?? null,
      confidence: per?.confidence ?? 40,
      evidenceSnippet: per?.domainOutcome ?? null,
    });
  };

  push('dpaUrl', 'dpaUrl', record.dpaUrl, record.dpaUrl);
  push('privacyPolicyUrl', 'privacyPolicyUrl', record.privacyPolicyUrl, record.privacyPolicyUrl);
  push('subProcessorListUrl', 'subProcessorListUrl', record.subProcessorListUrl, record.subProcessorListUrl);
  push('headquartersCountry', 'headquartersCountry', record.headquartersCountry);
  push(
    'transferMechanisms',
    'transferMechanisms',
    Array.isArray(record.transferMechanisms) && record.transferMechanisms.length > 0
      ? record.transferMechanisms
      : null,
  );
  push(
    'securityCertifications',
    'securityCertifications',
    Array.isArray(record.securityCertifications) && record.securityCertifications.length > 0
      ? record.securityCertifications
      : null,
  );
  push(
    'dataProcessingLocations',
    'dataProcessingLocations',
    Array.isArray(record.dataProcessingLocations) && record.dataProcessingLocations.length > 0
      ? record.dataProcessingLocations
      : null,
  );
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
