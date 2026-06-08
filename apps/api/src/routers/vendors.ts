import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { db } from '../db.js';
import { vendors, organizationVendors, users, vendorSubProcessors } from 'db';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { isAdequateDestination } from '../constants/transferDestinations.js';

// Risk Algorithm (as requested)
export function calculateVendorRisk(vendor: any, orgVendor: any) {
  let score = 0; // 0 = lowest risk, 100 = highest risk

  // Jurisdiction (0-25 points)
  if (['US'].includes(vendor.headquartersCountry)) score += 20;
  else if (['CN', 'RU'].includes(vendor.headquartersCountry)) score += 25;
  else if (vendor.headquartersCountry && !isAdequateDestination(vendor.headquartersCountry)) score += 10;
  // EU-based vendors get 0

  // EU hosting availability (0-15 points)
  if (!vendor.euHostingAvailable) score += 15;
  else if (!orgVendor?.usingEuHosting) score += 5; // available but not confirmed in use

  // DPA status (0-20 points)
  if (orgVendor?.dpaStatus === 'signed') score += 0;
  else if (orgVendor?.dpaStatus === 'expired') score += 20;
  else score += 15; // not signed

  // Security certifications (0-15 points)
  const certs = vendor.securityCertifications || [];
  if (certs.includes('soc2_type2') && certs.includes('iso27001')) score += 0;
  else if (certs.length > 0) score += 5;
  else score += 15;

  // Transfer mechanism (0-10 points)
  if (vendor.headquartersCountry && !isAdequateDestination(vendor.headquartersCountry)) {
    const mechanisms = vendor.transferMechanisms || [];
    if (mechanisms.includes('adequacy_decision')) score += 0;
    else if (mechanisms.includes('standard_contractual_clauses')) score += 5;
    else score += 10;
  }

  // Breach history (0-15 points)
  const incidents = vendor.knownIncidents || [];
  const recentIncidents = incidents.filter((i: any) => {
    if (!i.date) return false;
    const diffTime = Math.abs(new Date().getTime() - new Date(i.date).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 365;
  });
  
  if (recentIncidents.length === 0) score += 0;
  else if (recentIncidents.length === 1) score += 8;
  else score += 15;

  // Derive tier
  let level = 'low';
  if (score <= 20) level = 'low';
  else if (score <= 45) level = 'medium';
  else if (score <= 70) level = 'high';
  else level = 'critical';

  return { score, level };
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

      // Calculate initial risk
      const { score, level } = calculateVendorRisk(vendor, { dpaStatus: 'not_started', usingEuHosting: false });

      const [newLink] = await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user.orgId,
        vendorId: input.vendorId,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        addedBy: ctx.user.id,
      }).returning();
      
      return newLink;
    }),

  updateOrgVendor: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      dpaStatus: z.string().optional(),
      dpaExpiresAt: z.string().nullable().optional(),
      usingEuHosting: z.boolean().optional(),
      tiaCompleted: z.boolean().optional(),
      notes: z.string().optional()
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

      // Recalculate Risk
      const mergedOrgVendor = { ...orgVendor, ...updates };
      const { score, level } = calculateVendorRisk(vendor, mergedOrgVendor);
      updates.riskScore = score;
      updates.riskLevel = level;

      await ctx.db.update(organizationVendors)
        .set(updates)
        .where(eq(organizationVendors.id, orgVendor.id));

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
      securityCertifications: z.array(z.string()).optional()
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

      // Link immediately
      const { score, level } = calculateVendorRisk(newVendor, { dpaStatus: 'not_started', usingEuHosting: input.euHostingAvailable });

      await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user.orgId,
        vendorId: newVendor.id,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        addedBy: ctx.user.id,
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
        return sub;
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [removed] = await ctx.db.delete(vendorSubProcessors)
          .where(eq(vendorSubProcessors.id, input.id))
          .returning();
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
  })
});
