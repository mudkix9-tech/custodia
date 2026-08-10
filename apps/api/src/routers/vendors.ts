import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { vendorJobsQueue } from '../workers/vendors.js';
import { db } from '../db.js';
import { vendors, organizationVendors, users, vendorSubProcessors, vendorSubProcessorChanges, vendorIncidents, organizationVendorIncidentAlerts, vendorQuestionnaires, vendorDiscoveries, organizations, vendorAssessments, complianceGaps } from 'db';
import { eq, and, isNull, inArray, or, sql, desc } from 'drizzle-orm';
import { router, publicProcedure, protectedProcedure, requirePermission } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { isAdequateDestination } from '../constants/transferDestinations.js';

import { calculateVendorRisk } from '../lib/vendorRisk.js';
import { enforceLimit } from '../lib/billing.js';
export { calculateVendorRisk };

export async function updateVendorRiskScore(dbInstance: any, orgId: string, vendorId: string) {
  const [vendor] = await dbInstance.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) return;

  const [orgVendor] = await dbInstance.select().from(organizationVendors).where(and(
    eq(organizationVendors.organizationId, orgId),
    eq(organizationVendors.vendorId, vendorId)
  ));
  if (!orgVendor) return;

  const subs = await dbInstance.select()
    .from(vendorSubProcessors)
    .where(eq(vendorSubProcessors.parentVendorId, vendorId));
  const subProcessorsCount = subs.length;

  // Retrieve score modifier from completed/expired vendor assessments
  const assessments = await dbInstance.select()
    .from(vendorAssessments)
    .where(and(
      eq(vendorAssessments.organizationId, orgId),
      eq(vendorAssessments.vendorId, orgVendor.id)
    ))
    .orderBy(desc(vendorAssessments.completedAt), desc(vendorAssessments.expiresAt));

  let scoreModifier = 0;
  if (assessments.length > 0) {
    const latest = assessments[0];
    if (latest.status === 'completed') {
      const baseVal = latest.score || 0;
      const aiAdj = latest.scoreAdjustment || 0;
      const finalQScore = Math.max(0, Math.min(100, baseVal + aiAdj));
      
      if (finalQScore >= 50) {
        scoreModifier = Math.round(-10 * ((finalQScore - 50) / 50));
      } else {
        scoreModifier = Math.round(25 * ((50 - finalQScore) / 50));
      }
    } else if (latest.status === 'expired') {
      scoreModifier = 25;
    }
  }

  // Retrieve DPIA compliance gaps for this vendor
  const dpiaGaps = await dbInstance.select().from(complianceGaps).where(and(
    eq(complianceGaps.organizationId, orgId),
    eq(complianceGaps.entityType, 'vendor'),
    eq(complianceGaps.entityId, orgVendor.id),
    eq(complianceGaps.source, 'dpia')
  ));

  const { score, level, factors } = calculateVendorRisk(vendor, orgVendor, subProcessorsCount, scoreModifier, dpiaGaps);

  await dbInstance.update(organizationVendors)
    .set({
      riskScore: score,
      riskLevel: level,
      riskFactors: factors,
      lastRiskAssessment: new Date()
    })
    .where(eq(organizationVendors.id, orgVendor.id));

  if (orgEmbeddingsQueue) {
    await orgEmbeddingsQueue.add('embed-vendor', {
      orgId: orgId,
      entityType: 'vendor',
      entityId: orgVendor.id,
      action: 'upsert'
    });
  }
}

