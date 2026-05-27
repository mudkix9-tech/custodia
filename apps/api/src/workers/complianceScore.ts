import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { organizations, complianceReports } from 'db';
import { isNull } from 'drizzle-orm';
import { calculateComplianceScore } from '../lib/scoring.js';

export const complianceScoreWorker = createWorker('compliance-score', async (job: any) => {
  const { orgId } = job.data || {};

  if (orgId) {
    await computeAndStoreScore(orgId);
  } else {
    // Run for all active organizations
    const orgs = await db.select().from(organizations).where(isNull(organizations.deletedAt));
    for (const org of orgs) {
      await computeAndStoreScore(org.id);
    }
  }
});

async function computeAndStoreScore(orgId: string) {
  try {
    const scoreData = await calculateComplianceScore(orgId);

    await db.insert(complianceReports).values({
      organizationId: orgId,
      reportType: 'daily_score',
      scoreTotal: scoreData.total,
      categoryScores: scoreData.breakdown,
      scoreBreakdown: scoreData.breakdown,
      snapshotDate: new Date(),
    });
  } catch (error) {
    console.error(`Failed to compute compliance score for org ${orgId}:`, error);
  }
}
