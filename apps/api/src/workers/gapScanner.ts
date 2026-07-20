import { createWorker, orgEmbeddingsQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { complianceGaps, organizations, organizationVendors, vendors } from 'db';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { DETECTION_RULES } from '../constants/gapRules.js';

export const gapScannerWorker = createWorker('gap-scanner', async (job: any) => {
  const { orgId } = job.data;

  if (orgId) {
    await scanOrganization(orgId);
    await scanGroupVendorConsistency(orgId);
  } else {
    // Scan all active organizations
    const orgs = await db.select().from(organizations).where(isNull(organizations.deletedAt));
    for (const org of orgs) {
      await scanOrganization(org.id);
      await scanGroupVendorConsistency(org.id);
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
        const [updated] = await db.update(complianceGaps)
          .set({
            lastDetectedAt: new Date(),
            detectionCount: (existing.detectionCount || 0) + 1,
            severity: escalateSeverityIfStale(existing),
          })
          .where(eq(complianceGaps.id, existing.id))
          .returning();

        if (updated) {
          await orgEmbeddingsQueue.add('embed-gap', {
            orgId,
            entityType: 'gap',
            entityId: updated.id,
            action: 'upsert'
          });
        }
      } else {
        const [inserted] = await db.insert(complianceGaps).values({
          organizationId: orgId,
          ...gap,
        }).returning();

        if (inserted) {
          await orgEmbeddingsQueue.add('embed-gap', {
            orgId,
            entityType: 'gap',
            entityId: inserted.id,
            action: 'upsert'
          });
        }
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
      const [resolved] = await db.update(complianceGaps)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(complianceGaps.id, gap.id))
        .returning();

      if (resolved) {
        await orgEmbeddingsQueue.add('embed-gap', {
          orgId,
          entityType: 'gap',
          entityId: resolved.id,
          action: 'upsert'
        });
      }
    }
  }
}

async function scanGroupVendorConsistency(parentOrgId: string) {
  const childOrgs = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.parentOrganizationId, parentOrgId));

  if (childOrgs.length === 0) return;

  const childOrgIds = childOrgs.map((o: any) => o.id);

  const orgVendors = await db.select({
    id: organizationVendors.id,
    orgId: organizationVendors.organizationId,
    vendorId: organizationVendors.vendorId,
    dpaStatus: organizationVendors.dpaStatus,
    vendorRiskLevel: vendors.riskLevel,
    vendorName: vendors.name
  })
  .from(organizationVendors)
  .innerJoin(vendors, eq(vendors.id, organizationVendors.vendorId))
  .where(inArray(organizationVendors.organizationId, childOrgIds));

  // Group by vendor ID
  const grouped: Record<string, any[]> = {};
  orgVendors.forEach((ov: any) => {
    if (!ov.vendorId) return;
    if (!grouped[ov.vendorId]) grouped[ov.vendorId] = [];
    grouped[ov.vendorId]!.push(ov);
  });

  const detectedNow = new Set<string>();

  for (const [vendorId, entities] of Object.entries(grouped)) {
    if (entities.length < 2) continue;

    const hasSigned = entities.some((e: any) => e.dpaStatus === 'signed');
    if (!hasSigned) continue; // No inconsistency where one has signed

    // Identify lagging entities
    const laggingEntities = entities.filter((e: any) => e.dpaStatus !== 'signed');
    
    for (const lagging of laggingEntities) {
      const severity = lagging.vendorRiskLevel === 'critical' ? 'critical' : 'high';
      const gapType = 'missing_dpa'; // matches existing detection
      
      const fingerprint = `vendor:${lagging.id}:${gapType}`;
      detectedNow.add(fingerprint);

      const existing = await db.query.complianceGaps.findFirst({
        where: and(
          eq(complianceGaps.organizationId, lagging.orgId),
          eq(complianceGaps.entityType, 'vendor'),
          eq(complianceGaps.entityId, lagging.id),
          eq(complianceGaps.gapType, gapType),
          eq(complianceGaps.source, 'group_vendor_inconsistency') // Only match gaps from this specific rule
        ),
      });

      if (existing?.status === 'dismissed') continue;

      if (existing) {
        await db.update(complianceGaps)
          .set({
            lastDetectedAt: new Date(),
            detectionCount: (existing.detectionCount || 0) + 1,
            severity,
          })
          .where(eq(complianceGaps.id, existing.id));
      } else {
        await db.insert(complianceGaps).values({
          organizationId: lagging.orgId,
          entityType: 'vendor',
          entityId: lagging.id,
          gapType,
          title: `Missing DPA: ${lagging.vendorName} (Group Inconsistency)`,
          description: `No signed Data Processing Agreement with ${lagging.vendorName}, but other entities in your group have signed one.`,
          severity,
          source: 'group_vendor_inconsistency',
          resolutionUrl: `/vendors/${lagging.id}`,
        });
      }
    }
  }

  // Auto-resolve gaps no longer detected FOR THESE CHILD ORGS
  const openInconsistencyGaps = await db.query.complianceGaps.findMany({
    where: and(
      inArray(complianceGaps.organizationId, childOrgIds),
      eq(complianceGaps.source, 'group_vendor_inconsistency'),
      eq(complianceGaps.status, 'open'),
    ),
  });

  for (const gap of openInconsistencyGaps) {
    const fingerprint = `${gap.entityType}:${gap.entityId}:${gap.gapType}`;
    if (!detectedNow.has(fingerprint)) {
      await db.update(complianceGaps)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(complianceGaps.id, gap.id));
    }
  }
}