export async function recalculateVendorRiskForAllOrgs(dbInstance: any, vendorId: string) {
  const [vendor] = await dbInstance.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) return;

  const orgVendors = await dbInstance.select().from(organizationVendors).where(eq(organizationVendors.vendorId, vendorId));
  
  const subs = await dbInstance.select()
    .from(vendorSubProcessors)
    .where(eq(vendorSubProcessors.parentVendorId, vendorId));
  const subProcessorsCount = subs.length;

  // Retrieve DPIA compliance gaps for all matched organization vendors at once to avoid N+1 queries
  const orgIds: string[] = Array.from(new Set(orgVendors.map((ov: any) => ov.organizationId as string)));
  let allDpiaGaps: any[] = [];
  if (orgIds.length > 0) {
    allDpiaGaps = await dbInstance.select().from(complianceGaps).where(and(
      inArray(complianceGaps.organizationId, orgIds),
      eq(complianceGaps.entityType, 'vendor'),
      eq(complianceGaps.source, 'dpia')
    ));
  }

  let allAssessments: any[] = [];
  if (orgIds.length > 0) {
    allAssessments = await dbInstance.select()
      .from(vendorAssessments)
      .where(and(
        inArray(vendorAssessments.organizationId, orgIds),
        eq(vendorAssessments.vendorId, vendorId)
      ))
      .orderBy(desc(vendorAssessments.completedAt), desc(vendorAssessments.expiresAt));
  }

  const updates: Array<{ id: string; score: number; level: string; factors: any }> = [];

  for (const orgVendor of orgVendors) {
    const assessments = allAssessments.filter((a: any) => a.organizationId === orgVendor.organizationId);

    let scoreModifier = 0;
    if (assessments.length > 0) {
      const latest = assessments[0];
      if (latest.status === 'completed') {
        const baseVal = latest.score || 0;
        const aiAdj = latest.scoreAdjustment || 0;
        const finalQScore = Math.max(0, Math.min(100, baseVal + aiAdj));
        
        if (finalQScore >= 50) {
          scoreModifier = Math.round(-10 * ((finalQScore - 50) / 50));
        } else {
          scoreModifier = Math.round(25 * ((50 - finalQScore) / 50));
        }
      } else if (latest.status === 'expired') {
        scoreModifier = 25;
      }
    }

    const vendorGaps = allDpiaGaps.filter((gap: any) => 
      gap.organizationId === orgVendor.organizationId && 
      gap.entityId === orgVendor.id
    );

    const { score, level, factors } = calculateVendorRisk(vendor, orgVendor, subProcessorsCount, scoreModifier, vendorGaps);
    
    updates.push({ id: orgVendor.id, score, level, factors });

    if (orgEmbeddingsQueue) {
      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: orgVendor.organizationId,
        entityType: 'vendor',
        entityId: orgVendor.id,
        action: 'upsert'
      });
    }
  }

  if (updates.length > 0) {
    await dbInstance.update(organizationVendors)
      .set({
        riskScore: sql`
          CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${u.score}`), sql` `)}
          END
        `,
        riskLevel: sql`
          CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${u.level}`), sql` `)}
          END
        `,
        riskFactors: sql`
          CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${JSON.stringify(u.factors)}::jsonb`), sql` `)}
          END
        `,
        lastRiskAssessment: new Date()
      })
      .where(inArray(organizationVendors.id, updates.map(u => u.id)));
  }
}

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

export const vendorsRouter = router({
  // GLOBAL
  getAllGlobal: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(vendors).where(eq(vendors.isGlobal, true));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.select().from(vendors).where(eq(vendors.id, input.id));
      return result[0];
    }),

  suggestGlobal: protectedProcedure.query(async ({ ctx }) => {
    // Mock suggestion for now. Can be enhanced to look at what's missing.
    return await ctx.db.select().from(vendors).where(eq(vendors.isGlobal, true)).limit(5);
  }),

  // ORG
  getOrgVendors: protectedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const res = await paginatedQuery(
        organizationVendors,
        ctx.user.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );

      const vendorIds = res.data.map((ov: any) => ov.vendorId);
      let vendorsMap = new Map();

      if (vendorIds.length > 0) {
        const vendorDataList = await ctx.db.select().from(vendors).where(inArray(vendors.id, vendorIds));
        for (const v of vendorDataList) {
          vendorsMap.set(v.id, v);
        }
      }

      res.data = res.data.map((ov: any) => {
        const v = vendorsMap.get(ov.vendorId) || {};
        return {
          ...v,
          orgVendorId: ov.id,
          dpaStatus: ov.dpaStatus,
          dpaSignedAt: ov.dpaSignedAt,
          dpaExpiresAt: ov.dpaExpiresAt,
          tiaCompleted: ov.tiaCompleted,
          usingEuHosting: ov.usingEuHosting,
          riskScore: ov.riskScore,
          riskLevel: ov.riskLevel,
          lastReviewedAt: ov.lastReviewedAt,
        };
      });

      return res;
    }),

  getOrgVendorDetails: protectedProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.organizationId, ctx.user.orgId),
        eq(organizationVendors.vendorId, input.vendorId)
      ));
      return records[0];
    }),

  linkVendor: protectedProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await enforceLimit(ctx.db, ctx.user.orgId, 'vendors', 1);
      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
      if (!vendor) throw new Error("Vendor not found");

      // Fetch sub-processor count
      const subs = await ctx.db.select()
        .from(vendorSubProcessors)
        .where(eq(vendorSubProcessors.parentVendorId, input.vendorId));
      const subProcessorsCount = subs.length;

      // Calculate initial risk
      const { score, level, factors } = calculateVendorRisk(
        vendor,
        { dpaStatus: 'not_started', dataCategoriesShared: [], dataSubjectVolume: '<1K' },
        subProcessorsCount
      );

      const [newLink] = await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user.orgId,
        vendorId: input.vendorId,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date(),
        addedBy: ctx.user.id,
      }).returning();
      
      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user.orgId,
        entityType: 'vendor',
        entityId: newLink.id,
        action: 'upsert'
      });

      return newLink;
    }),

  updateOrgVendor: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      dpaStatus: z.string().optional(),
      dpaExpiresAt: z.string().nullable().optional(),
      usingEuHosting: z.boolean().optional(),
      tiaCompleted: z.boolean().optional(),
      notes: z.string().optional(),
      dataSubjectVolume: z.enum(['<1K', '1K-10K', '10K-100K', '100K+']).optional(),
      certifications: z.array(z.string()).optional(),
      contractRenewalDate: z.string().nullable().optional(),
      dpaClauseCoverage: z.record(z.boolean()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [orgVendor] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user.orgId),
        eq(organizationVendors.vendorId, input.vendorId)
      ));
      if (!orgVendor) throw new Error("Link not found");

      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));

      const updates: any = {};
      if (input.dpaStatus !== undefined) updates.dpaStatus = input.dpaStatus;
      if (input.dpaExpiresAt !== undefined) updates.dpaExpiresAt = input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null;
      if (input.usingEuHosting !== undefined) updates.usingEuHosting = input.usingEuHosting;
      if (input.tiaCompleted !== undefined) updates.tiaCompleted = input.tiaCompleted;
      if (input.notes !== undefined) updates.dpaNotes = input.notes;
      if (input.dataSubjectVolume !== undefined) updates.dataSubjectVolume = input.dataSubjectVolume;
      if (input.certifications !== undefined) updates.certifications = input.certifications;
      if (input.contractRenewalDate !== undefined) updates.contractRenewalDate = input.contractRenewalDate ? new Date(input.contractRenewalDate) : null;
      if (input.dpaClauseCoverage !== undefined) updates.dpaClauseCoverage = input.dpaClauseCoverage;

      // Fetch sub-processor count
      const subs = await ctx.db.select()
        .from(vendorSubProcessors)
        .where(eq(vendorSubProcessors.parentVendorId, input.vendorId));
      const subProcessorsCount = subs.length;

      // Recalculate Risk
      const mergedOrgVendor = { ...orgVendor, ...updates };
      const { score, level, factors } = calculateVendorRisk(vendor, mergedOrgVendor, subProcessorsCount);
      updates.riskScore = score;
      updates.riskLevel = level;
      updates.riskFactors = factors;
      updates.lastRiskAssessment = new Date();

      await ctx.db.update(organizationVendors)
        .set(updates)
        .where(eq(organizationVendors.id, orgVendor.id));

      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user.orgId,
        entityType: 'vendor',
        entityId: orgVendor.id,
        action: 'upsert'
      });

      return { success: true };
    }),

  // CUSTOM VENDORS
  createCustom: protectedProcedure
    .input(z.object({
      name: z.string(),
      website: z.string().optional(),
      headquartersCountry: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      euHostingAvailable: z.boolean().optional(),
      securityCertifications: z.array(z.string()).optional(),
      dataSubjectVolume: z.enum(['<1K', '1K-10K', '10K-100K', '100K+']).optional(),
      certifications: z.array(z.string()).optional(),
      contractRenewalDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await enforceLimit(ctx.db, ctx.user.orgId, 'vendors', 1);
      const [newVendor] = await ctx.db.insert(vendors).values({
        name: input.name,
        website: input.website,
        headquartersCountry: input.headquartersCountry,
        category: input.category,
        description: input.description,
        euHostingAvailable: input.euHostingAvailable,
        securityCertifications: input.securityCertifications,
        isGlobal: false,
        organizationId: ctx.user.orgId
      }).returning();

      if (!newVendor) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Calculate initial risk
      const initialOrgVendor = {
        dpaStatus: 'not_started',
        dataSubjectVolume: input.dataSubjectVolume || '<1K',
        certifications: input.certifications || [],
        contractRenewalDate: input.contractRenewalDate ? new Date(input.contractRenewalDate) : null
      };

      const { score, level, factors } = calculateVendorRisk(newVendor, initialOrgVendor, 0);

      const [newLink] = await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user.orgId,
        vendorId: newVendor.id,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date(),
        dataSubjectVolume: input.dataSubjectVolume || '<1K',
        certifications: input.certifications || [],
        contractRenewalDate: input.contractRenewalDate ? new Date(input.contractRenewalDate) : null,
        addedBy: ctx.user.id,
      }).returning();

      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user.orgId,
        entityType: 'vendor',
        entityId: newLink.id,
        action: 'upsert'
      });

      return newVendor;
    }),

  // SUB-PROCESSORS
  subProcessors: router({
    // Sub-processor records describe a vendor, not a tenant, so these are readable
    // across organisations by design.
    list: protectedProcedure
      .use(requirePermission('vendors', 'view'))
      .input(z.object({ parentVendorId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // Fetch sub-processors and join with vendors if linked
        const records = await ctx.db.select({
          subProcessor: vendorSubProcessors,
          vendor: vendors
        })
        .from(vendorSubProcessors)
        .leftJoin(vendors, eq(vendorSubProcessors.subProcessorVendorId, vendors.id))
        .where(eq(vendorSubProcessors.parentVendorId, input.parentVendorId));
        
        return records.map((r: any) => ({
          ...r.subProcessor,
          vendorData: r.vendor // Will be null for unlinked sub-processors
        }));
      }),

    addLinked: protectedProcedure
      .input(z.object({
        parentVendorId: z.string().uuid(),
        subProcessorVendorId: z.string().uuid(),
        purpose: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const [sub] = await ctx.db.insert(vendorSubProcessors).values({
          parentVendorId: input.parentVendorId,
          subProcessorVendorId: input.subProcessorVendorId,
          purpose: input.purpose
        }).returning();
        
        await recalculateVendorRiskForAllOrgs(ctx.db, input.parentVendorId);
        return sub;
      }),

    addUnlinked: protectedProcedure
      .input(z.object({
        parentVendorId: z.string().uuid(),
        name: z.string().min(1),
        country: z.string().length(2).optional(),
        purpose: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const [sub] = await ctx.db.insert(vendorSubProcessors).values({
          parentVendorId: input.parentVendorId,
          name: input.name,
          country: input.country,
          purpose: input.purpose
        }).returning();
        
        await recalculateVendorRiskForAllOrgs(ctx.db, input.parentVendorId);
        return sub;
      }),

    remove: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // Only sub-processors of a vendor this organisation owns. Deleting a row
        // under a global catalogue vendor would silently change every other
        // tenant's sub-processor list and their derived risk scores.
        const [existing] = await ctx.db.select({ row: vendorSubProcessors })
          .from(vendorSubProcessors)
          .innerJoin(vendors, eq(vendorSubProcessors.parentVendorId, vendors.id))
          .where(and(
            eq(vendorSubProcessors.id, input.id),
            eq(vendors.organizationId, ctx.user!.orgId),
          ))
          .then((rows: any[]) => rows.map(r => r.row));
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sub-processor not found' });

        const [removed] = await ctx.db.delete(vendorSubProcessors)
          .where(eq(vendorSubProcessors.id, input.id))
          .returning();
          
        await recalculateVendorRiskForAllOrgs(ctx.db, existing.parentVendorId);
        return removed;
      }),
      
    // NOTE: `notifiedAt` lives on the shared row, so one organisation acknowledging
    // a sub-processor change marks it acknowledged for every organisation. That is a
    // data-model bug (the flag belongs on a per-org join), not something an
    // organisation filter here can fix -- scoping this to org-owned vendors would
    // instead break the change-notification flow, which exists for global vendors.
    // Gated on permission for now and recorded in known-concerns.md.
    markNotified: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [updated] = await ctx.db.update(vendorSubProcessors)
          .set({ notifiedAt: new Date() })
          .where(eq(vendorSubProcessors.id, input.id))
          .returning();
        return updated;
      })
  }),

  getRiskStats: protectedProcedure.query(async ({ ctx }) => {
    const list = await ctx.db.select().from(organizationVendors).where(eq(organizationVendors.organizationId, ctx.user.orgId));
    const total = list.length;
    const highOrCritical = list.filter((v: any) => v.riskLevel === 'high' || v.riskLevel === 'critical').length;
    const low = list.filter((v: any) => v.riskLevel === 'low').length;
    const medium = list.filter((v: any) => v.riskLevel === 'medium').length;
    return { total, highOrCritical, low, medium };
  }),

  getSubProcessorChanges: protectedProcedure
    .input(z.object({ orgVendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ov] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user.orgId)
        ));
      if (!ov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization vendor link not found' });

      const list = await ctx.db.select({
        change: vendorSubProcessorChanges,
        reviewerName: users.name
      })
      .from(vendorSubProcessorChanges)
      .leftJoin(users, eq(vendorSubProcessorChanges.reviewedBy, users.id))
      .where(eq(vendorSubProcessorChanges.orgVendorId, input.orgVendorId))
      .orderBy(vendorSubProcessorChanges.detectedAt);

      return list.map((item: any) => ({
        ...item.change,
        reviewerName: item.reviewerName
      }));
    }),

  reviewSubProcessorChange: protectedProcedure
    .input(z.object({
      changeId: z.string().uuid(),
      status: z.enum(['acknowledged', 'objected']),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [change] = await ctx.db.select()
        .from(vendorSubProcessorChanges)
        .where(and(
          eq(vendorSubProcessorChanges.id, input.changeId),
          eq(vendorSubProcessorChanges.organizationId, ctx.user.orgId)
        ));
      if (!change) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sub-processor change record not found' });

      const [updated] = await ctx.db.update(vendorSubProcessorChanges)
        .set({
          status: input.status,
          notes: input.notes || null,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        })
        .where(eq(vendorSubProcessorChanges.id, input.changeId))
        .returning();

      return updated;
    }),

  getIncidentsForVendor: protectedProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [v] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
      if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      const slug = v.slug || v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const list = await ctx.db.select({
        incident: vendorIncidents,
        alertId: organizationVendorIncidentAlerts.id,
        alertStatus: organizationVendorIncidentAlerts.status,
        acknowledgedAt: organizationVendorIncidentAlerts.acknowledgedAt,
        actionNotes: organizationVendorIncidentAlerts.actionNotes,
        reviewerName: users.name
      })
      .from(vendorIncidents)
      .leftJoin(
        organizationVendorIncidentAlerts,
        and(
          eq(organizationVendorIncidentAlerts.incidentId, vendorIncidents.id),
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user.orgId)
        )
      )
      .leftJoin(users, eq(organizationVendorIncidentAlerts.acknowledgedBy, users.id))
      .where(
        and(
          eq(vendorIncidents.vendorSlug, slug),
          or(
            eq(vendorIncidents.status, 'published'),
            sql`organization_vendor_incident_alerts.id IS NOT NULL`
          )
        )
      )
      .orderBy(vendorIncidents.incidentDate);

      return list.map((item: any) => ({
        ...item.incident,
        alertId: item.alertId,
        alertStatus: item.alertStatus || 'unread',
        acknowledgedAt: item.acknowledgedAt,
        actionNotes: item.actionNotes,
        reviewerName: item.reviewerName
      }));
    }),

  getUnreadIncidentAlertsCount: protectedProcedure
    .query(async ({ ctx }) => {
      const list = await ctx.db.select()
        .from(organizationVendorIncidentAlerts)
        .where(and(
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user.orgId),
          eq(organizationVendorIncidentAlerts.status, 'unread')
        ));
      return { count: list.length };
    }),

  reviewIncidentAlert: protectedProcedure
    .input(z.object({
      alertId: z.string().uuid(),
      status: z.enum(['unread', 'acknowledged', 'action_taken', 'dismissed']),
      actionNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendorIncidentAlerts)
        .where(and(
          eq(organizationVendorIncidentAlerts.id, input.alertId),
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' });

      const [updated] = await ctx.db.update(organizationVendorIncidentAlerts)
        .set({
          status: input.status,
          actionNotes: input.actionNotes || null,
          acknowledgedBy: ctx.user.id,
          acknowledgedAt: new Date()
        })
        .where(eq(organizationVendorIncidentAlerts.id, input.alertId))
        .returning();

      return updated;
    }),

  // Publishing fans an alert out to every organisation subscribed to this vendor,
  // so this is a platform-operator action sitting on a tenant-facing router. It had
  // no permission check at all; `manage` is the narrowest gate available today.
  // Recorded in known-concerns.md -- it wants a real platform-admin role.
  publishIncident: protectedProcedure
    .use(requirePermission('vendors', 'manage'))
    .input(z.object({ incidentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [incident] = await ctx.db.select().from(vendorIncidents).where(eq(vendorIncidents.id, input.incidentId));
      if (!incident) throw new TRPCError({ code: 'NOT_FOUND', message: 'Incident not found' });
      if (incident.status === 'published') return incident;

      const [updated] = await ctx.db.update(vendorIncidents)
        .set({ status: 'published' })
        .where(eq(vendorIncidents.id, input.incidentId))
        .returning();

      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.slug, incident.vendorSlug));
      if (vendor) {
        const { publishIncidentAndAlertOrgs } = await import('../workers/incidents.js');
        await publishIncidentAndAlertOrgs(input.incidentId, vendor, updated);
      }

      return updated;
    }),

  getPrivacyAlternatives: protectedProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      if (!vendor.category) return [];

      // Fetch global vendors in the same category, sorted by risk score ascending
      const alternatives = await ctx.db.select()
        .from(vendors)
        .where(and(
          eq(vendors.category, vendor.category),
          eq(vendors.isGlobal, true),
          sql`${vendors.id} != ${input.vendorId}`
        ))
        .orderBy(sql`COALESCE(${vendors.riskScore}, 100) ASC`);

      return alternatives;
    }),

  confirmDpaAnalysis: protectedProcedure
    .input(z.object({
      orgVendorId: z.string().uuid(),
      dpaClauseCoverage: z.record(z.boolean()),
      dpaStatus: z.string().optional(),
      dpaNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization vendor link not found' });

      const updates: any = {
        dpaClauseCoverage: input.dpaClauseCoverage,
        dpaAnalysisStatus: 'confirmed'
      };
      if (input.dpaStatus) updates.dpaStatus = input.dpaStatus;
      if (input.dpaNotes !== undefined) updates.dpaNotes = input.dpaNotes;

      const [updated] = await ctx.db.update(organizationVendors)
        .set(updates)
        .where(eq(organizationVendors.id, input.orgVendorId))
        .returning();

      // Recalculate risk
      await updateVendorRiskScore(ctx.db, ctx.user.orgId, existing.vendorId);

      return updated;
    }),

  saveDpaAnalysisDraft: protectedProcedure
    .input(z.object({
      orgVendorId: z.string().uuid(),
      dpaAiAnalysis: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization vendor link not found' });

      const [updated] = await ctx.db.update(organizationVendors)
        .set({
          dpaAiAnalysis: input.dpaAiAnalysis,
          dpaAnalysisStatus: 'pending_review'
        })
        .where(eq(organizationVendors.id, input.orgVendorId))
        .returning();

      return updated;
    }),

  getQuestionnaires: protectedProcedure
    .input(z.object({ orgVendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(and(
          eq(vendorQuestionnaires.orgVendorId, input.orgVendorId),
          eq(vendorQuestionnaires.organizationId, ctx.user.orgId)
        ))
        .orderBy(desc(vendorQuestionnaires.createdAt));
    }),

  createQuestionnaire: protectedProcedure
    .input(z.object({
      orgVendorId: z.string().uuid(),
      questions: z.array(z.object({
        id: z.string(),
        text: z.string(),
        category: z.string(),
        rationale: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const [orgVendor] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user.orgId)
        ));
      if (!orgVendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const [newQ] = await ctx.db.insert(vendorQuestionnaires)
        .values({
          organizationId: ctx.user.orgId,
          vendorId: orgVendor.vendorId,
          orgVendorId: input.orgVendorId,
          questions: input.questions,
          status: 'draft',
          promptVersion: 'v1'
        })
        .returning();

      return newQ;
    }),

  confirmQuestionnaire: protectedProcedure
    .input(z.object({
      questionnaireId: z.string().uuid(),
      scoreModifier: z.number().min(-10).max(25),
      aiScore: z.number().optional(),
      aiAnalysis: z.any().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(and(
          eq(vendorQuestionnaires.id, input.questionnaireId),
          eq(vendorQuestionnaires.organizationId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      const updates: any = {
        scoreModifier: input.scoreModifier,
        status: 'reviewed',
        isAiAssisted: false,
        updatedAt: new Date()
      };
      if (input.aiScore !== undefined) updates.aiScore = input.aiScore;
      if (input.aiAnalysis !== undefined) updates.aiAnalysis = input.aiAnalysis;

      const [updated] = await ctx.db.update(vendorQuestionnaires)
        .set(updates)
        .where(eq(vendorQuestionnaires.id, input.questionnaireId))
        .returning();

      // Recalculate risk score for this vendor
      await updateVendorRiskScore(ctx.db, ctx.user.orgId, existing.vendorId);

      return updated;
    }),

  getQuestionnaireByToken: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.select({
        questionnaire: vendorQuestionnaires,
        vendor: vendors
      })
      .from(vendorQuestionnaires)
      .leftJoin(vendors, eq(vendorQuestionnaires.vendorId, vendors.id))
      .where(eq(vendorQuestionnaires.token, input.token));

      const record = records[0];
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      return {
        id: record.questionnaire.id,
        status: record.questionnaire.status,
        vendorName: record.vendor?.name || 'Unknown Vendor',
        vendorWebsite: record.vendor?.website || '',
        questions: record.questionnaire.questions,
        answers: record.questionnaire.answers || []
      };
    }),

  submitQuestionnaireAnswers: publicProcedure
    .input(z.object({
      token: z.string().uuid(),
      answers: z.array(z.object({
        questionId: z.string(),
        textAnswer: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(eq(vendorQuestionnaires.token, input.token));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      const [updated] = await ctx.db.update(vendorQuestionnaires)
        .set({
          answers: input.answers,
          status: 'submitted',
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(vendorQuestionnaires.token, input.token))
        .returning();

      return { success: true };
    }),

  getDiscoveries: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
      status: z.enum(['undocumented', 'added_to_register', 'dismissed', 'false_positive']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vendorDiscoveries.organizationId, ctx.user.orgId)];
      if (input.status) {
        conditions.push(eq(vendorDiscoveries.status, input.status));
      }

      const list = await ctx.db.select({
        discovery: vendorDiscoveries,
        matchedVendor: vendors
      })
      .from(vendorDiscoveries)
      .leftJoin(vendors, eq(vendorDiscoveries.matchedVendorId, vendors.id))
      .where(and(...conditions))
      .orderBy(desc(vendorDiscoveries.lastDetectedAt))
      .limit(input.limit);

      // Resolve each detected host against the tracker registry, so a discovery
      // arrives with the consent category it needs already attached. Whoever
      // triages this inbox is the person who has to decide whether the banner
      // covers it, and that decision is unanswerable from a bare hostname.
      const { loadTrackerRegistry, matchTrackerByDomain } = await import('../lib/trackerRegistry.js');
      const registry = await loadTrackerRegistry(ctx.db);

      return list.map((row: any) => {
        const tracker = matchTrackerByDomain(row.discovery.detectedDomain, registry);
        return {
          ...row,
          tracker: tracker
            ? {
                trackerKey: tracker.trackerKey,
                provider: tracker.provider,
                requiredCategory: tracker.requiredCategory,
                consentModeSupported: tracker.consentModeSupported,
              }
            : null,
        };
      });
    }),

  getUndocumentedCount: protectedProcedure
    .query(async ({ ctx }) => {
      const [result] = await ctx.db.select({
        count: sql<number>`count(*)::int`
      })
      .from(vendorDiscoveries)
      .where(and(
        eq(vendorDiscoveries.organizationId, ctx.user.orgId),
        eq(vendorDiscoveries.status, 'undocumented')
      ));
      return result?.count || 0;
    }),

  triggerDiscoveryScan: protectedProcedure
    .input(z.object({
      websiteUrl: z.string().url().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, ctx.user.orgId));
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

      const websiteUrl = input.websiteUrl || (org.settings as any)?.websiteUrl || `https://${org.slug}.com`;
      let domain = '';
      try {
        const urlObj = new URL(websiteUrl);
        domain = urlObj.hostname.replace(/^www\./, '');
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid website URL provided' });
      }

      if (vendorJobsQueue) {
        await vendorJobsQueue.add('vendor-discovery', {
          organizationId: ctx.user.orgId,
          domain,
          websiteUrl
        });
      }

      return { success: true };
    }),

  dismissDiscovery: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(vendorDiscoveries)
        .set({
          status: 'dismissed',
          resolvedBy: ctx.user.id,
          resolvedAt: new Date()
        })
        .where(and(
          eq(vendorDiscoveries.id, input.id),
          eq(vendorDiscoveries.organizationId, ctx.user.orgId)
        ))
        .returning();
      return updated;
    }),

  confirmDiscovery: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      vendorId: z.string().uuid().optional(),
      customVendorData: z.object({
        name: z.string(),
        website: z.string().optional(),
        category: z.string().optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [discovery] = await ctx.db.select().from(vendorDiscoveries).where(and(
        eq(vendorDiscoveries.id, input.id),
        eq(vendorDiscoveries.organizationId, ctx.user.orgId)
      ));
      if (!discovery) throw new TRPCError({ code: 'NOT_FOUND', message: 'Discovery record not found' });

      let finalVendorId = input.vendorId;

      if (!finalVendorId && input.customVendorData) {
        const [newVendor] = await ctx.db.insert(vendors).values({
          name: input.customVendorData.name,
          website: input.customVendorData.website || `https://${discovery.detectedDomain}`,
          category: input.customVendorData.category || 'Other',
          isGlobal: false,
          isAutoDiscovered: true,
          organizationId: ctx.user.orgId
        }).returning();

        if (!newVendor) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create custom vendor' });
        finalVendorId = newVendor.id;
      }

      if (!finalVendorId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Either vendorId or customVendorData is required' });
      }

      // Check if already linked
      const [existingLink] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user.orgId),
        eq(organizationVendors.vendorId, finalVendorId)
      ));

      if (!existingLink) {
        const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, finalVendorId));
        const { score, level, factors } = calculateVendorRisk(
          vendor,
          { dpaStatus: 'not_started', dataCategoriesShared: [], dataSubjectVolume: '<1K' },
          0
        );

        const [newLink] = await ctx.db.insert(organizationVendors).values({
          organizationId: ctx.user.orgId,
          vendorId: finalVendorId,
          dpaStatus: 'not_started',
          riskScore: score,
          riskLevel: level,
          riskFactors: factors,
          lastRiskAssessment: new Date(),
          addedBy: ctx.user.id
        }).returning();

        if (orgEmbeddingsQueue) {
          await orgEmbeddingsQueue.add('embed-vendor', {
            orgId: ctx.user.orgId,
            entityType: 'vendor',
            entityId: newLink.id,
            action: 'upsert'
          });
        }
      }

      const [updated] = await ctx.db.update(vendorDiscoveries)
        .set({
          status: 'added_to_register',
          matchedVendorId: finalVendorId,
          resolvedBy: ctx.user.id,
          resolvedAt: new Date()
        })
        .where(eq(vendorDiscoveries.id, input.id))
        .returning();

      return updated;
    }),

  verifyVendorProfile: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(vendors)
        .set({
          isAutoDiscovered: false,
          lastVerifiedAt: new Date(),
          verifiedBy: ctx.user.id
        })
        .where(and(
          eq(vendors.id, input.vendorId),
          eq(vendors.organizationId, ctx.user.orgId)
        ))
        .returning();

      return updated;
    }),
});
