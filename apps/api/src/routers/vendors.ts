import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { vendors, organizationVendors, users, vendorSubProcessors } from 'db';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { isAdequateDestination } from '../constants/transferDestinations.js';

import { calculateVendorRisk } from '../lib/vendorRisk.js';
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

  const { score, level, factors } = calculateVendorRisk(vendor, orgVendor, subProcessorsCount);

  await dbInstance.update(organizationVendors)
    .set({
      riskScore: score,
      riskLevel: level,
      riskFactors: factors,
      lastRiskAssessment: new Date()
    })
    .where(eq(organizationVendors.id, orgVendor.id));

  await orgEmbeddingsQueue.add('embed-vendor', {
    orgId: orgId,
    entityType: 'vendor',
    entityId: orgVendor.id,
    action: 'upsert'
  });
}

export async function recalculateVendorRiskForAllOrgs(dbInstance: any, vendorId: string) {
  const [vendor] = await dbInstance.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) return;

  const orgVendors = await dbInstance.select().from(organizationVendors).where(eq(organizationVendors.vendorId, vendorId));
  
  const subs = await dbInstance.select()
    .from(vendorSubProcessors)
    .where(eq(vendorSubProcessors.parentVendorId, vendorId));
  const subProcessorsCount = subs.length;

  for (const orgVendor of orgVendors) {
    const { score, level, factors } = calculateVendorRisk(vendor, orgVendor, subProcessorsCount);
    
    await dbInstance.update(organizationVendors)
      .set({
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date()
      })
      .where(eq(organizationVendors.id, orgVendor.id));

    await orgEmbeddingsQueue.add('embed-vendor', {
      orgId: orgVendor.organizationId,
      entityType: 'vendor',
      entityId: orgVendor.id,
      action: 'upsert'
    });
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
    list: protectedProcedure
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
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db.select().from(vendorSubProcessors).where(eq(vendorSubProcessors.id, input.id));
        if (!existing) throw new Error("Sub-processor not found");

        const [removed] = await ctx.db.delete(vendorSubProcessors)
          .where(eq(vendorSubProcessors.id, input.id))
          .returning();
          
        await recalculateVendorRiskForAllOrgs(ctx.db, existing.parentVendorId);
        return removed;
      }),
      
    markNotified: protectedProcedure
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
});
