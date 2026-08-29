/**
 * Freshness and precedence for catalogue evidence — Sprint 10, VD-19 and VD-20.
 *
 * `vendor_field_provenance` has stored `retrieved_at` since Sprint 5 and nothing
 * has ever read it. A DPA probed and verified in March therefore renders 90 in
 * December, in the same colour it did on the day somebody fetched the document,
 * against a URL that may since have 404'd. That is the whole of VD-19: the
 * number is a measurement with a date on it, and the product was showing the
 * measurement without the date.
 *
 * **Decay is computed here, at read time, and never written back.** A background
 * pass that re-scored rows would be a bulk write to a *shared* catalogue on a
 * timer, which is the mistake the ROPA register already learned not to make with
 * `updated_at` (D1/D45). It would also be lossy: `confidence` is what the
 * evidence was worth when it was gathered, and overwriting it destroys the only
 * number a re-probe can be compared against.
 *
 * This file is pure and imports no database, so `test:vendors` can reach it.
 */
import { VENDOR_SOURCE_TYPES, type VendorSourceType } from './vendorFieldConfidence.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How each tier ages, and why the rates differ.
 *
 * `halfLifeDays` is the interval over which an unrefreshed value loses half the
 * distance between what it was worth and its floor. `floor` is what it can never
 * fall below, because the evidence did exist and somebody did look — an aged
 * probe is weaker than a fresh one, not equivalent to never having asked.
 */
export interface ProvenanceDecayRule {
  halfLifeDays: number | null;
  floor: number;
}

export const PROVENANCE_DECAY: Readonly<Record<VendorSourceType, ProvenanceDecayRule>> = {
  /**
   * Slowly, because the feed re-confirms it. `dpf-registry-sync` runs weekly and
   * rewrites `fetched_at` on all 16,520 rows, so a registry-sourced field that
   * is genuinely old is one the sync has stopped reaching — a condition worth
   * surfacing eventually and not on the same clock as a document nobody has
   * re-fetched.
   */
  registry: { halfLifeDays: 1825, floor: 60 },
  /**
   * The rate the sprint plan names. A vendor's published DPA is a live document
   * on a URL that can move, and six months is roughly the cadence at which
   * legal pages get restructured.
   */
  http_probe: { halfLifeDays: 180, floor: 30 },
  /**
   * The same fetch cadence as a probe, from a lower ceiling: a portal badge tops
   * out at 75 because it evidences that the portal renders a badge, not what the
   * report behind it says. Its floor sits below the probe's for the same reason.
   */
  trust_centre: { halfLifeDays: 180, floor: 20 },
  /**
   * A named human does not decay on a curve — they decay on a date. An analyst
   * row carries `review_by`, and before that date it is worth exactly what it
   * was worth. After it, it drops to the floor in one step, because "this needed
   * re-reading three months ago" is not a gradual condition.
   */
  analyst: { halfLifeDays: null, floor: 40 },
  /**
   * A tenant's own executed contract does not get less true with time. Where it
   * expires, that is a date on the contract (`organization_vendors.dpa_expires_at`)
   * and a different finding — not a decay curve over our confidence in it.
   */
  customer: { halfLifeDays: null, floor: 95 },
};

export interface ProvenanceRow {
  fieldName: string;
  value?: unknown;
  sourceType: string;
  sourceUrl?: string | null;
  confidence: number;
  evidenceSnippet?: string | null;
  retrievedAt: Date | string;
  verifiedBy?: string | null;
  verifiedAt?: Date | string | null;
  /** Analyst rows only: when the finding must be read again. */
  reviewBy?: Date | string | null;
}

