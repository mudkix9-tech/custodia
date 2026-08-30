/**
 * Approving and rejecting staged candidates, as functions rather than as tRPC
 * procedure bodies.
 *
 * **Why this file exists.** The operator console runs locally, off the network,
 * and writes the same shared catalogue the tRPC router does. If it reimplemented
 * approval it would be a second copy of a write path that has to get five things
 * right in one transaction — find-or-create the vendor, map the columns, write
 * provenance, flip the candidate, re-score every tenant linked to it. That is
 * VD-7 one level up, and VD-7's cost is not that the copies are wrong on the day
 * they are written: it is that one of them gets fixed later.
 *
 * The router and the console both call these. Neither owns the logic.
 *
 * Extracting it also collapsed the duplication that was already here:
 * `approveCandidate` and `bulkApprove` carried the same transaction body twice,
 * and they had already drifted — the bulk path passed an empty per-field
 * assessment where the single path passed the probe confidences. `bulkApprove`
 * is now a loop over `approveCandidate`, which is what its own comment always
 * claimed it was ("bulk is volume, never a different standard").
 */
import { eq, and, gte, desc } from 'drizzle-orm';
import { vendorCandidates, vendors } from 'db';
import {
  buildCatalogueWrites,
  writeProvenance,
  normaliseCandidateDomain,
} from './vendorIntelligence.js';

/** Slug fold. Kept identical to the router's, which is where it came from. */
export function slugifyVendorName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export class CandidateReviewError extends Error {
  constructor(
    message: string,
    readonly kind: 'not_found' | 'bad_request',
  ) {
    super(message);
    this.name = 'CandidateReviewError';
  }
}

export interface ApproveCandidateInput {
  db: any;
  candidateId: string;
  /** The reviewer's per-field edits, merged over the sourced payload. */
  overrides?: Record<string, unknown>;
  /** Attribution. A `users.id`; the console supplies the operator's own. */
  reviewerId: string | null;
}

/**
 * Approve one candidate into the catalogue.
 *
 * Writes the catalogue row (or updates it where the slug already exists), then
 * writes provenance per field — approval is the moment those rows exist.
 * Idempotent on candidate state: approving twice is a no-op the second time,
 * because the first approval set `createdVendorId`.
 */
export async function approveCandidate(input: ApproveCandidateInput) {
  const { db: dbInstance, candidateId, overrides, reviewerId } = input;

  const [candidate] = await dbInstance
    .select()
    .from(vendorCandidates)
    .where(eq(vendorCandidates.id, candidateId));
  if (!candidate) throw new CandidateReviewError('Candidate not found', 'not_found');
  if (candidate.status === 'approved') return candidate;

  const record = { ...(candidate.payload as Record<string, unknown>), ...(overrides ?? {}) };

  const name = String(record.name || candidate.name || '').slice(0, 255);
  if (!name) throw new CandidateReviewError('Candidate has no usable name', 'bad_request');
  const website = String(record.website || `https://${candidate.domain}` || '');

  // Referenced for its side effect on the record only; the catalogue upsert
  // matches on slug because (is_global, website host) is not a real constraint.
  normaliseCandidateDomain(candidate.domain || website);
  const slug = String(record.slug || slugifyVendorName(name)).slice(0, 100);

  return dbInstance.transaction(async (tx: any) => {
    let vendorId: string | null = candidate.createdVendorId;
    if (!vendorId) {
      const existing = await tx
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.slug, slug))
        .limit(1);
      vendorId = existing[0]?.id ?? null;
    }

    // Which fields came from a taught rule, and the page each was read from.
    // Without this the five Chapter V fields stay sourceless and therefore
    // unwritten even when a rule filled them: the rule would have run, matched,
    // and been discarded at the last step — indistinguishable from the outside
    // from a rule that never matched at all.
    const taught = Object.fromEntries(
      Object.entries((candidate.probeResults as Record<string, any>) ?? {})
        .filter(([, v]) => typeof v?.taughtFrom === 'string')
        .map(([field, v]) => [field, { url: v.taughtFrom as string }]),
    );

    const columns = buildCatalogueWrites(
      record as never,
      {
        // A probe result with no number of its own contributes nothing rather
        // than a synthesised 40. That 40 was the model tier's score, deleted
        // from `fieldConfidence` in Sprint 5 along with the tier it named.
        // Dropping the entry hands the decision to `buildCatalogueWrites`, whose
        // documented fallback is the `partially_probed` ceiling — a URL we hold
        // and have not re-probed, which is what this actually is.
        perField: Object.fromEntries(
          Object.entries((candidate.probeResults as Record<string, any>) ?? {})
            .filter(([, v]) => typeof v?.confidence === 'number')
            .map(([k, v]) => [k, { confidence: v.confidence as number }]),
        ),
      } as never,
      taught,
    );

    if (vendorId) {
      await tx.update(vendors).set(columns.columns as never).where(eq(vendors.id, vendorId));
    } else {
      const [created] = await tx
        .insert(vendors)
        .values({
          isGlobal: true,
          name,
          slug,
          website,
          category: candidate.category,
          ...columns.columns,
        } as never)
        .returning({ id: vendors.id });
      vendorId = created!.id as string;
    }

    // Provenance after the catalogue row exists — the FK requires it.
    await writeProvenance(vendorId!, columns.provenance, tx);

    const [updated] = await tx
      .update(vendorCandidates)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        createdVendorId: vendorId,
      })
      .where(eq(vendorCandidates.id, candidate.id))
      .returning();

    // Re-score every tenant linking this vendor: the catalogue changed and
    // `organization_vendors.risk_score` is denormalised (known-concerns §18).
    const { recalculateVendorRiskForAllOrgs } = await import('../routers/vendors.js');
    await recalculateVendorRiskForAllOrgs(tx, vendorId!);

    return updated!;
  });
}

