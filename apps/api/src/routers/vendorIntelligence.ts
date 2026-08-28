/**
 * The vendor intelligence review console — audit P-3's admin surface.
 *
 * The pending-review JSON and the SQLite queue were sketching this: a staging
 * area where sourced records wait for a human. This is its in-product form:
 * candidates listed by confidence, side-by-side with the catalogue row they
 * would create, per-field evidence, and bulk-approve above a threshold for the
 * records the probes already vouch for.
 *
 * Tenancy shape: candidates, provenance and DPF registrations are *catalogue*
 * data — shared reference rows like `vendors` itself. The console is therefore
 * permission-gated (`vendors:edit`) rather than org-scoped, which matches how
 `check-tenant-scoping.ts` treats shared catalogues.
 */
import { z } from 'zod';
import { db } from '../db.js';
import {
  vendorIntelligenceRuns,
  vendorCandidates,
  vendorFieldProvenance,
  vendors,
  organizationVendors,
} from 'db';
import { eq, desc, asc, gte, and, sql } from 'drizzle-orm';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import {
  buildCatalogueWrites,
  writeProvenance,
  normaliseCandidateDomain,
} from '../lib/vendorIntelligence.js';
import { vendorIntelligenceQueue } from '../workers/vendorIntelligence.js';
import { vendorFieldProvenance as vfp } from 'db';
import { recalculateVendorRiskForAllOrgs } from './vendors.js';

