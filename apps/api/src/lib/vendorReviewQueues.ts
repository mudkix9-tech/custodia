/**
 * What the operator console shows: three queues, assembled from rows the rest of
 * the module already writes.
 *
 * The shaping is pure and the querying is not, deliberately split, so
 * `test:vendors` can hold a candidate still and assert what a reviewer would see
 * without a database. That matters more here than usual: every one of these
 * functions returns a *plausible* answer when it is wrong. A field shown as
 * absent when it was actually blocked by robots.txt reads identically to one
 * nobody looked for, and the whole point of the console is that the reviewer can
 * tell those apart.
 */
import { eq, desc, inArray, isNotNull } from 'drizzle-orm';
import { vendorCandidates, vendors, vendorFieldProvenance, vendorProbeDocuments, vendorExtractionRules } from 'db';
import {
  selectAuthoritativeProvenance,
  provenanceAge,
  type ProvenanceRow,
} from './vendorProvenance.js';
import { resolveDpfStatusBatch, dpfLapseNotices } from './vendorAdequacy.js';
import { isRecipientConditional } from '../constants/transferDestinations.js';
import { CORRECTABLE_FIELDS } from './vendorCorrections.js';

/** Probe document type -> the catalogue field it fills. */
const FIELD_BY_DOC_TYPE: Record<string, string> = {
  dpa: 'dpaUrl',
  subprocessors: 'subProcessorListUrl',
  privacy: 'privacyPolicyUrl',
};

export interface RejectedUrl {
  url: string;
  type: string;
  origin?: string;
  failureClass?: string | null;
  httpStatus?: number | null;
}

export interface FieldReview {
  field: string;
  /** What the catalogue says today. `null` where the vendor is new. */
  current: unknown;
  /** What this candidate proposes. `null` where nothing was found. */
  proposed: unknown;
  /** 'new' | 'changed' | 'same' | 'absent' — what the reviewer is deciding. */
  state: 'new' | 'changed' | 'same' | 'absent';
  confidence: number | null;
  decision: string | null;
  failureClass: string | null;
  /** Every URL tried for this field and refused, with why. */
  rejected: RejectedUrl[];
}

export interface CandidateReview {
  id: string;
  name: string;
  domain: string;
  category: string | null;
  confidence: number;
  /** The catalogue row this would update, where one already exists. */
  existingVendorId: string | null;
  fields: FieldReview[];
}

/**
 * Turn one staged candidate plus the catalogue row it would touch into the
 * per-field decisions a reviewer actually makes.
 *
 * Pure. `existing` is `null` for a vendor the catalogue has never seen, which is
 * the ordinary case for a candidate and is why `state` distinguishes `new` from
 * `changed`: overwriting a value somebody already accepted deserves a different
 * colour from filling an empty one.
 */
export function shapeCandidateReview(
  candidate: {
    id: string;
    name: string;
    domain: string;
    category: string | null;
    confidence: number;
    payload: Record<string, unknown> | null;
    probeResults: Record<string, any> | null;
    grounding: unknown;
  },
  existing: Record<string, unknown> | null,
): CandidateReview {
  const payload = candidate.payload ?? {};
  const probes = candidate.probeResults ?? {};

  const rejectedByField = new Map<string, RejectedUrl[]>();
  if (Array.isArray(candidate.grounding)) {
    for (const raw of candidate.grounding as RejectedUrl[]) {
      const field = FIELD_BY_DOC_TYPE[raw?.type ?? ''] ?? raw?.type ?? 'unknown';
      const list = rejectedByField.get(field);
      if (list) list.push(raw);
      else rejectedByField.set(field, [raw]);
    }
  }

  const fields: FieldReview[] = CORRECTABLE_FIELDS.map((field) => {
    const proposed = payload[field] ?? null;
    const current = existing ? (existing[field] ?? null) : null;
    const probe = probes[field] ?? null;

    let state: FieldReview['state'];
    if (isEmptyValue(proposed)) state = 'absent';
    else if (isEmptyValue(current)) state = 'new';
    else state = sameValue(current, proposed) ? 'same' : 'changed';

    return {
      field,
      current,
      proposed,
      state,
      confidence: typeof probe?.confidence === 'number' ? probe.confidence : null,
      decision: probe?.status ? String(probe.status) : null,
      failureClass: probe?.failureClass ? String(probe.failureClass) : null,
      rejected: rejectedByField.get(field) ?? [],
    };
  });

  return {
    id: candidate.id,
    name: candidate.name,
    domain: candidate.domain,
    category: candidate.category,
    confidence: candidate.confidence,
    existingVendorId: (existing?.id as string | undefined) ?? null,
    fields,
  };
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => String(v) === String(b[i]));
  }
  return String(a) === String(b);
}

