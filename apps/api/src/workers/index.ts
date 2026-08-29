export * from './emails.js';
export * from './vendors.js';
export * from './dsar.js';
export * from './cmp.js';
export * from './policies.js';
export * from './breaches.js';
export * from './compliance.js';
export * from './notifications.js';
export * from './regulatoryScraper.js';
export * from './gapScanner.js';
export * from './dataExport.js';
export * from './complianceScore.js';
export * from './orgEmbeddings.js';
export * from './incidents.js';
export * from './dpiaReminders.js';
export * from './reconsent.js';
export * from './consentRollup.js';
export * from './consentRollupDriftCheck.js';
export * from './rateLimitCleanup.js';
export * from './generateLeadPdf.js';
export * from './generateAssessmentPdf.js';
export * from './trialExpiry.js';
export * from './consentScan.js';
export * from './ropaReviews.js';
export * from './ropaDiscovery.js';
export * from './ropaRetention.js';
export * from './ropaIntakeReminders.js';
export * from './materialChange.js';
export * from './vendorIntelligence.js';
export * from './dpfRegistry.js';
import { createQueue } from '../lib/queue.js';

import { getBoss, wrapJobPayload, isJobDormant } from '../lib/queue.js';

export const gapScannerQueue = createQueue('gap-scanner');
export const complianceScoreQueue = createQueue('compliance-score');
export const consentRollupQueue = createQueue('consent-rollup');
export const consentRollupDriftCheckQueue = createQueue('consent-rollup-drift-check');
export const trialExpiryQueue = createQueue('trial-expiry');

export async function scheduleGlobalJobs() {
  const boss = await getBoss();
  const scheduledQueues = new Set<string>();
  const scheduleOnce = (b: any, queue: string, cron: string, payload: unknown) =>
    scheduleQueue(scheduledQueues, b, queue, cron, payload);

  await scheduleOnce(boss, 'gap-scanner', '0 2 * * *', wrapJobPayload('daily-scan', {}));
  await scheduleOnce(boss, 'compliance-score', '0 3 * * *', wrapJobPayload('daily-calculation', {}));
  await scheduleOnce(boss, 'consent-rollup', '0 1 * * *', wrapJobPayload('daily-rollup', {}));
  await scheduleOnce(boss, 'consent-rollup-drift-check', '0 4 * * 0', wrapJobPayload('weekly-drift-check', {}));
  await scheduleOnce(boss, 'impact-assessment', '*/15 * * * *', wrapJobPayload('impact-assessment-dispatcher', {}));
  await scheduleOnce(boss, 'trial-expiry', '0 8 * * *', wrapJobPayload('daily-trial-expiry', {}));

  // Rate limit cleanup every hour
  await scheduleOnce(boss, 'maintenance-jobs', '0 * * * *', wrapJobPayload('rate-limit-cleanup', {}));

  // Fans out per-org DPIA mitigation reminder checks. Previously registered on the
  // 'dpia-reminders' queue alongside the checker and never scheduled at all.
  await scheduleOnce(boss, 'dpia-dispatcher', '0 7 * * *', wrapJobPayload('dpia-dispatcher', {}));

  // Weekly consent/tracker reconciliation dispatch.
  await scheduleOnce(boss, 'consent-scan', '0 5 * * 1', wrapJobPayload('weekly-reconcile-dispatch', {}));

  // B19. Fans out per-org review-reminder checks. Both its jobs email customers, so
  // both sit in DORMANT_JOBS until an organisation opts in — see CLAUDE.md's
  // recurring-job checklist.
  await scheduleOnce(boss, 'ropa-reviews-dispatcher', '0 6 * * *', wrapJobPayload('ropa-reviews-dispatcher', {}));

  // Sprint 4. Three dispatchers, all fanning out one job per organisation, all in
  // DORMANT_JOBS because each of them writes into a queue a customer then has to
  // work through — and the first run against an established register finds real
  // work. A customer should meet that because they switched discovery on, not
  // because we deployed on a Tuesday.
  //
  // Staggered by an hour each rather than sharing 02:00 with the gap scanner: they
  // all sweep the same register on the same 512MB box that also runs Chromium.
  await scheduleOnce(boss, 'ropa-discovery', '0 4 * * 1', wrapJobPayload('ropa-discovery-dispatch', {}));
  await scheduleOnce(boss, 'ropa-retention', '0 5 * * *', wrapJobPayload('ropa-retention-dispatch', {}));
  await scheduleOnce(boss, 'ropa-intake', '0 9 * * *', wrapJobPayload('ropa-intake-dispatch', {}));

  /*
   * Sprint 2 (P-5), rehomed in Sprint 7. The DPF participant list refreshes
   * daily and certifications lapse annually, so a weekly sync notices a lapse
   * within seven days of it happening. Deliberately NOT dormant: it writes only
   * into dpf_registrations, touching no customer-facing queue.
   *
   * On its own `dpf-registry` queue, which is the whole reason it now runs.
   * pg-boss's schedule table is keyed on the queue name — `ON CONFLICT (name) DO
   * UPDATE` — so this line and the vendor-review-reminder line below both named
   * `vendor-intelligence` and the second overwrote the first. The DPF sync was
   * never registered, and the log line at the bottom of this function reported
   * nothing wrong because a schedule that was silently replaced is not a
   * schedule that is dormant. **Two schedules on one queue is one schedule.**
   */
  await scheduleOnce(boss, 'dpf-registry', '17 3 * * 1', wrapJobPayload('dpf-registry-sync', {}));

  /*
   * Scheduled *and* in `DORMANT_JOBS`, which is the house convention rather than a
   * contradiction: the cron is wired up here once, and `DORMANT_JOBS` is the switch
   * that decides whether the dispatcher actually runs it. Six other jobs sit in the
   * same state (`impact-assessment`, `dpia-dispatcher`, `ropa-reviews-dispatcher`
   * and the three Sprint 4 ROPA dispatchers). The reminder chases customers about
   * overdue vendor reviews, so it stays dormant until an organisation turns the
   * feature on — see `logDormantSchedules` below, which prints the ones that are
   * wired but switched off, because that state is otherwise invisible until someone
   * greps two files.
   */
  await scheduleOnce(boss, 'vendor-intelligence', '30 6 * * *', wrapJobPayload('vendor-review-reminder', {}));

  logDormantSchedules([
    ['gap-scanner', 'daily-scan'],
    ['compliance-score', 'daily-calculation'],
    ['consent-rollup', 'daily-rollup'],
    ['consent-rollup-drift-check', 'weekly-drift-check'],
    ['impact-assessment', 'impact-assessment-dispatcher'],
    ['trial-expiry', 'daily-trial-expiry'],
    ['maintenance-jobs', 'rate-limit-cleanup'],
    ['dpia-dispatcher', 'dpia-dispatcher'],
    ['consent-scan', 'weekly-reconcile-dispatch'],
    ['ropa-reviews-dispatcher', 'ropa-reviews-dispatcher'],
    ['ropa-discovery', 'ropa-discovery-dispatch'],
    ['ropa-retention', 'ropa-retention-dispatch'],
    ['ropa-intake', 'ropa-intake-dispatch'],
    ['dpf-registry', 'dpf-registry-sync'],
    ['vendor-intelligence', 'vendor-review-reminder'],
  ]);
}