export interface ProvenanceAge {
  /** Confidence as of `now`, floored. Never written back to the row. */
  confidence: number;
  /** What the row was worth when it was gathered. */
  originalConfidence: number;
  ageDays: number;
  /**
   * At or below the floor, so the surface must show *when* rather than a bare
   * value: "last verified 3 March" instead of "90".
   */
  stale: boolean;
  /** True once an analyst row is past its `review_by`. */
  reviewOverdue: boolean;
  sourceType: VendorSourceType;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSourceType(value: string): value is VendorSourceType {
  return (VENDOR_SOURCE_TYPES as readonly string[]).includes(value);
}

/**
 * What a stored provenance row is worth today.
 *
 * An unrecognised `source_type` is treated as the fastest-decaying tier rather
 * than being trusted at face value. The vocabulary is closed (VD-2) and the only
 * way an unknown value reaches this function is a row written before it closed
 * or by something outside it — neither of which is a reason for confidence.
 */
export function provenanceAge(row: ProvenanceRow, now: Date = new Date()): ProvenanceAge {
  const sourceType: VendorSourceType = isSourceType(row.sourceType) ? row.sourceType : 'trust_centre';
  const rule = PROVENANCE_DECAY[sourceType];
  const retrieved = toDate(row.retrievedAt);
  const original = Math.max(0, Math.min(100, row.confidence));

  // No usable date is the same problem as a very old one: we cannot say the
  // value is current, so we do not.
  if (!retrieved) {
    return {
      confidence: rule.floor,
      originalConfidence: original,
      ageDays: Number.POSITIVE_INFINITY,
      stale: true,
      reviewOverdue: false,
      sourceType,
    };
  }

  const ageDays = Math.max(0, (now.getTime() - retrieved.getTime()) / DAY_MS);

  if (sourceType === 'analyst') {
    const reviewBy = toDate(row.reviewBy);
    const overdue = reviewBy !== null && now.getTime() >= reviewBy.getTime();
    const confidence = overdue ? Math.min(original, rule.floor) : original;
    return {
      confidence,
      originalConfidence: original,
      ageDays,
      // An analyst row with no `review_by` never goes stale on its own. That is
      // deliberate and it is VD-20's other half: the review date is part of
      // writing the finding, and a surface that quietly aged it would let the
      // omission pass as a decision.
      stale: overdue,
      reviewOverdue: overdue,
      sourceType,
    };
  }

  if (rule.halfLifeDays === null) {
    return {
      confidence: Math.max(original, rule.floor),
      originalConfidence: original,
      ageDays,
      stale: false,
      reviewOverdue: false,
      sourceType,
    };
  }

  // Halve the distance to the floor, not the value: a probe worth 90 with a
  // floor of 30 is worth 60 after one half-life, not 45. The floor is what the
  // evidence is worth for having existed at all, and decaying through it would
  // make an aged probe indistinguishable from a field nobody ever looked at.
  const decayed = rule.floor + (original - rule.floor) * Math.pow(0.5, ageDays / rule.halfLifeDays);
  const confidence = Math.round(Math.max(rule.floor, Math.min(original, decayed)));

  return {
    confidence,
    originalConfidence: original,
    ageDays,
    // Within a point of the floor is at the floor for display purposes — the
    // curve is asymptotic and would otherwise never quite say so.
    stale: confidence <= rule.floor + 1,
    reviewOverdue: false,
    sourceType,
  };
}

/**
 * Precedence between tiers for one field — VD-20.
 *
 * Higher wins. This is **not** the confidence ordering and must not be derived
 * from it: `registry` scores 95 and `analyst` scores 90, yet an analyst row
 * supersedes a registry one, because a human who read the document and recorded
 * an excerpt is the correction mechanism for a registry that is wrong about a
 * company. Without that, a catalogue error sourced from an official feed would
 * be uncorrectable by any means the product offers.
 *
 * `customer` sits highest and is the reason `selectAuthoritativeProvenance`
 * takes a scope: a tenant's executed contract is authoritative for that tenant
 * and is not evidence about the vendor in general, so it must never be consulted
 * when resolving the shared catalogue row.
 */
export const PROVENANCE_PRECEDENCE: Readonly<Record<VendorSourceType, number>> = {
  customer: 5,
  analyst: 4,
  registry: 3,
  http_probe: 2,
  trust_centre: 1,
};

/** Only a named human may write this tier, and only with an excerpt (VD-20). */
export function isAnalystWritable(sourceType: string): boolean {
  return sourceType === 'analyst';
}

/**
 * Everything an analyst correction must carry before it may be stored.
 *
 * Returned as a list rather than a boolean because the caller shows them, and
 * because "which of these is missing" is the difference between a correction a
 * reviewer can act on and one that is itself an unsourced assertion — the thing
 * this whole programme exists to keep out of the catalogue.
 */
export function validateAnalystCorrection(input: {
  fieldName?: string | null;
  value?: unknown;
  verifiedBy?: string | null;
  evidenceSnippet?: string | null;
  sourceUrl?: string | null;
  reviewBy?: Date | string | null;
}): string[] {
  const problems: string[] = [];
  if (!input.fieldName?.trim()) problems.push('a field name is required');
  if (input.value === undefined || input.value === null || input.value === '') {
    problems.push('a value is required — to remove a field, delete its provenance row instead');
  }
  if (!input.verifiedBy?.trim()) problems.push('verified_by is required: a correction is attributable or it is not a correction');
  const excerpt = input.evidenceSnippet?.trim() ?? '';
  if (excerpt.length < 20) {
    problems.push('an excerpt of at least 20 characters is required — the sentence in the document that says so');
  }
  if (!input.sourceUrl?.trim()) problems.push('a source URL is required: where the excerpt was read');
  if (!toDate(input.reviewBy)) {
    problems.push('review_by is required: an analyst finding that never falls due never gets re-read');
  }
  return problems;
}

export interface ResolvedField {
  fieldName: string;
  row: ProvenanceRow;
  age: ProvenanceAge;
  /** Rows this one supersedes, newest first. Kept so a surface can show them. */
  superseded: ProvenanceRow[];
}

/**
 * Which row answers for each field.
 *
 * `scope: 'catalogue'` drops `customer` rows entirely rather than ranking them
 * last — a tenant's private contract is not weak evidence about the vendor, it
 * is evidence about a different thing, and letting it lose on precedence would
 * still leave it one deletion away from winning.
 *
 * Ties break on `retrieved_at`, newest first: two probes of the same field are
 * the same tier and the later one is the current state of the document.
 */
export function selectAuthoritativeProvenance(
  rows: readonly ProvenanceRow[],
  options: { scope?: 'catalogue' | 'tenant'; now?: Date } = {},
): ResolvedField[] {
  const scope = options.scope ?? 'catalogue';
  const now = options.now ?? new Date();

  const eligible = rows.filter((r) => (scope === 'catalogue' ? r.sourceType !== 'customer' : true));

  const byField = new Map<string, ProvenanceRow[]>();
  for (const row of eligible) {
    const list = byField.get(row.fieldName);
    if (list) list.push(row);
    else byField.set(row.fieldName, [row]);
  }

  const out: ResolvedField[] = [];
  for (const [fieldName, candidates] of byField) {
    const ranked = [...candidates].sort((a, b) => {
      const at = isSourceType(a.sourceType) ? PROVENANCE_PRECEDENCE[a.sourceType] : 0;
      const bt = isSourceType(b.sourceType) ? PROVENANCE_PRECEDENCE[b.sourceType] : 0;
      if (at !== bt) return bt - at;
      const ad = toDate(a.retrievedAt)?.getTime() ?? 0;
      const bd = toDate(b.retrievedAt)?.getTime() ?? 0;
      return bd - ad;
    });
    const winner = ranked[0]!;
    out.push({
      fieldName,
      row: winner,
      age: provenanceAge(winner, now),
      superseded: ranked.slice(1),
    });
  }

  return out.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
}
