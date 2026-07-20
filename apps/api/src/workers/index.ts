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

import { createQueue } from '../lib/queue.js';
import { scheduleIncidentJobs } from './incidents.js';

export const gapScannerQueue = createQueue('gap-scanner');
export const complianceScoreQueue = createQueue('compliance-score');
export const consentRollupQueue = createQueue('consent-rollup');
export const consentRollupDriftCheckQueue = createQueue('consent-rollup-drift-check');

export async function scheduleGlobalJobs() {
  await gapScannerQueue.add('daily-scan', {}, {
    repeat: { pattern: '0 2 * * *', tz: 'UTC' }, // 2am UTC daily
    jobId: 'gap-scanner-daily',
  });

  await complianceScoreQueue.add('daily-calculation', {}, {
    repeat: { pattern: '0 3 * * *', tz: 'UTC' }, // 3am UTC daily
    jobId: 'compliance-score-daily',
  });

  await consentRollupQueue.add('daily-rollup', {}, {
    repeat: { pattern: '0 1 * * *', tz: 'UTC' }, // 1am UTC daily
    jobId: 'consent-rollup-daily',
  });

  await consentRollupDriftCheckQueue.add('weekly-drift-check', {}, {
    repeat: { pattern: '0 4 * * 0', tz: 'UTC' }, // 4am UTC every Sunday
    jobId: 'consent-rollup-drift-weekly',
  });

  await scheduleIncidentJobs();
}
