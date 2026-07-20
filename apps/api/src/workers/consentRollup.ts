import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { consentRecords, consentDailySummary, consentDomains } from 'db';
import { sql, and, eq } from 'drizzle-orm';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export const consentRollupWorker = createWorker('consent-rollup', async (job: any) => {
  // By default, we recompute the trailing 3 days
  const daysToProcess = [1, 2, 3];

  for (const daysAgo of daysToProcess) {
    const targetDate = startOfDay(subDays(new Date(), daysAgo));
    const start = targetDate;
    const end = endOfDay(targetDate);

    await processRollupForDate(start, end, targetDate);
  }
});

async function processRollupForDate(startDate: Date, endDate: Date, targetDate: Date) {
  const dateStr = targetDate.toISOString().split('T')[0]!;

  // 1. Fetch domains to process
  const domains = await db.select({ id: consentDomains.id, orgId: consentDomains.organizationId }).from(consentDomains);

  for (const domain of domains) {
    await db.transaction(async (tx) => {
      // Idempotency: clear existing summary for this domain + date
      await tx.delete(consentDailySummary).where(
        and(
          eq(consentDailySummary.domainId, domain.id),
          eq(consentDailySummary.date, dateStr)
        )
      );

      // Aggregate in JS to avoid complicated SQL combinations with arrays.
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
      
      const result = await tx.execute(recordsQuery);
      const rows = result.rows;

      if (rows.length === 0) {
        return; // No data for this day
      }

      const totalSessions = rows.length;

      // Category counters
      const catStats = {
        analytics: { accepted: 0, rejected: 0 },
        marketing: { accepted: 0, rejected: 0 },
        functional: { accepted: 0, rejected: 0 },
      };

      // Interaction counters
      let acceptAllCount = 0;
      let rejectAllCount = 0;
      let customizedWithAcceptanceCount = 0;
      let customizedAllRejectedCount = 0;

      // Combination counters
      const combinationCounts: Record<string, number> = {};

      for (const row of rows) {
        const accepted = row.categories_accepted as string[] || [];
        const rejected = row.categories_rejected as string[] || [];
        
        // Interaction breakdown
        const interaction = row.interaction_type;
        if (interaction === 'accept_all') acceptAllCount++;
        else if (interaction === 'reject_all') rejectAllCount++;
        else if (interaction === 'customized') {
          if (accepted.length > 1) customizedWithAcceptanceCount++;
          else customizedAllRejectedCount++;
        }

        // Granular combinations (only for customized interactions, ignoring wholesale acceptors/rejectors)
        if (interaction === 'customized') {
          const combo = row.canonical_categories as string || '';
          combinationCounts[combo] = (combinationCounts[combo] || 0) + 1;
        }

        // Category stats
        for (const cat of ['analytics', 'marketing', 'functional']) {
          if (accepted.includes(cat)) catStats[cat as keyof typeof catStats].accepted++;
          if (rejected.includes(cat)) catStats[cat as keyof typeof catStats].rejected++;
        }
      }

      const rowsToInsert = [];

      // 1. Category rows
      for (const [cat, stats] of Object.entries(catStats)) {
        rowsToInsert.push({
          organizationId: domain.orgId,
          domainId: domain.id,
          date: dateStr,
          category: cat,
          acceptedSessions: stats.accepted,
          rejectedSessions: stats.rejected,
          totalSessions: totalSessions,
          acceptAllCount: 0,
          rejectAllCount: 0,
          customizedWithAcceptanceCount: 0,
          customizedAllRejectedCount: 0,
          categoryCombination: null,
          categoryCombinationCount: 0,
        });
      }

      // 2. Interaction row (null category, null combination)
      rowsToInsert.push({
        organizationId: domain.orgId,
        domainId: domain.id,
        date: dateStr,
        category: null,
        acceptedSessions: 0,
        rejectedSessions: 0,
        totalSessions: totalSessions,
        acceptAllCount,
        rejectAllCount,
        customizedWithAcceptanceCount,
        customizedAllRejectedCount,
        categoryCombination: null,
        categoryCombinationCount: 0,
      });

      // 3. Combination rows
      for (const [combo, count] of Object.entries(combinationCounts)) {
        rowsToInsert.push({
          organizationId: domain.orgId,
          domainId: domain.id,
          date: dateStr,
          category: null,
          acceptedSessions: 0,
          rejectedSessions: 0,
          totalSessions: totalSessions,
          acceptAllCount: 0,
          rejectAllCount: 0,
          customizedWithAcceptanceCount: 0,
          customizedAllRejectedCount: 0,
          categoryCombination: combo,
          categoryCombinationCount: count,
        });
      }

      if (rowsToInsert.length > 0) {
        await tx.insert(consentDailySummary).values(rowsToInsert as any);
      }
    });
  }
}
