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

import { createQueue } from '../lib/queue.js';

import { getBoss } from '../lib/queue.js';

export const gapScannerQueue = createQueue('gap-scanner');
export const complianceScoreQueue = createQueue('compliance-score');
export const consentRollupQueue = createQueue('consent-rollup');
export const consentRollupDriftCheckQueue = createQueue('consent-rollup-drift-check');

export async function scheduleGlobalJobs() {
  const boss = await getBoss();

  await boss.schedule('gap-scanner', '0 2 * * *', { name: 'daily-scan', data: {} });
  await boss.schedule('compliance-score', '0 3 * * *', { name: 'daily-calculation', data: {} });
  await boss.schedule('consent-rollup', '0 1 * * *', { name: 'daily-rollup', data: {} });
  await boss.schedule('consent-rollup-drift-check', '0 4 * * 0', { name: 'weekly-drift-check', data: {} });
  await boss.schedule('impact-assessment', '*/15 * * * *', { name: 'impact-assessment-dispatcher', data: {} });
  
  // Rate limit cleanup every hour
  await boss.schedule('maintenance-jobs', '0 * * * *', { name: 'rate-limit-cleanup', data: {} });
}


