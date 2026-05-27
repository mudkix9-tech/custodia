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

import { createQueue } from '../lib/queue.js';

export const gapScannerQueue = createQueue('gap-scanner');
export const complianceScoreQueue = createQueue('compliance-score');

export async function scheduleGlobalJobs() {
  await gapScannerQueue.add('daily-scan', {}, {
    repeat: { pattern: '0 2 * * *', tz: 'UTC' }, // 2am UTC daily
    jobId: 'gap-scanner-daily',
  });

  await complianceScoreQueue.add('daily-calculation', {}, {
    repeat: { pattern: '0 3 * * *', tz: 'UTC' }, // 3am UTC daily
    jobId: 'compliance-score-daily',
  });
}
