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
}