export interface RejectCandidateInput {
  db: any;
  candidateId: string;
  reason?: string | null;
  reviewerId: string | null;
}

export async function rejectCandidate(input: RejectCandidateInput) {
  const { db: dbInstance, candidateId, reason, reviewerId } = input;

  const [candidate] = await dbInstance
    .select()
    .from(vendorCandidates)
    .where(eq(vendorCandidates.id, candidateId));
  if (!candidate) throw new CandidateReviewError('Candidate not found', 'not_found');
  if (candidate.status === 'approved') {
    throw new CandidateReviewError(
      'Candidate already approved — unlink it before rejecting',
      'bad_request',
    );
  }

  const [updated] = await dbInstance
    .update(vendorCandidates)
    .set({
      status: 'rejected',
      rejectionReason: reason ?? null,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(vendorCandidates.id, candidate.id))
    .returning();
  return updated!;
}

export interface BulkApproveInput {
  db: any;
  minConfidence: number;
  limit: number;
  reviewerId: string | null;
}

/**
 * Approve every pending candidate at or above a confidence threshold.
 *
 * A loop over `approveCandidate`, so bulk really is volume rather than a
 * different standard. It was not: the previous bulk path passed an empty
 * per-field assessment, so every field it wrote fell to the unprobed ceiling
 * even where a probe had verified it.
 *
 * One caveat this does not fix, because it is not this function's to fix:
 * `minConfidence` reads the candidate's stored `confidence`, which since Sprint
 * 5 means "how sure of what we assert" rather than "how much we know" — see
 * known-concerns §20.
 */
export async function bulkApproveCandidates(input: BulkApproveInput) {
  const { db: dbInstance, minConfidence, limit, reviewerId } = input;

  const pending = await dbInstance
    .select({ id: vendorCandidates.id })
    .from(vendorCandidates)
    .where(
      and(
        eq(vendorCandidates.status, 'pending'),
        gte(vendorCandidates.confidence, minConfidence),
      ),
    )
    .orderBy(desc(vendorCandidates.confidence))
    .limit(limit);

  const approvedIds: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const row of pending) {
    try {
      await approveCandidate({ db: dbInstance, candidateId: row.id, reviewerId });
      approvedIds.push(row.id);
    } catch (err) {
      skipped.push({ id: row.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { approvedCount: approvedIds.length, approvedIds, skipped };
}
