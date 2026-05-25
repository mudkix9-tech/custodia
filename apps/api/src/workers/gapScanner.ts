import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { complianceGaps, organizations } from 'db';
import { and, eq, isNull } from 'drizzle-orm';
import { DETECTION_RULES } from '../constants/gapRules.js';

export const gapScannerWorker = createWorker('gap-scanner', async (job: any) => {
  const { orgId } = job.data;

  if (orgId) {
    await scanOrganization(orgId);
  } else {
    // Scan all active organizations
    const orgs = await db.select().from(organizations).where(isNull(organizations.deletedAt));
    for (const org of orgs) {
      await scanOrganization(org.id);
    }
  }
});

function escalateSeverityIfStale(existing: any) {
    // Escalate severity if gap is stale
    return existing.severity;
}

async function scanOrganization(orgId: string) {
  const detectedNow = new Set<string>();

  for (const rule of DETECTION_RULES) {
    const matches = await rule.detect(orgId);

    for (const match of matches) {
      const gap = rule.buildGap(match);
      const fingerprint = `${gap.entityType}:${gap.entityId}:${gap.gapType}`;
      detectedNow.add(fingerprint);

      const existing = await db.query.complianceGaps.findFirst({
        where: and(
          eq(complianceGaps.organizationId, orgId),
          eq(complianceGaps.entityType, gap.entityType),
          eq(complianceGaps.entityId, gap.entityId),
          eq(complianceGaps.gapType, gap.gapType),
        ),
      });

      if (existing?.status === 'dismissed') continue;

      if (existing) {
        await db.update(complianceGaps)
          .set({
            lastDetectedAt: new Date(),
            detectionCount: (existing.detectionCount || 0) + 1,
            severity: escalateSeverityIfStale(existing),
          })
          .where(eq(complianceGaps.id, existing.id));
      } else {
        await db.insert(complianceGaps).values({
          organizationId: orgId,
          ...gap,
        });
      }
    }
  }

  // Auto-resolve gaps no longer detected
  const openGaps = await db.query.complianceGaps.findMany({
    where: and(
      eq(complianceGaps.organizationId, orgId),
      eq(complianceGaps.status, 'open'),
    ),
  });

  for (const gap of openGaps) {
    const fingerprint = `${gap.entityType}:${gap.entityId}:${gap.gapType}`;
    if (!detectedNow.has(fingerprint)) {
      await db.update(complianceGaps)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(complianceGaps.id, gap.id));
    }
  }
}
