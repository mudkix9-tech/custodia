/**
 * Sprint 2 worker — the pipeline's recurring work (audit P-1, P-5).
 *
 * Two jobs on the vendor-intelligence queue, plus the DPF import schedule:
 *
 *   vendor-intelligence-enrich  — runs a batch enrichment. Created by the
 *     intelligence router with the target list and run id in its payload;
 *     `runEnrichBatch` checkpoints per target so a killed worker resumes at
 *     `vendor_intelligence_runs.cursor` rather than paying for completed
 *     targets again.
 *
 *   dpf-registry-import — refreshes `dpf_registrations` from the Department of
 *     Commerce participant list. A lapsed DPF certification is a Chapter V
 *     event; until this table is fed, the only thing standing between a
 *     customer and a dead adequacy claim was a string somebody typed into a
 *     seed literal (known-concerns §18, audit D19/D5).
 */
import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import {
  vendors,
  organizationVendors,
  vendorIntelligenceRuns,
  dpfRegistrations,
} from 'db';
import { eq, and, gt, isNull, or, sql } from 'drizzle-orm';
import { runEnrichBatch, reverifyVendor, type EnrichTarget } from '../lib/vendorIntelligence.js';
import { matchDpfStatus, dpfNameKey } from '../lib/vendorDpf.js';
import { recalculateVendorRiskForAllOrgs } from '../routers/vendors.js';

export const vendorIntelligenceQueue = createQueue('vendor-intelligence');

/**
 * The DPF participant list lives at dataframework.dpf.gov.myamerican.site… — no.
 * The real endpoint is the DoC's public search API; it publishes JSON without
 * auth. Overridable by env so tests point at a fixture server.
 */
const DPF_LIST_URL =
  process.env.DPF_REGISTRY_URL ||
  'https://dataframework-api.trade.gov/api/v1/participants';

interface DpfRegistryEntry {
  name: string;
  status?: string;
  certification_date?: string | null;
  recertification_date?: string | null;
  next_recertification_date?: string | null;
  websites?: Array<{ website?: string; url?: string }> | string[];
  covered_entities?: unknown[];
}

function entryDomains(entry: DpfRegistryEntry): string[] {
  const raw = Array.isArray(entry.websites) ? entry.websites : [];
  return raw
    .map((w) => (typeof w === 'string' ? w : (w?.website || w?.url || '')))
    .map((s) => s.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '').split('/')[0])
    .filter((d): d is string => Boolean(d));
}

async function fetchDpfEntries(): Promise<DpfRegistryEntry[]> {
  const response = await fetch(DPF_LIST_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'CustodiaCompliance/1.0' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`DPF registry responded ${response.status}`);
  const body = await response.json();
  // The endpoint has shipped both a bare array and an envelope; accept either.
  if (Array.isArray(body)) return body as DpfRegistryEntry[];
  if (Array.isArray(body?.participants)) return body.participants;
  if (Array.isArray(body?.results)) return body.results;
  throw new Error('Unrecognised DPF registry payload shape');
}

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

      case 'dpf-registry-import': {
        try {
          const entries = await fetchDpfEntries();

          let importedCount = 0;
          for (const entry of entries) {
            if (!entry?.name) continue;
            const key = dpfNameKey(entry.name).slice(0, 255);
            if (!key) continue;

            await db
              .insert(dpfRegistrations)
              .values({
                nameKey: key,
                organisationName: entry.name.slice(0, 500),
                domains: entryDomains(entry),
                status: String(entry.status || 'active').toLowerCase() === 'lapsed'
                  ? 'lapsed'
                  : String(entry.status || 'active').toLowerCase() === 'discontinued'
                    ? 'discontinued'
                    : 'active',
                certificationDate: entry.certification_date ?? null,
                recertificationDate: entry.recertification_date ?? null,
                nextRecertificationDate: entry.next_recertification_date ?? null,
                coveredEntities: (entry.covered_entities ?? []) as unknown as Record<string, unknown>,
                sourceUrl: DPF_LIST_URL,
                fetchedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: dpfRegistrations.nameKey,
                set: {
                  organisationName: entry.name.slice(0, 500),
                  domains: entryDomains(entry),
                  status: sql`excluded.status`,
                  certificationDate: sql`excluded.certification_date`,
                  recertificationDate: sql`excluded.recertification_date`,
                  nextRecertificationDate: sql`excluded.next_recertification_date`,
                  coveredEntities: sql`excluded.covered_entities`,
                  fetchedAt: new Date(),
                },
              });
            importedCount += 1;
          }

          console.log(`[Vendor Intelligence] DPF registry import complete: ${importedCount} entries`);
        } catch (err) {
          console.error('[Vendor Intelligence] DPF registry import failed:', err instanceof Error ? err.message : String(err));
          throw err;
        }
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
