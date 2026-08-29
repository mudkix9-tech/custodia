/**
 * Sprint 2 worker — the pipeline's recurring work (audit P-1, P-5).
 *
 * Two jobs on the vendor-intelligence queue:
 *
 *   vendor-intelligence-enrich  — runs a batch enrichment. Created by the
 *     intelligence router with the target list and run id in its payload;
 *     `runEnrichBatch` checkpoints per target so a killed worker resumes at
 *     `vendor_intelligence_runs.cursor` rather than paying for completed
 *     targets again.
 *
 *   reverify-vendor — re-probes one catalogue row and stamps its freshness.
 *
 * The DPF registry import used to be a third branch here. It moved to
 * `workers/dpfRegistry.ts` in Sprint 7, on its own queue, because pg-boss keys
 * schedules by queue name and this queue already had one — see that file.
 */
import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import {
  vendors,
  organizationVendors,
  vendorIntelligenceRuns,
} from 'db';
import { eq, and, gt, isNull, or, sql } from 'drizzle-orm';
import { runEnrichBatch, reverifyVendor, type EnrichTarget } from '../lib/vendorIntelligence.js';
import { recalculateVendorRiskForAllOrgs } from '../routers/vendors.js';

export const vendorIntelligenceQueue = createQueue('vendor-intelligence');

export const vendorIntelligenceWorker = createWorker(
  'vendor-intelligence',
  async (job: any) => {
    switch (job.name) {
      case 'enrich-batch': {
        const { runId } = job.data;
        if (!runId) throw new Error('enrich-batch requires runId');
        const [run] = await db.select().from(vendorIntelligenceRuns).where(eq(vendorIntelligenceRuns.id, runId));
        if (!run) throw new Error(`Run ${runId} not found`);

        // Resume from the checkpoint: everything before `cursor` is done.
        const startAt = run.cursor ?? 0;
        const targets = ((run.targets as EnrichTarget[] | null) ?? []).slice(startAt);

        // A single-target run whose only target already succeeded must not
        // re-run: mark complete immediately.
        if (targets.length === 0) {
          await db
            .update(vendorIntelligenceRuns)
            .set({ status: 'completed', finishedAt: new Date() })
            .where(eq(vendorIntelligenceRuns.id, runId));
          break;
        }

        try {
          await runEnrichBatch(runId, targets);
          // runEnrichBatch marks the run completed itself.
        } catch (err) {
          // runEnrichBatch already recorded the failure on the run row; the
          // throw tells pg-boss to retry, and the cursor makes that cheap.
          throw err;
        }
        break;
      }

      case 'reverify-vendor': {
        const { vendorId } = job.data;
        const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
        if (!vendor) break;

        const outcome = await reverifyVendor({ id: vendor.id, name: vendor.name, website: vendor.website });

        // Stamp freshness regardless of outcome; the diff lands wherever the
        // caller asked for it.
        await db
          .update(vendors)
          .set({ lastVerifiedAt: new Date(), verifiedBy: 'pipeline:reverify' })
          .where(eq(vendors.id, vendor.id));

        void outcome;
        break;
      }

      default:
        console.warn(`[Vendor Intelligence Worker] Unknown job: ${job.name}`);
    }
  },
  { drainDelay: 15 },
);

if (vendorIntelligenceWorker) {
  vendorIntelligenceWorker.on('failed', (job: any, err: Error) => {
    console.error(`[Vendor Intelligence Worker] Job ${job?.id ?? '?'} failed:`, err.message);
  });
}
