/**
 * Sprint 7 (P-5, VD-9, VD-22) — the weekly DPF registry sync.
 *
 * **On its own queue, and that is the fix, not a preference.** pg-boss keys its
 * `schedule` table on the *queue* name alone — `INSERT … ON CONFLICT (name) DO
 * UPDATE` — so two `boss.schedule()` calls naming the same queue are not two
 * crons, they are one cron written twice. `workers/index.ts` scheduled
 * `dpf-registry-import` and then `vendor-review-reminder`, both on
 * `vendor-intelligence`, so the second silently replaced the first and the DPF
 * import has never once been registered. It would not have worked if it had
 * been: it fetched a host that does not resolve. Two independent failures, both
 * invisible, on the job standing between a customer and a dead adequacy claim.
 *
 * Not in `DORMANT_JOBS`: it writes only `dpf_registrations`, a shared reference
 * catalogue, and notifies nobody. The *alerting* built on a lapse is what needs
 * that decision, and it belongs to a later sprint — `dpfLapseFinding()` in
 * `lib/vendorDpf.ts` is the copy it will use when it arrives (VD-22).
 */
import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { syncDpfRegistry } from '../lib/dpfRegistrySync.js';

export const dpfRegistryQueue = createQueue('dpf-registry');

export const dpfRegistryWorker = createWorker(
  'dpf-registry',
  async (job: any) => {
    switch (job.name) {
      case 'dpf-registry-sync': {
        // The detail pass is scoped to participants the catalogue references and
        // paces itself at one request per second, so it costs nothing while the
        // catalogue is empty and grows only with Sprint 9's seeding.
        const result = await syncDpfRegistry({
          db,
          withDetail: true,
          log: (line: string) => console.log(line),
        });

        if (!result.ok) {
          // The sync refuses to write past its unrecognised-row threshold. That
          // is a vocabulary change at the Department, not a transient failure,
          // so the throw is for visibility — a retry will fail identically.
          throw new Error(
            `DPF registry sync aborted: ${result.rejected}/${result.fetchedRows} rows unrecognised`,
          );
        }

        console.log(
          `[dpf-registry] ${result.upserted} certification(s) written, ` +
          `${result.downgraded} downgraded, ${result.enriched} enriched, ` +
          `${result.rejected} rejected`,
        );
        break;
      }

      default:
        console.warn(`[dpf-registry] Unknown job: ${job.name}`);
    }
  },
  { drainDelay: 60 },
);

if (dpfRegistryWorker) {
  dpfRegistryWorker.on('failed', (job: any, err: Error) => {
    console.error(`[dpf-registry] Job ${job?.id ?? '?'} failed:`, err.message);
  });
}
