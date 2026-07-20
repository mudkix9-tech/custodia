import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { consentRecords, consentDailySummary, consentDomains } from 'db';
import { sql, and, eq, lte, gte } from 'drizzle-orm';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export const consentRollupDriftCheckWorker = createWorker('consent-rollup-drift-check', async () => {
  // We randomly sample 3 days from the past month (older than the 7-day threshold)
  const today = new Date();
  
  const sampleDays = Array.from({ length: 3 }, () => {
    // Random between 8 and 30 days ago
    const randomOffset = Math.floor(Math.random() * (30 - 8 + 1)) + 8;
    return startOfDay(subDays(today, randomOffset));
  });

  const domains = await db.select({ id: consentDomains.id }).from(consentDomains);
  if (domains.length === 0) return;

  for (const date of sampleDays) {
    const dateStr = date.toISOString().split('T')[0];
    const startDate = date;
    const endDate = endOfDay(date);

    for (const domain of domains) {
      // 1. Calculate from raw records
      const recordsQuery = sql`
        SELECT 
          categories_accepted,
          categories_rejected,
          interaction_type,
          canonicalize_category_array(categories_accepted) as canonical_categories
        FROM ${consentRecords}
        WHERE domain_id = ${domain.id}
          AND given_at >= ${startDate.toISOString()}
          AND given_at <= ${endDate.toISOString()}
      `;
      
      const rawResult = await db.execute(recordsQuery);
      const rows = rawResult.rows;

      const totalSessions = rows.length;
      if (totalSessions === 0) continue;

      let acceptAllCount = 0;
      let rejectAllCount = 0;

      for (const row of rows) {
        if (row.interaction_type === 'accept_all') acceptAllCount++;
        else if (row.interaction_type === 'reject_all') rejectAllCount++;
      }

      // 2. Fetch from rollup table
      // Let's just compare the interaction row to keep it simple and effective
      const rollupQuery = sql`
        SELECT
          total_sessions,
          accept_all_count,
          reject_all_count
        FROM ${consentDailySummary}
        WHERE domain_id = ${domain.id}
          AND date = ${dateStr}
          AND category IS NULL 
          AND category_combination IS NULL
      `;
      
      const rollupResult = await db.execute(rollupQuery);
      
      if (rollupResult.rows.length === 0) {
        console.error(`DRIFT ALERT: Missing rollup data for domain ${domain.id} on ${dateStr}`);
        continue;
      }

      const rollupRow = rollupResult.rows[0]!;
      const rollupTotalSessions = Number(rollupRow.total_sessions);
      const rollupAcceptAll = Number(rollupRow.accept_all_count);
      const rollupRejectAll = Number(rollupRow.reject_all_count);

      if (totalSessions !== rollupTotalSessions || 
          acceptAllCount !== rollupAcceptAll || 
          rejectAllCount !== rollupRejectAll) {
        console.error(`DRIFT ALERT: Mismatch found for domain ${domain.id} on ${dateStr}. 
          Raw: Total=${totalSessions}, AcceptAll=${acceptAllCount}, RejectAll=${rejectAllCount}. 
          Rollup: Total=${rollupTotalSessions}, AcceptAll=${rollupAcceptAll}, RejectAll=${rollupRejectAll}`);
      }
    }
  }
});