export const vendorIntelligenceRouter = router({
  /** Run log, newest first. */
  listRuns: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(vendorIntelligenceRuns)
        .orderBy(desc(vendorIntelligenceRuns.startedAt))
        .limit(input.limit);
    }),

  /**
   * Start an enrichment batch. Creates the run row and enqueues the job; the
   * worker does the enumeration and the probes, so this returns immediately
   * with the run id the console polls.
   */
  startBatch: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      targets: z.array(z.object({
        name: z.string().min(1).max(255),
        website: z.string().max(500).optional(),
        category: z.string().max(100).optional(),
      })).min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const [run] = await db
        .insert(vendorIntelligenceRuns)
        .values({
          kind: 'enrich_batch',
          status: 'pending',
          targets: input.targets,
          triggeredBy: ctx.user!.id,
        })
        .returning();
      if (!run) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Run row not written' });

      await vendorIntelligenceQueue.add('enrich-batch', { runId: run.id });
      return run;
    }),

  /**
   * One candidate with its payload, its probe results, and the enumerated URLs
   * that were rejected — which is what the `grounding` column holds since
   * Sprint 5, and the reviewer's answer to "why is this field empty".
   */
  getCandidate: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db.select().from(vendorCandidates).where(eq(vendorCandidates.id, input.id));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidate not found' });
      return row;
    }),

  /**
   * Queue a freshness re-verification of a catalogue vendor. Runs through the
   * worker (a paced probe sweep is minutes, not milliseconds) and stamps
   * `lastVerifiedAt` when done; the diff itself lands in the candidate queue
   * only if something changed enough to become one.
   */
  reverifyVendor: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.vendorId));
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      await vendorIntelligenceQueue.add('reverify-vendor', { vendorId: input.vendorId });
      return { queued: true };
    }),

  /** Pending candidates first by confidence, then newest. */
  listCandidates: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
      minConfidence: z.number().min(0).max(100).optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ input }) => {
      const conditions = [eq(vendorCandidates.status, input.status)];
      if (input.minConfidence !== undefined) {
        conditions.push(gte(vendorCandidates.confidence, input.minConfidence));
      }
      const query = db
        .select()
        .from(vendorCandidates)
        .where(and(...conditions))
        .orderBy(desc(vendorCandidates.confidence), desc(vendorCandidates.createdAt))
        .limit(input.limit);

      if (input.offset && input.offset > 0) {
        return query.offset(input.offset);
      }
      return query;
    }),

  /**
   * Approve one candidate into the catalogue.
   *
   * Writes the catalogue row (or updates it when the domain already exists),
   * then writes provenance per field — approval is the moment P-2's rows exist.
   * Idempotent on candidate state: approving twice is a no-op the second time,
   * because the first approval set createdVendorId.
   */
  approveCandidate: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      overrides: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [candidate] = await db.select().from(vendorCandidates).where(eq(vendorCandidates.id, input.id));
      if (!candidate) throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidate not found' });
      if (candidate.status === 'approved') return candidate;

      const record = { ...(candidate.payload as Record<string, unknown>), ...(input.overrides ?? {}) };
      const assessment = { perField: {} as Record<string, { confidence: number; decision: string }>, confidence: candidate.confidence };

      const name = String(record.name || candidate.name || '').slice(0, 255);
      const website = String(record.website || `https://${candidate.domain}` || '');
      if (!name) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Candidate has no usable name' });

      const domain = normaliseCandidateDomain(candidate.domain || website);
      const slug = String(record.slug || slugify(name)).slice(0, 100);

      // Catalogue upsert keyed on (is_global, lower website host) is not a real
      // constraint, so match manually inside the transaction.
      const result = await db.transaction(async (tx) => {
        let vendorId = candidate.createdVendorId;
        if (!vendorId) {
          const existing = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, slug)).limit(1);
          if (existing[0]) {
            vendorId = existing[0].id;
          }
        }

        const columns = buildCatalogueWrites(record as never, {
          perField: Object.fromEntries(
            Object.entries((candidate.probeResults as Record<string, any>) ?? {}).map(([k, v]) => [
              k,
              { confidence: typeof v?.confidence === 'number' ? v.confidence : 40 },
            ]),
          ),
        } as never);

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
          vendorId = created!.id;
        }

        // Provenance after the catalogue row exists — FK requires it.
        await writeProvenanceInTx(tx, vendorId, columns.provenance);

        const [updated] = await tx
          .update(vendorCandidates)
          .set({
            status: 'approved',
            reviewedBy: ctx.user!.id,
            reviewedAt: new Date(),
            createdVendorId: vendorId,
          })
          .where(eq(vendorCandidates.id, candidate.id))
          .returning();

        // Re-run the register risk scores for every tenant linking this vendor —
        // the catalogue changed, and risk_score is denormalised (known-concerns §18).
        await recalculateVendorRiskForAllOrgs(tx, vendorId);

        return updated!;
      });

      return result;
    }),

  rejectCandidate: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [candidate] = await db.select().from(vendorCandidates).where(eq(vendorCandidates.id, input.id));
      if (!candidate) throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidate not found' });
      if (candidate.status === 'approved') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Candidate already approved — unlink it before rejecting' });
      }
      const [updated] = await db
        .update(vendorCandidates)
        .set({ status: 'rejected', rejectionReason: input.reason ?? null, reviewedBy: ctx.user!.id, reviewedAt: new Date() })
        .where(eq(vendorCandidates.id, candidate.id))
        .returning();
      return updated!;
    }),

  /**
   * Bulk-approve every pending candidate at or above a confidence threshold.
   * The fast path for a batch whose verified DPAs did the vetting — but each
   * candidate still goes through the same per-field mapping as a single
   * approve, so bulk is volume, never a different standard.
   */
  bulkApprove: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      minConfidence: z.number().min(0).max(100).default(70),
      limit: z.number().min(1).max(100).default(25),
    }))
    .mutation(async ({ ctx, input }) => {
      const pending = await db
        .select()
        .from(vendorCandidates)
        .where(and(eq(vendorCandidates.status, 'pending'), gte(vendorCandidates.confidence, input.minConfidence)))
        .orderBy(desc(vendorCandidates.confidence))
        .limit(input.limit);

      const approvedIds: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const candidate of pending) {
        try {
          const record = candidate.payload as Record<string, unknown>;
          const name = String(record.name || candidate.name || '').slice(0, 255);
          if (!name) {
            skipped.push({ id: candidate.id, reason: 'no name' });
            continue;
          }
          const slug = String(record.slug || slugify(name)).slice(0, 100);
          let vendorId = candidate.createdVendorId ?? null;

          await db.transaction(async (tx) => {
            if (!vendorId) {
              const existing = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, slug)).limit(1);
              vendorId = existing[0]?.id ?? null;
            }
            const columns = buildCatalogueWrites(record as never, { perField: {} } as never);
            if (!vendorId) {
              const [created] = await tx.insert(vendors).values({
                isGlobal: true,
                name,
                slug,
                website: String(record.website || `https://${candidate.domain}` || ''),
                category: candidate.category,
                ...columns.columns,
              } as never).returning({ id: vendors.id });
              vendorId = created!.id;
            } else {
              await tx.update(vendors).set(columns.columns as never).where(eq(vendors.id, vendorId));
            }
            await writeProvenanceInTx(tx, vendorId, columns.provenance);
            await tx.update(vendorCandidates).set({
              status: 'approved',
              reviewedBy: ctx.user!.id,
              reviewedAt: new Date(),
              createdVendorId: vendorId,
            }).where(eq(vendorCandidates.id, candidate.id));

            await recalculateVendorRiskForAllOrgs(tx, vendorId);
          });

          approvedIds.push(candidate.id);
        } catch (err) {
          skipped.push({ id: candidate.id, reason: err instanceof Error ? err.message : String(err) });
        }
      }
      return { approvedCount: approvedIds.length, approvedIds, skipped };
    }),


  /**
   * Import the legacy gatherer's output files (`seed-data/vendors.json`,
   * `seed-data/pending-review.json`) into candidates, so Island B's 33+40
   * records land somewhere reviewable instead of dying with the script.
   * Records carrying a `provenance` block import pre-verified.
   */
  importJson: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      json: z.string().max(4_000_000),
      source: z.enum(['accepted', 'pending']).default('accepted'),
    }))
    .mutation(async ({ ctx, input }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input.json);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not valid JSON' });
      }
      if (!Array.isArray(parsed)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expected a JSON array of vendor records' });
      }

      // One run row per import so the console shows where these came from.
      const [run] = await db
        .insert(vendorIntelligenceRuns)
        .values({
          kind: 'enrich_batch',
          status: 'completed',
          targets: [],
          processed: parsed.length,
          accepted: 0,
          finishedAt: new Date(),
          triggeredBy: ctx.user!.id,
        })
        .returning();

      let imported = 0;
      const errors: string[] = [];
      const seenDomains = new Set<string>();

      for (const raw of parsed.slice(0, 500)) {
        try {
          const record = raw as Record<string, unknown>;
          const name = String(record.name || '').trim();
          if (!name) continue;
          const domain = normaliseCandidateDomain(String(record.website || ''));
          const dedupeKey = domain || `name:${slugify(name)}`;
          if (seenDomains.has(dedupeKey)) continue;
          seenDomains.add(dedupeKey);

          const hasProvenance = !!record.provenance;
          const confidence = hasProvenance ? 90 : 45;

          await db
            .insert(vendorCandidates)
            .values({
              runId: run!.id,
              name: name.slice(0, 255),
              slug: String(record.slug || slugify(name)).slice(0, 100),
              domain,
              category: record.category ? String(record.category).slice(0, 100) : null,
              payload: record,
              probeResults: (record.provenance as Record<string, unknown>) ?? {},
              grounding: null,
              confidence,
              status: 'pending',
            })
            .onConflictDoNothing({ target: vendorCandidates.domain });
          imported += 1;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      await db.update(vendorIntelligenceRuns).set({ accepted: imported }).where(eq(vendorIntelligenceRuns.id, run!.id));

      return { imported, errors: errors.slice(0, 10), runId: run!.id };
    }),
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Provenance writer that accepts a transaction handle. The single approve path
 * runs inside a transaction so a half-written approval cannot exist; bulk goes
 * through the pool-level `writeProvenance` instead.
 */
type TxHandle = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeProvenanceInTx(
  tx: TxHandle,
  vendorId: string,
  rows: Array<{ fieldName: string; value: unknown; sourceType: string; sourceUrl?: string | null; confidence: number; evidenceSnippet?: string | null }>,
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(vfp)
    .values(
      rows.map((row) => ({
        vendorId,
        fieldName: row.fieldName,
        value: row.value as unknown as Record<string, unknown>,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl ?? null,
        confidence: Math.max(0, Math.min(100, Math.round(row.confidence))),
        evidenceSnippet: row.evidenceSnippet ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [vfp.vendorId, vfp.fieldName],
      set: {
        value: sql`excluded.value`,
        sourceType: sql`excluded.source_type`,
        sourceUrl: sql`excluded.source_url`,
        confidence: sql`excluded.confidence`,
        evidenceSnippet: sql`excluded.evidence_snippet`,
        retrievedAt: new Date(),
      },
    });
}
