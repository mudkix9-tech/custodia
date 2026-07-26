import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { complianceGaps, complianceReports, organizations, organizationVendors, processingActivities, dpias, clients, clientProcessingActivities, users, trainingCompletions } from 'db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';


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
    const orgs = await db.query.organizations.findMany();
    
    for (const org of orgs) {
      const detectedGaps: GapDetection[] = [];

      // 1. Missing DPAs
      const orgVendors = await db.query.organizationVendors.findMany({
        where: eq(organizationVendors.organizationId, org.id)
      });
      for (const v of orgVendors) {
        if (v.dpaStatus !== 'signed') {
          detectedGaps.push({
            entityType: 'vendor',
            entityId: v.vendorId,
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
      const orgActivities = await db.query.processingActivities.findMany({
        where: eq(processingActivities.organizationId, org.id)
      });
      const orgDpias = await db.query.dpias.findMany({
        where: eq(dpias.organizationId, org.id)
      });
      for (const act of orgActivities) {
        if (act.requiresDpia) {
          const dpiaExists = orgDpias.find(d => (d.processingActivityIds as string[]).includes(act.id));
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
      const orgClients = await db.query.clients.findMany({
        where: eq(clients.organizationId, org.id),
        with: { processingActivities: { with: { processingActivity: true } } }
      });

      for (const client of orgClients) {
        // client_missing_dpa
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
        
        // client_expired_dpa
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

        // client_no_activities
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

        // client_portal_stale
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
      const orgUsers = await db.query.users.findMany({
        where: eq(users.organizationId, org.id)
      });
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      for (const u of orgUsers) {
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

      const expiredCompletions = await db.query.trainingCompletions.findMany({
        where: eq(trainingCompletions.organizationId, org.id)
      });
      for (const comp of expiredCompletions) {
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

      // Process Deduplication and Escalation (only for scanner-sourced gaps)
      const existingGaps = await db.query.complianceGaps.findMany({
        where: and(
          eq(complianceGaps.organizationId, org.id),
          eq(complianceGaps.source, 'gap_scanner')
        )
      });

      for (const gap of detectedGaps) {
        const existing = existingGaps.find((g: any) => 
          g.entityType === gap.entityType && 
          g.entityId === gap.entityId && 
          g.gapType === gap.gapType
        );

        if (existing) {
          if (existing.status === 'dismissed') {
            continue; // Skip dismissed
          }
          if (existing.status === 'resolved') {
            // Reopen
            await db.update(complianceGaps).set({
              status: 'open',
              detectionCount: 1,
              resolvedAt: null,
              lastDetectedAt: new Date(),
              updatedAt: new Date()
            }).where(eq(complianceGaps.id, existing.id));
          } else {
            // Open/Acknowledged -> update detection count and escalate if needed
            let newSeverity = existing.severity;
            const daysOpen = (new Date().getTime() - new Date(existing.createdAt!).getTime()) / (1000 * 3600 * 24);
            
            if (daysOpen >= 30 && existing.severity === 'medium') newSeverity = 'high';
            if (daysOpen >= 60 && existing.severity === 'high') newSeverity = 'critical';

            await db.update(complianceGaps).set({
              lastDetectedAt: new Date(),
              detectionCount: (existing.detectionCount || 1) + 1,
              severity: newSeverity,
              updatedAt: new Date()
            }).where(eq(complianceGaps.id, existing.id));
          }
        } else {
          // Create new
          await db.insert(complianceGaps).values({
            organizationId: org.id,
            ...gap,
          });
        }
      }

      // Auto-resolve gaps that were not detected this time
      for (const existing of existingGaps) {
        if (['open', 'in_progress'].includes(existing.status!)) {
          const stillDetected = detectedGaps.some((g: any) => 
            g.entityType === existing.entityType && 
            g.entityId === existing.entityId && 
            g.gapType === existing.gapType
          );
          if (!stillDetected) {
            await db.update(complianceGaps).set({
              status: 'resolved',
              resolvedAt: new Date(),
              updatedAt: new Date()
            }).where(eq(complianceGaps.id, existing.id));
          }
        }
      }
    }
    return { success: true };
  }
  
  if (job.name === 'scheduled-reports') {
    // Generate compliance snapshots for all orgs
    const orgs = await db.query.organizations.findMany();
    for (const org of orgs) {
      // Calculate scores
      const categoryScores = {
        ropa: 100, // mock score for now
        vendors: 100,
        dpia: 100,
        policies: 100,
        dsar: 100,
        breach: 100,
        training: 100,
        transfers: 100
      };
      const scoreTotal = 100; // mock weighted sum

      await db.insert(complianceReports).values({
        organizationId: org.id,
        reportType: 'monthly',
        scoreTotal,
        categoryScores,
        scoreBreakdown: {},
        topGaps: []
      });
    }
  }
}, { drainDelay: 60 });

export async function scheduleComplianceJobs() {
  await complianceQueue.add('gap-scanner', {}, {
    repeat: { pattern: '0 2 * * *' } // Every day at 2 AM
  });
  
  // Note: For multi-timezone support, you would dynamically schedule these per-org
  await complianceQueue.add('scheduled-reports', {}, {
    repeat: { pattern: '0 0 1 * *' } // 1st of every month
  });
}
