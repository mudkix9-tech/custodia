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
 * catalogue, and emails nobody.
 *
 * **It also reconciles what the feed just changed, which for three sprints it
 * did not** (§8, and the two findings below it).
 *
 * 1. `organization_vendors.risk_score` is denormalised. A certification going
 *    inactive on Monday moved no customer's score until a human happened to run
 *    `recalc:vendor-risk -- --apply`, so a register went on showing 5/20 for the
 *    location factor of a vendor whose Chapter V evidence had evaporated. That
 *    is VD-16 — the programme's own finding — applied to the recurring feed
 *    rather than to the one-off seed, and the recurring case is the worse one
 *    because nobody is standing over it.
 * 2. `dpfLapseFinding()` shipped in Sprint 7 with fixtures and one caller: the
 *    questionnaire cross-check, which fires when a *vendor* fills in a form. The
 *    job that actually learns about a lapse could not say so. It now logs the
 *    finding per affected vendor, and the nightly gap scanner raises the Art. 44
 *    gap for the same vendors off the back of VD-23.
 *
 * Reconciliation stays on this queue rather than becoming a dormant alerting
 * job because none of it emails anybody: recomputing a derived column is the
 * register being correct, not a notification. Anything that mails a customer
 * about a lapse is still a separate job and still needs the dormancy decision.
 */
import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { vendors, organizationVendors } from 'db';
import { eq } from 'drizzle-orm';
import { syncDpfRegistry } from '../lib/dpfRegistrySync.js';
import { isRecipientConditional } from '../constants/transferDestinations.js';
import {
  resolveDpfStatusBatch,
  dpfLapseNotices,
  type DpfLapseNotice,
} from '../lib/vendorAdequacy.js';

export const dpfRegistryQueue = createQueue('dpf-registry');

/**
 * Re-resolve every *linked* vendor whose adequacy depends on the register, then
 * put its customers' scores back in step.
 *
 * Bounded by the number of catalogue rows an organisation actually uses, not by
 * the catalogue and certainly not by the 16,534-row register: an unlinked row
 * has no denormalised score to move, so recomputing it would be work with no
 * reader. Every conditional vendor is recomputed rather than only the ones that
 * went inactive, because a vendor that *regained* its certification needs its
 * score to come back down and the stored column records no trace of which
 * status it was last computed under.
 *
 * The vendors router is imported lazily for the reason `recalculate-vendor-risk`
 * spells out: pulling it in eagerly would drag the worker barrel, and this file
 * is inside that barrel.
 */
export async function reconcileDpfDependentVendors(): Promise<{
  checked: number;
  rescored: number;
  notices: DpfLapseNotice[];
}> {
  const linked = await db
    .selectDistinctOn([vendors.id], {
      id: vendors.id,
      name: vendors.name,
      legalEntityName: vendors.legalEntityName,
      website: vendors.website,
      headquartersCountry: vendors.headquartersCountry,
      transferMechanisms: vendors.transferMechanisms,
    })
    .from(vendors)
    .innerJoin(organizationVendors, eq(organizationVendors.vendorId, vendors.id));

  const conditional = linked.filter((v: any) =>
    isRecipientConditional((v.headquartersCountry ?? '').toUpperCase()),
  );
  if (conditional.length === 0) return { checked: 0, rescored: 0, notices: [] };

  const matches = await resolveDpfStatusBatch(db, conditional as any);
  const notices = dpfLapseNotices(conditional as any, matches as any);

  const { recalculateVendorRiskForAllOrgs } = await import('../routers/vendors.js');
  let rescored = 0;
  for (const vendor of conditional) {
    const rows = await recalculateVendorRiskForAllOrgs(db, vendor.id);
    rescored += rows.length;
  }

  return { checked: conditional.length, rescored, notices };
}

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

        const reconciled = await reconcileDpfDependentVendors();
        console.log(
          `[dpf-registry] ${reconciled.checked} linked vendor(s) re-resolved, ` +
          `${reconciled.rescored} rescored, ${reconciled.notices.length} no longer evidenced`,
        );
        for (const notice of reconciled.notices) {
          console.warn(
            `[dpf-registry] ${notice.finding.title}: ${notice.finding.detail} ` +
            `${notice.finding.action}`,
          );
        }
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