/**
 * `boss.schedule()` with the collision made loud.
 *
 * pg-boss's schedule table is `name text primary key` and its upsert is `ON
 * CONFLICT (name) DO UPDATE`, where `name` is the *queue*. So two schedules on
 * one queue are not two crons — the later call rewrites the earlier one's cron
 * and payload, and nothing anywhere says so. That is how `dpf-registry-import`
 * came to be scheduled in code, absent from `DORMANT_JOBS`, reported by no
 * warning, and never once registered: `vendor-review-reminder` was scheduled on
 * the same queue four lines later and took its row.
 *
 * A recurring job therefore needs its own queue, and asking for a second one is
 * a mistake to fail on at startup rather than to discover a year later.
 */
function scheduleQueue(
  seen: Set<string>,
  boss: any,
  queue: string,
  cron: string,
  payload: unknown,
): Promise<unknown> {
  if (seen.has(queue)) {
    throw new Error(
      `[queue] ${queue} already has a schedule. pg-boss keys schedules by queue name, ` +
      'so this would silently replace it — give the job its own queue.'
    );
  }
  seen.add(queue);
  return boss.schedule(queue, cron, payload);
}

/**
 * Print, once at startup, which of the crons we just registered will be skipped.
 *
 * A cron line and a `DORMANT_JOBS` entry live in different files, so "this feature
 * is scheduled" and "this feature runs" are two different facts and nothing put
 * them side by side. That is how the vendor module came to advertise monitoring it
 * does not perform: the scheduling code reads as working, the dormant list reads as
 * a deliberate decision, and only the pair tells you the truth. This is a log line
 * rather than a failure because the combination is intentional.
 */
function logDormantSchedules(scheduled: Array<[string, string]>) {
  const dormant = scheduled.filter(([q, j]) => isJobDormant(q, j));
  if (dormant.length === 0) return;
  console.log(
    `[queue] ${dormant.length} scheduled job(s) are in DORMANT_JOBS and will be skipped: ` +
    dormant.map(([q, j]) => `${q}:${j}`).join(', ') +
    '. Remove from DORMANT_JOBS (or set WORKERS_ENABLED_JOBS) to enable.'
  );
}