export interface CatalogueFieldReview {
  field: string;
  value: unknown;
  sourceType: string | null;
  /** Worth today, after decay — not the stored number. */
  confidence: number | null;
  confidenceWhenGathered: number | null;
  stale: boolean;
  reviewOverdue: boolean;
  retrievedAt: string | null;
  sourceUrl: string | null;
  supersededCount: number;
  /** No provenance row at all. The sixth tier, and the most common one. */
  absent: boolean;
}

export interface CatalogueReview {
  vendorId: string;
  name: string;
  website: string | null;
  legalEntityName: string | null;
  headquartersCountry: string | null;
  fields: CatalogueFieldReview[];
  /** Sourced fields with neither a value nor a provenance row. */
  unresolvedCount: number;
}

/**
 * Shape one catalogue row and its provenance into a verification view.
 *
 * Pure. `absent` is computed rather than inferred from a falsy value, because a
 * field can hold a value with no provenance behind it (an import, a hand edit)
 * and that is a different problem from one nobody has looked for — the first is
 * something to source, the second is something to check.
 */
export function shapeCatalogueReview(
  vendor: Record<string, any>,
  provenanceRows: readonly ProvenanceRow[],
  now: Date = new Date(),
): CatalogueReview {
  const authoritative = selectAuthoritativeProvenance(provenanceRows, { scope: 'catalogue', now });
  const byField = new Map(authoritative.map((f) => [f.fieldName, f]));

  const fields: CatalogueFieldReview[] = CORRECTABLE_FIELDS.map((field) => {
    const resolved = byField.get(field);
    if (!resolved) {
      return {
        field,
        value: vendor[field] ?? null,
        sourceType: null,
        confidence: null,
        confidenceWhenGathered: null,
        stale: false,
        reviewOverdue: false,
        retrievedAt: null,
        sourceUrl: null,
        supersededCount: 0,
        absent: true,
      };
    }
    const age = resolved.age ?? provenanceAge(resolved.row, now);
    const retrieved = resolved.row.retrievedAt;
    return {
      field,
      value: vendor[field] ?? null,
      sourceType: resolved.row.sourceType,
      confidence: age.confidence,
      confidenceWhenGathered: age.originalConfidence,
      stale: age.stale,
      reviewOverdue: age.reviewOverdue,
      retrievedAt: retrieved ? new Date(retrieved).toISOString() : null,
      sourceUrl: resolved.row.sourceUrl ?? null,
      supersededCount: resolved.superseded.length,
      absent: false,
    };
  });

  return {
    vendorId: vendor.id,
    name: vendor.name,
    website: vendor.website ?? null,
    legalEntityName: vendor.legalEntityName ?? null,
    headquartersCountry: vendor.headquartersCountry ?? null,
    fields,
    unresolvedCount: fields.filter((f) => f.absent && isEmptyValue(f.value)).length,
  };
}

// ---------------------------------------------------------------------------
// The queries
// ---------------------------------------------------------------------------

