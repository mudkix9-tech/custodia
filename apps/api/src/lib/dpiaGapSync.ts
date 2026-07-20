import { db } from '../db.js';
import { complianceGaps, dpias } from 'db';
import { eq, and } from 'drizzle-orm';
import { dispatchWebhook } from '../utils/webhookDispatcher.js';

export async function syncDpiaGaps(dpiaId: string) {
  console.log(`[DPIA Gap Sync] Syncing gaps for DPIA ${dpiaId}...`);

  // 1. Fetch the DPIA
  const [dpia] = await db.select().from(dpias).where(eq(dpias.id, dpiaId));
  if (!dpia) {
    console.error(`[DPIA Gap Sync] DPIA ${dpiaId} not found`);
    return;
  }

  const residualRisks = (dpia.residualRisks || []) as any[];

  // 2. Fetch existing gaps for this DPIA
  const existingGaps = await db.select().from(complianceGaps).where(eq(complianceGaps.dpiaId, dpiaId));

  // Keep track of which existing gaps are associated with a current risk ID
  const activeRiskIds = new Set(residualRisks.map(r => r.id));

  // Get primary activity ID linked to the DPIA
  const primaryActivityId = (dpia.processingActivityIds as string[])?.[0];

  // 3. Sync each current risk
  for (const risk of residualRisks) {
    const existingGap = existingGaps.find(g => g.dpiaRiskId === risk.id);

    const qualifies = risk.mitigationRequired === true && ['medium', 'high', 'critical'].includes(risk.residualRiskLevel);
    const resolutionUrl = primaryActivityId ? `/ropa/${primaryActivityId}?tab=dpia#risk-${risk.id}` : '';

    if (qualifies) {
      if (existingGap) {
        if (risk.mitigationStatus === 'completed') {
          // Rule 1: Auto-resolve when mitigation is completed
          if (existingGap.status !== 'resolved' && existingGap.status !== 'dismissed') {
            await db.update(complianceGaps)
              .set({
                status: 'resolved',
                resolvedAt: new Date(),
                resolvedReason: 'mitigation_completed',
                updatedAt: new Date(),
              })
              .where(eq(complianceGaps.id, existingGap.id));
            
            await dispatchWebhook(dpia.organizationId, 'compliance.gap_resolved', { gapId: existingGap.id });
            console.log(`[DPIA Gap Sync] Resolved gap ${existingGap.id} due to completed mitigation`);
          }
        } else {
          // Mitigation is not completed. Reopen if it was previously resolved
          const updates: any = {
            title: `DPIA risk: ${risk.description || 'Unnamed risk'}`,
            severity: risk.residualRiskLevel,
            description: risk.mitigationDescription || risk.description,
            entityType: risk.relatedVendorId ? 'vendor' : (risk.relatedProcessingActivityId ? 'processing_activity' : 'dpia'),
            entityId: risk.relatedVendorId || risk.relatedProcessingActivityId || dpia.id,
            resolutionUrl,
            metadata: { alreadyReflectedInBaseScore: !!risk.alreadyReflectedInBaseScore },
            mitigationDueDate: risk.mitigationDueDate ? new Date(risk.mitigationDueDate) : null,
            updatedAt: new Date(),
          };

          if (existingGap.status === 'resolved') {
            updates.status = 'open';
            updates.resolvedAt = null;
            updates.resolvedReason = null;
            console.log(`[DPIA Gap Sync] Reopened gap ${existingGap.id} because mitigation is no longer complete`);
          }

          await db.update(complianceGaps)
            .set(updates)
            .where(eq(complianceGaps.id, existingGap.id));
        }
      } else {
        // Create new gap only if it is not already completed
        if (risk.mitigationStatus !== 'completed') {
          const [newGap] = await db.insert(complianceGaps).values({
            organizationId: dpia.organizationId,
            dpiaId: dpia.id,
            dpiaRiskId: risk.id,
            source: 'dpia',
            gapType: `dpia_risk_${risk.id}`,
            title: `DPIA risk: ${risk.description || 'Unnamed risk'}`,
            severity: risk.residualRiskLevel,
            description: risk.mitigationDescription || risk.description,
            gdprArticles: ['Article 35'],
            entityType: risk.relatedVendorId ? 'vendor' : (risk.relatedProcessingActivityId ? 'processing_activity' : 'dpia'),
            entityId: risk.relatedVendorId || risk.relatedProcessingActivityId || dpia.id,
            status: 'open',
            resolutionUrl,
            metadata: { alreadyReflectedInBaseScore: !!risk.alreadyReflectedInBaseScore },
            mitigationDueDate: risk.mitigationDueDate ? new Date(risk.mitigationDueDate) : null,
            firstDetectedAt: new Date(),
            lastDetectedAt: new Date(),
          }).returning();

          console.log(`[DPIA Gap Sync] Created new gap ${newGap?.id} for risk ${risk.id}`);
        }
      }
    } else {
      // Risk is in the DPIA but no longer qualifies (mitigationRequired set to false or severity became low)
      if (existingGap && existingGap.status !== 'resolved' && existingGap.status !== 'dismissed') {
        await db.update(complianceGaps)
          .set({
            status: 'resolved',
            resolvedAt: new Date(),
            resolvedReason: 'dpia_risk_unqualified',
            updatedAt: new Date(),
          })
          .where(eq(complianceGaps.id, existingGap.id));

        await dispatchWebhook(dpia.organizationId, 'compliance.gap_resolved', { gapId: existingGap.id });
        console.log(`[DPIA Gap Sync] Resolved gap ${existingGap.id} because risk no longer qualifies for mitigation`);
      }
    }
  }

  // 4. Handle deleted risks (reassessed or removed from the array)
  for (const existingGap of existingGaps) {
    if (existingGap.dpiaRiskId) {
      if (!activeRiskIds.has(existingGap.dpiaRiskId)) {
        if (existingGap.status !== 'resolved' && existingGap.status !== 'dismissed') {
          await db.update(complianceGaps)
            .set({
              status: 'resolved',
              resolvedAt: new Date(),
              resolvedReason: 'dpia_risk_removed',
              updatedAt: new Date(),
            })
            .where(eq(complianceGaps.id, existingGap.id));

          await dispatchWebhook(dpia.organizationId, 'compliance.gap_resolved', { gapId: existingGap.id });
          console.log(`[DPIA Gap Sync] Resolved gap ${existingGap.id} because the risk was removed from the DPIA`);
        }
      }
    }
  }

  // 5. Trigger vendor risk recalculation for affected vendors
  const affectedOrgVendorIds = new Set<string>();
  for (const risk of residualRisks) {
    if (risk.relatedVendorId) {
      affectedOrgVendorIds.add(risk.relatedVendorId);
    }
  }
  for (const gap of existingGaps) {
    if (gap.entityType === 'vendor' && gap.entityId) {
      affectedOrgVendorIds.add(gap.entityId);
    }
  }

  if (affectedOrgVendorIds.size > 0) {
    const { organizationVendors } = await import('db');
    const { updateVendorRiskScore } = await import('../routers/vendors.js');

    for (const orgVendorId of affectedOrgVendorIds) {
      const [orgVendor] = await db.select().from(organizationVendors).where(eq(organizationVendors.id, orgVendorId));
      if (orgVendor && orgVendor.vendorId) {
        await updateVendorRiskScore(db, dpia.organizationId, orgVendor.vendorId);
      }
    }
  }
}
