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
import { createQueue } from '../lib/queue.js';

import { getBoss, wrapJobPayload } from '../lib/queue.js';

export const gapScannerQueue = createQueue('gap-scanner');
export const complianceScoreQueue = createQueue('compliance-score');
export const consentRollupQueue = createQueue('consent-rollup');
export const consentRollupDriftCheckQueue = createQueue('consent-rollup-drift-check');
export const trialExpiryQueue = createQueue('trial-expiry');

export async function scheduleGlobalJobs() {
  const boss = await getBoss();

  await boss.schedule('gap-scanner', '0 2 * * *', wrapJobPayload('daily-scan', {}));
  await boss.schedule('compliance-score', '0 3 * * *', wrapJobPayload('daily-calculation', {}));
  await boss.schedule('consent-rollup', '0 1 * * *', wrapJobPayload('daily-rollup', {}));
  await boss.schedule('consent-rollup-drift-check', '0 4 * * 0', wrapJobPayload('weekly-drift-check', {}));
  await boss.schedule('impact-assessment', '*/15 * * * *', wrapJobPayload('impact-assessment-dispatcher', {}));
  await boss.schedule('trial-expiry', '0 8 * * *', wrapJobPayload('daily-trial-expiry', {}));

  // Rate limit cleanup every hour
  await boss.schedule('maintenance-jobs', '0 * * * *', wrapJobPayload('rate-limit-cleanup', {}));

  // Fans out per-org DPIA mitigation reminder checks. Previously registered on the
  // 'dpia-reminders' queue alongside the checker and never scheduled at all.
  await boss.schedule('dpia-dispatcher', '0 7 * * *', wrapJobPayload('dpia-dispatcher', {}));

  // Weekly consent/tracker reconciliation dispatch.
  await boss.schedule('consent-scan', '0 5 * * 1', wrapJobPayload('weekly-reconcile-dispatch', {}));

  // B19. Fans out per-org review-reminder checks. Both its jobs email customers, so
  // both sit in DORMANT_JOBS until an organisation opts in — see CLAUDE.md's
  // recurring-job checklist.
  await boss.schedule('ropa-reviews-dispatcher', '0 6 * * *', wrapJobPayload('ropa-reviews-dispatcher', {}));

  // Sprint 4. Three dispatchers, all fanning out one job per organisation, all in
  // DORMANT_JOBS because each of them writes into a queue a customer then has to
  // work through — and the first run against an established register finds real
  // work. A customer should meet that because they switched discovery on, not
  // because we deployed on a Tuesday.
  //
  // Staggered by an hour each rather than sharing 02:00 with the gap scanner: they
  // all sweep the same register on the same 512MB box that also runs Chromium.
  await boss.schedule('ropa-discovery', '0 4 * * 1', wrapJobPayload('ropa-discovery-dispatch', {}));
  await boss.schedule('ropa-retention', '0 5 * * *', wrapJobPayload('ropa-retention-dispatch', {}));
  await boss.schedule('ropa-intake', '0 9 * * *', wrapJobPayload('ropa-intake-dispatch', {}));
}