/** Pending candidates, newest-highest-confidence first, with their evidence. */
export async function pendingCandidates(dbInstance: any, limit = 100): Promise<CandidateReview[]> {
  const rows = await dbInstance
    .select()
    .from(vendorCandidates)
    .where(eq(vendorCandidates.status, 'pending'))
    .orderBy(desc(vendorCandidates.confidence), desc(vendorCandidates.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  // Resolve the catalogue rows these would touch, so the console can show
  // current beside proposed. Matched on slug, which is what `approveCandidate`
  // matches on — asking a different question here than the write asks would put
  // a "new vendor" label on a row that is about to be overwritten.
  const slugs = rows.map((r: any) => r.slug).filter(Boolean);
  const existing = slugs.length
    ? await dbInstance.select().from(vendors).where(inArray(vendors.slug, slugs))
    : [];
  const bySlug = new Map<string, Record<string, unknown>>(
    existing.map((v: any) => [v.slug as string, v as Record<string, unknown>]),
  );

  return rows.map((row: any) => shapeCandidateReview(row, bySlug.get(row.slug) ?? null));
}

/**
 * Every catalogue row with its provenance, worst first.
 *
 * Ordered by how much is unresolved rather than alphabetically: the queue exists
 * to be worked through, and the 29 rows that resolved to nothing are the reason
 * it exists.
 */
export async function catalogueReviewRows(dbInstance: any, limit = 500): Promise<CatalogueReview[]> {
  const rows = await dbInstance
    .select()
    .from(vendors)
    .where(eq(vendors.isGlobal, true))
    .orderBy(desc(vendors.updatedAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const provenance = await dbInstance.select().from(vendorFieldProvenance);
  const byVendor = new Map<string, ProvenanceRow[]>();
  for (const row of provenance) {
    const list = byVendor.get(row.vendorId);
    if (list) list.push(row);
    else byVendor.set(row.vendorId, [row]);
  }

  const now = new Date();
  return rows
    .map((v: any) => shapeCatalogueReview(v, byVendor.get(v.id) ?? [], now))
    .sort((a: CatalogueReview, b: CatalogueReview) => b.unresolvedCount - a.unresolvedCount);
}

export interface ReviewSignal {
  kind: 'dpf_lapse' | 'rule_broken' | 'stale_field' | 'review_due';
  vendorId: string;
  vendorName: string;
  field?: string;
  title: string;
  detail: string;
  action?: string;
  date: string | null;
}

/**
 * Everything currently asking for a person's attention.
 *
 * Three sources, all reusing what already exists. The DPF half is the one worth
 * knowing about: `dpfLapseNotices` has been fixture-covered since Sprint 7 and
 * its only consumers were the questionnaire cross-check and, since Sprint 11, a
 * `console.warn` in the sync worker. This is the first surface a person reads it
 * on.
 */
export async function signalQueue(dbInstance: any): Promise<ReviewSignal[]> {
  const signals: ReviewSignal[] = [];
  const now = new Date();

  const catalogue = await dbInstance
    .select({
      id: vendors.id,
      name: vendors.name,
      legalEntityName: vendors.legalEntityName,
      website: vendors.website,
      headquartersCountry: vendors.headquartersCountry,
      transferMechanisms: vendors.transferMechanisms,
    })
    .from(vendors)
    .where(eq(vendors.isGlobal, true));

  const conditional: Array<{
    id: string;
    name: string;
    legalEntityName: string | null;
    website: string | null;
    headquartersCountry: string | null;
    transferMechanisms: string[] | null;
  }> = catalogue.filter((v: any) =>
    isRecipientConditional((v.headquartersCountry ?? '').toUpperCase()),
  );
  if (conditional.length > 0) {
    const matches = await resolveDpfStatusBatch(dbInstance, conditional);
    for (const notice of dpfLapseNotices(conditional, matches)) {
      signals.push({
        kind: 'dpf_lapse',
        vendorId: notice.vendorId,
        vendorName: notice.vendorName,
        title: notice.finding.title,
        detail: notice.finding.detail,
        action: notice.finding.action,
        date: notice.effectiveDate,
      });
    }
  }

  const nameById = new Map<string, string>(
    catalogue.map((v: any) => [v.id as string, v.name as string]),
  );

  /**
   * Rules that ran and stopped doing what they promised.
   *
   * The field they filled is now writing nothing at all, which is the designed
   * behaviour and also completely invisible: an absent field looks the same
   * whether nobody ever taught it or somebody taught it and the site moved. This
   * signal is the only thing that tells those apart, so without it the fail-loud
   * design would be a fail-silent one.
   */
  const brokenRules = await dbInstance
    .select()
    .from(vendorExtractionRules)
    .where(eq(vendorExtractionRules.status, 'broken'));

  for (const rule of brokenRules as any[]) {
    const vendorName = nameById.get(rule.vendorId) ?? 'Unknown vendor';
    const lastMatched = rule.lastMatchedAt
      ? new Date(rule.lastMatchedAt).toISOString().slice(0, 10)
      : null;
    const expected = (rule.locator as { expect?: string } | null)?.expect;

    signals.push({
      kind: 'rule_broken',
      vendorId: rule.vendorId,
      vendorName,
      field: rule.fieldName ?? undefined,
      title: `${vendorName}: the rule for ${rule.fieldName ?? rule.docType ?? 'this page'} no longer matches`,
      detail:
        (expected ? `It used to read "${expected}". ` : '') +
        `The page at ${rule.url ?? 'the taught URL'} has changed enough that the anchor ` +
        'no longer finds it, so the field is writing nothing rather than a guess. ' +
        (lastMatched ? `Last matched ${lastMatched}.` : 'It has never matched since it was taught.'),
      action: 'Open the page in the console and teach the value again, or delete the rule if the vendor stopped publishing it.',
      date: lastMatched,
    });
  }

  const provenance = await dbInstance
    .select()
    .from(vendorFieldProvenance)
    .where(isNotNull(vendorFieldProvenance.retrievedAt));

  for (const row of provenance as ProvenanceRow[] & Array<any>) {
    const age = provenanceAge(row, now);
    const vendorName = nameById.get(row.vendorId) ?? 'Unknown vendor';

    if (age.reviewOverdue) {
      signals.push({
        kind: 'review_due',
        vendorId: row.vendorId,
        vendorName,
        field: row.fieldName,
        title: `${vendorName}: ${row.fieldName} was due a re-read`,
        detail:
          'A named person undertook to check this again by the date below. That is what an ' +
          'analyst row promises, and it is the only tier that expires on a commitment rather ' +
          'than on a curve.',
        date: row.reviewBy ? new Date(row.reviewBy).toISOString().slice(0, 10) : null,
      });
    } else if (age.stale) {
      signals.push({
        kind: 'stale_field',
        vendorId: row.vendorId,
        vendorName,
        field: row.fieldName,
        title: `${vendorName}: ${row.fieldName} has decayed to its floor`,
        detail:
          `Sourced from ${row.sourceType} and not re-confirmed since. The document may still ` +
          'be there and may say something else; nothing has looked.',
        date: row.retrievedAt ? new Date(row.retrievedAt).toISOString().slice(0, 10) : null,
      });
    }
  }

  // Lapses first — a missing Chapter V safeguard outranks everything else — then
  // rules the reviewer taught that stopped working, then undertakings that came
  // due, then plain decay. A broken rule sits above a stale field because
  // somebody deliberately taught it and is entitled to know it stopped; a stale
  // field is only the ordinary passage of time.
  const order: Record<ReviewSignal['kind'], number> = {
    dpf_lapse: 0,
    rule_broken: 1,
    review_due: 2,
    stale_field: 3,
  };
  return signals.sort((a, b) => order[a.kind] - order[b.kind] || a.vendorName.localeCompare(b.vendorName));
}


/**
 * The pages a run stored for one vendor or candidate, newest first.
 *
 * This is what makes a verdict auditable and a rule teachable. Before it, the
 * console could show that a field came back absent and not why — and "why" is
 * eleven URLs tried, three of them 404, one blocked by robots.txt and one a
 * marketing page that nearly verified.
 */
export async function probeDocumentsFor(
  dbInstance: any,
  parent: { vendorId?: string; candidateId?: string },
): Promise<Array<Record<string, unknown>>> {
  const where = parent.candidateId
    ? eq(vendorProbeDocuments.candidateId, parent.candidateId)
    : parent.vendorId
      ? eq(vendorProbeDocuments.vendorId, parent.vendorId)
      : null;
  if (!where) return [];

  return dbInstance
    .select()
    .from(vendorProbeDocuments)
    .where(where)
    .orderBy(desc(vendorProbeDocuments.fetchedAt));
}

/** Every rule taught about one vendor, whatever its status. */
export async function rulesFor(
  dbInstance: any,
  vendorId: string,
): Promise<Array<Record<string, unknown>>> {
  return dbInstance
    .select()
    .from(vendorExtractionRules)
    .where(eq(vendorExtractionRules.vendorId, vendorId))
    .orderBy(desc(vendorExtractionRules.authoredAt));
}

/** Re-exported so the console reaches into one module for one screen. */
export { CORRECTABLE_FIELDS };
