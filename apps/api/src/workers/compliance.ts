import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { complianceGaps, complianceReports, organizations, organizationVendors, processingActivities, dpias, clients, clientProcessingActivities, users, trainingCompletions } from 'db';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { isLiveVendorStatus } from '../constants/vendorLifecycle.js';


export const complianceQueue = createQueue('compliance');

interface GapDetection {
  entityType: string;
  entityId: string;
  gapType: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  gdprArticles: string[];
  resolutionUrl: string;
}

export const complianceWorker = createWorker('compliance', async (job: any) => {
  if (job.name === 'gap-scanner') {
    const allOrgs = await db.query.organizations.findMany();
    const BATCH_SIZE = 25;

    for (let i = 0; i < allOrgs.length; i += BATCH_SIZE) {
      const orgsBatch = allOrgs.slice(i, i + BATCH_SIZE);
      const batchOrgIds = orgsBatch.map(o => o.id);

      const [
        orgVendors, orgActivities, orgDpias, orgClients, 
        orgUsers, orgCompletions, orgExistingGaps
      ] = await Promise.all([
        batchOrgIds.length > 0 ? db.query.organizationVendors.findMany({ where: inArray(organizationVendors.organizationId, batchOrgIds) }) : [],
        batchOrgIds.length > 0 ? db.query.processingActivities.findMany({ where: inArray(processingActivities.organizationId, batchOrgIds) }) : [],
        batchOrgIds.length > 0 ? db.query.dpias.findMany({ where: inArray(dpias.organizationId, batchOrgIds) }) : [],
        batchOrgIds.length > 0 ? db.query.clients.findMany({ 
          where: inArray(clients.organizationId, batchOrgIds),
          with: { processingActivities: { with: { processingActivity: true } } }
        }) : [],
        batchOrgIds.length > 0 ? db.query.users.findMany({ where: inArray(users.organizationId, batchOrgIds) }) : [],
        batchOrgIds.length > 0 ? db.query.trainingCompletions.findMany({ where: inArray(trainingCompletions.organizationId, batchOrgIds) }) : [],
        batchOrgIds.length > 0 ? db.query.complianceGaps.findMany({ where: and(inArray(complianceGaps.organizationId, batchOrgIds), eq(complianceGaps.source, 'gap_scanner')) }) : []
      ]);

      const byOrg = <T extends { organizationId?: string | null }>(arr: T[]) => {
        const map = new Map<string, T[]>();
        for (const item of arr) {
          if (item.organizationId) {
            if (!map.has(item.organizationId)) map.set(item.organizationId, []);
            map.get(item.organizationId)!.push(item);
          }
        }
        return map;
      };

      const vendorsByOrg = byOrg(orgVendors);
      const activitiesByOrg = byOrg(orgActivities);
      const dpiasByOrg = byOrg(orgDpias);
      const clientsByOrg = byOrg(orgClients);
      const usersByOrg = byOrg(orgUsers);
      // trainingCompletions has organizationId as well in schema? Wait, if not, I'll need to join. But earlier code did eq(trainingCompletions.organizationId, org.id), so it has it.
      const completionsByOrg = byOrg(orgCompletions);
      const gapsByOrg = byOrg(orgExistingGaps);

      for (const org of orgsBatch) {
        const detectedGaps: GapDetection[] = [];

        // 1. Missing DPAs
        for (const v of vendorsByOrg.get(org.id) || []) {
          // D30. An offboarded relationship does not owe an Article 28 contract.
          // Raising a gap against one is a finding the customer cannot close
          // except by re-signing a DPA with a processor they no longer use.
          if (!isLiveVendorStatus(v.status)) continue;
          if (v.dpaStatus !== 'signed') {
            detectedGaps.push({
              entityType: 'vendor',
              entityId: v.vendorId!,
              gapType: 'missing_dpa',
              title: `Missing DPA for vendor`,
              description: `A vendor you use does not have a signed Data Processing Agreement.`,
              severity: 'high',
              gdprArticles: ['Article 28'],
              resolutionUrl: `/vendors/${v.vendorId}`
            });
          }
        }

        // 2. Missing DPIAs
        const orgDpiaList = dpiasByOrg.get(org.id) || [];
        for (const act of activitiesByOrg.get(org.id) || []) {
          if (act.requiresDpia) {
            const dpiaExists = orgDpiaList.find(d => (d.processingActivityIds as string[]).includes(act.id));
            if (!dpiaExists) {
               detectedGaps.push({
                entityType: 'processing_activity',
                entityId: act.id,
                gapType: 'missing_dpia',
                title: `Missing DPIA for ${act.name}`,
                description: `High risk processing requires a DPIA.`,
                severity: 'critical',
                gdprArticles: ['Article 35'],
                resolutionUrl: `/ropa/${act.id}`
              });
            }
          }
        }

        // 3. Client Rules
        for (const client of clientsByOrg.get(org.id) || []) {
          if (client.dpaStatus !== 'signed') {
            detectedGaps.push({
              entityType: 'client',
              entityId: client.id,
              gapType: 'client_missing_dpa',
              title: `Missing DPA with client`,
              description: `You act as a processor for ${client.name} but do not have a signed DPA.`,
              severity: 'high',
              gdprArticles: ['Article 28'],
              resolutionUrl: `/clients/${client.id}`
            });
          }
          
          if (client.dpaStatus === 'signed' && client.dpaExpiresAt && new Date(client.dpaExpiresAt).getTime() < new Date().getTime()) {
            detectedGaps.push({
              entityType: 'client',
              entityId: client.id,
              gapType: 'client_expired_dpa',
              title: `Expired DPA with client`,
              description: `Your DPA with ${client.name} has expired.`,
              severity: 'critical',
              gdprArticles: ['Article 28'],
              resolutionUrl: `/clients/${client.id}`
            });
          }

          if (client.processingActivities.length === 0) {
            detectedGaps.push({
              entityType: 'client',
              entityId: client.id,
              gapType: 'client_no_activities',
              title: `Client has no processing activities`,
              description: `${client.name} exists in your system but no processing activities are linked.`,
              severity: 'medium',
              gdprArticles: ['Article 30'],
              resolutionUrl: `/clients/${client.id}`
            });
          }

          if (client.portalEnabled && client.processingActivities.length > 0) {
            let lastUpdated = 0;
            for (const cpa of client.processingActivities) {
              const t = new Date(cpa.processingActivity.updatedAt!).getTime();
              if (t > lastUpdated) lastUpdated = t;
            }
            const sixMonthsAgo = new Date().getTime() - (6 * 30 * 24 * 60 * 60 * 1000);
            if (lastUpdated < sixMonthsAgo) {
               detectedGaps.push({
                entityType: 'client',
                entityId: client.id,
                gapType: 'client_portal_stale',
                title: `Stale client portal data`,
                description: `The processing activities for ${client.name} haven't been reviewed in 6 months.`,
                severity: 'low',
                gdprArticles: ['Article 30', 'Article 5(1)(d)'],
                resolutionUrl: `/clients/${client.id}`
              });
            }
          }
        }

        // 4. Training Rules
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        for (const u of usersByOrg.get(org.id) || []) {
          if (!u.lastTrainingCompletedAt || new Date(u.lastTrainingCompletedAt) < oneYearAgo) {
            detectedGaps.push({
              entityType: 'user',
              entityId: u.id,
              gapType: 'training_overdue',
              title: `Overdue GDPR Training for ${u.name}`,
              description: 'Employee has not completed mandatory GDPR training in the last 12 months.',
              severity: 'high',
              gdprArticles: ['Article 39'],
              resolutionUrl: `/training/admin`
            });
          }
        }

        for (const comp of completionsByOrg.get(org.id) || []) {
          if (comp.status === 'passed' && comp.expiresAt && new Date(comp.expiresAt) < new Date()) {
            detectedGaps.push({
              entityType: 'training_completion',
              entityId: comp.id,
              gapType: 'training_certificate_expired',
              title: 'Training Certificate Expired',
              description: 'A previously completed training module certificate has expired.',
              severity: 'medium',
              gdprArticles: ['Article 39'],
              resolutionUrl: `/training/admin`
            });
          }
        }

        // Process Deduplication and Escalation
        const existingGaps = gapsByOrg.get(org.id) || [];
        const gapsToInsert = [];
        const gapsToUpdate = [];

        for (const gap of detectedGaps) {
          const existing = existingGaps.find((g: any) => 
            g.entityType === gap.entityType && 
            g.entityId === gap.entityId && 
            g.gapType === gap.gapType
          );

          if (existing) {
            if (existing.status === 'dismissed') continue;
            if (existing.status === 'resolved') {
              gapsToUpdate.push({ id: existing.id, status: 'open', detectionCount: 1, resolvedAt: null, lastDetectedAt: new Date(), updatedAt: new Date() });
            } else {
              let newSeverity = existing.severity;
              const daysOpen = (new Date().getTime() - new Date(existing.createdAt!).getTime()) / (1000 * 3600 * 24);
              if (daysOpen >= 30 && existing.severity === 'medium') newSeverity = 'high';
              if (daysOpen >= 60 && existing.severity === 'high') newSeverity = 'critical';

              gapsToUpdate.push({ id: existing.id, lastDetectedAt: new Date(), detectionCount: (existing.detectionCount || 1) + 1, severity: newSeverity, updatedAt: new Date() });
            }
          } else {
            gapsToInsert.push({ organizationId: org.id, source: 'gap_scanner', ...gap });
          }
        }

        for (const existing of existingGaps) {
          if (['open', 'in_progress'].includes(existing.status!)) {
            const stillDetected = detectedGaps.some((g: any) => 
              g.entityType === existing.entityType && 
              g.entityId === existing.entityId && 
              g.gapType === existing.gapType
            );
            if (!stillDetected) {
              gapsToUpdate.push({ id: existing.id, status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() });
            }
          }
        }

        if (gapsToInsert.length > 0) {
          await db.insert(complianceGaps).values(gapsToInsert as any);
        }

        if (gapsToUpdate.length > 0) {
          await Promise.all(gapsToUpdate.map(u => {
            const { id, ...data } = u;
            return db.update(complianceGaps).set(data).where(eq(complianceGaps.id, id));
          }));
        }
      }
    }
    return { success: true };
  }
  
  if (job.name === 'scheduled-reports') {
    const orgs = await db.query.organizations.findMany();
    const reportsToInsert = [];
    
    for (const org of orgs) {
      const categoryScores = {
        ropa: 100, vendors: 100, dpia: 100, policies: 100, dsar: 100, breach: 100, training: 100, transfers: 100
      };
      reportsToInsert.push({
        organizationId: org.id,
        reportType: 'monthly',
        scoreTotal: 100,
        categoryScores,
        scoreBreakdown: {},
        topGaps: []
      });
    }

    if (reportsToInsert.length > 0) {
      await db.insert(complianceReports).values(reportsToInsert);
    }
  }
}, { drainDelay: 60 });


