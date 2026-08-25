import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { vendorJobsQueue } from '../workers/vendors.js';
import { db } from '../db.js';
import { vendors, organizationVendors, users, vendorSubProcessors, vendorSubProcessorChanges, vendorIncidents, organizationVendorIncidentAlerts, vendorQuestionnaires, vendorDiscoveries, organizations, vendorAssessments, complianceGaps } from 'db';
import { eq, and, isNull, inArray, or, sql, desc, asc, gte, lte, ilike, lt } from 'drizzle-orm';
import { router, publicProcedure, protectedProcedure, requirePermission } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { isAdequateDestination } from '../constants/transferDestinations.js';

import { calculateVendorRisk } from '../lib/vendorRisk.js';
import { enforceLimit } from '../lib/billing.js';
import { DPA_STATUS_SIGNED, DPA_STATUS_MISSING } from '../constants/dpaStatus.js';
import { csvDocument } from '../utils/csv.js';
import { TRANSFER_MECHANISMS } from '../constants/transferMechanisms.js';
import {
  parseCsvRows,
  buildColumnMapping,
  normaliseVendorRow,
  matchCatalogue,
  AUTO_LINK_THRESHOLD,
  type CatalogueEntry,
} from '../lib/vendorImport.js';
import { auditLogs } from 'db';
import {
  describeChanges,
  changeTypeOf,
} from '../lib/auditTrail.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
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
    // D6. A completed questionnaire moves the register only once a human has
    // reviewed it (`reviewedAt` set by assessments.reviewAssessment). Without
    // this gate the vendor's own favourable answers lowered their risk rating
    // the moment they hit submit -- self-attestation grading itself. An
    // *expired* invitation still carries +25: silence is not a favourable
    // answer, and it punishes rather than rewards.
    if (latest.status === 'completed' && latest.reviewedAt) {
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
    // vendorAssessments.vendorId FKs organizationVendors.id, not vendors.id --
    // matching it against the global id found no rows and silently dropped the
    // questionnaire modifier from every recalculated score.
    allAssessments = await dbInstance.select()
      .from(vendorAssessments)
      .where(and(
        inArray(vendorAssessments.organizationId, orgIds),
        inArray(vendorAssessments.vendorId, orgVendors.map((ov: any) => ov.id))
      ))
      .orderBy(desc(vendorAssessments.completedAt), desc(vendorAssessments.expiresAt));
  }

  const updates: Array<{ id: string; score: number; level: string; factors: any }> = [];

  for (const orgVendor of orgVendors) {
    const assessments = allAssessments.filter((a: any) => a.organizationId === orgVendor.organizationId && a.vendorId === orgVendor.id);

    let scoreModifier = 0;
    if (assessments.length > 0) {
      const latest = assessments[0];
      // D6 again -- same review gate as updateVendorRiskScore, or the two paths
      // would disagree about whether a questionnaire has been seen by a human.
      if (latest.status === 'completed' && latest.reviewedAt) {
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
    // Every branch of these CASE expressions is a bound parameter, so Postgres has
    // nothing to infer a type from and resolves the whole expression as `text` --
    // which it then refuses to assign to an integer column:
    //   column "risk_score" is of type integer but expression is of type text
    // The casts are what make this run at all. It threw on every invocation that
    // had a row to write, which is every sub-processor add/remove and every
    // catalogue-driven recalculation, and `tsc` sees a perfectly good SQL template.
    await dbInstance.update(organizationVendors)
      .set({
        riskScore: sql`
          (CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${u.score}`), sql` `)}
          END)::integer
        `,
        riskLevel: sql`
          (CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${u.level}`), sql` `)}
          END)::varchar(20)
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
  getAllGlobal: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
    return await ctx.db.select().from(vendors).where(eq(vendors.isGlobal, true));
  }),

  getById: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.select().from(vendors).where(eq(vendors.id, input.id));
      return result[0];
    }),

  suggestGlobal: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
    // Mock suggestion for now. Can be enhanced to look at what's missing.
    return await ctx.db.select().from(vendors).where(eq(vendors.isGlobal, true)).limit(5);
  }),

  // ORG
  getOrgVendors: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
      // D41. Server-side search and filters -- the register page previously had a
      // client-side name filter over whichever pages were loaded, so "no results"
      // meant "not in this page of 25".
      search: z.string().max(120).optional(),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      dpaStatus: z.string().max(50).optional(),
      status: z.string().max(50).optional(),
      category: z.string().max(100).optional(),
      sortBy: z.enum(['createdAt', 'name', 'riskScore']).default('createdAt'),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ ctx, input }) => {
      const conditions: any[] = [];

      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        conditions.push(sql`(${vendors.name} ILIKE ${term} OR ${organizationVendors.businessOwner} ILIKE ${term})`);
      }
      if (input.riskLevel) conditions.push(eq(organizationVendors.riskLevel, input.riskLevel));
      if (input.dpaStatus === 'missing') {
        conditions.push(or(eq(organizationVendors.dpaStatus, 'not_started'), isNull(organizationVendors.dpaStatus)));
      } else if (input.dpaStatus) {
        conditions.push(eq(organizationVendors.dpaStatus, input.dpaStatus));
      }
      if (input.status) conditions.push(eq(organizationVendors.status, input.status));
      if (input.category) conditions.push(eq(vendors.category, input.category));

      const res = await paginatedQuery(
        organizationVendors,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc',
        conditions,
      );

      const vendorIds = res.data.map((ov: any) => ov.vendorId);
      const vendorsMap = new Map<string, typeof vendors.$inferSelect>();

      if (vendorIds.length > 0) {
        const vendorDataList = await ctx.db.select().from(vendors).where(inArray(vendors.id, vendorIds));
        for (const v of vendorDataList) {
          vendorsMap.set(v.id, v);
        }
      }

      // Returned as a new object rather than assigned back onto res.data: this
      // endpoint hands out the vendor row merged with a few organisation_vendors
      // columns, which is not the organizationVendors row type paginatedQuery
      // infers. Mutating res.data laundered that difference through `any` and
      // left callers with a declared type the response never actually matched.
      let data = res.data.map((ov: any) => {
        const v: Partial<typeof vendors.$inferSelect> = vendorsMap.get(ov.vendorId) ?? {};
        return {
          ...v,
          orgVendorId: ov.id,
          status: ov.status,
          businessOwner: ov.businessOwner,
          criticality: ov.criticality,
          processingRole: ov.processingRole,
          dpaStatus: ov.dpaStatus,
          dpaSignedAt: ov.dpaSignedAt,
          dpaExpiresAt: ov.dpaExpiresAt,
          tiaCompleted: ov.tiaCompleted,
          usingEuHosting: ov.usingEuHosting,
          riskScore: ov.riskScore,
          riskLevel: ov.riskLevel,
          lastReviewedAt: ov.lastReviewedAt,
          nextReviewAt: ov.nextReviewAt,
          offboardedAt: ov.offboardedAt,
          dataCategoriesShared: ov.dataCategoriesShared ?? [],
        };
      });

      // Name and risk sorts happen here rather than in paginatedQuery: both are
      // properties of the joined row set, not of the organization_vendors row the
      // paginator walks, and keyset cursors over a joined sort are P2 territory
      // for one register page.
      if (input.sortBy !== 'createdAt') {
        const dir = input.sortDir === 'asc' ? 1 : -1;
        data = [...data].sort((a: any, b: any) => (
          input.sortBy === 'name'
            ? dir * String(a.name ?? '').localeCompare(String(b.name ?? ''))
            : dir * ((a.riskScore ?? 0) - (b.riskScore ?? 0))
        ));
      }

      return { ...res, data };
    }),

  getOrgVendorDetails: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, input.vendorId)
      ));
      return records[0];
    }),

  linkVendor: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await enforceLimit(ctx.db, ctx.user!.orgId, 'vendors', 1);
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
        organizationId: ctx.user!.orgId,
        vendorId: input.vendorId,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date(),
        addedBy: ctx.user!.id,
      }).returning();
      if (!newLink) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });
      
      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user!.orgId,
        entityType: 'vendor',
        entityId: newLink.id,
        action: 'upsert'
      });

      return newLink;
    }),

  updateOrgVendor: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      vendorId: z.string().uuid(),
      dpaStatus: z.string().optional(),
      dpaExpiresAt: z.string().nullable().optional(),
      dpaSignedAt: z.string().nullable().optional(),
      usingEuHosting: z.boolean().optional(),
      tiaCompleted: z.boolean().optional(),
      notes: z.string().max(5000).optional(),
      dataSubjectVolume: z.enum(['<1K', '1K-10K', '10K-100K', '100K+']).optional(),
      certifications: z.array(z.string()).optional(),
      contractRenewalDate: z.string().nullable().optional(),
      dpaClauseCoverage: z.record(z.boolean()).optional(),
      // The safeguard this organisation relies on, which may differ from the
      // shared catalogue's. Constrained to the vocabulary the risk engine and the
      // gap rule actually match on -- a free-text 'SCCs' scored as no safeguard
      // at all, which is the trap the audit's finding 4 describes.
      transferMechanisms: z.array(z.enum(TRANSFER_MECHANISMS)).optional(),
      // D2. The Article 30(1)(d) write path: what data actually goes to this
      // recipient. Feeds the risk engine's special-category factor and, through
      // it, the `missing_dpa_special_category` gap rule (D3).
      dataCategoriesShared: z.array(z.string().min(1).max(120)).max(50).optional(),
      // D32. The relationship record.
      businessOwner: z.string().max(255).nullable().optional(),
      contactEmail: z.string().email().nullable().optional(),
      criticality: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
      processingRole: z.enum(['processor', 'joint_controller', 'independent_controller']).nullable().optional(),
      purpose: z.string().max(2000).nullable().optional(),
      nextReviewAt: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [orgVendor] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, input.vendorId)
      ));
      if (!orgVendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found' });

      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));

      const updates: any = {};
      if (input.dpaStatus !== undefined) {
        updates.dpaStatus = input.dpaStatus;
        // A signed date is part of the same fact as a signed status -- recording
        // one without the other is how dpaSignedAt stayed blank in every audit
        // pack. Default to today when only the status flips.
        if (input.dpaStatus === 'signed') {
          updates.dpaSignedAt = input.dpaSignedAt !== undefined
            ? (input.dpaSignedAt ? new Date(input.dpaSignedAt) : new Date())
            : (orgVendor.dpaSignedAt ?? new Date());
        }
      }
      if (input.dpaExpiresAt !== undefined) updates.dpaExpiresAt = input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null;
      if (input.dpaSignedAt !== undefined && input.dpaStatus !== 'signed') {
        updates.dpaSignedAt = input.dpaSignedAt ? new Date(input.dpaSignedAt) : null;
      }
      if (input.usingEuHosting !== undefined) updates.usingEuHosting = input.usingEuHosting;
      if (input.tiaCompleted !== undefined) updates.tiaCompleted = input.tiaCompleted;
      if (input.notes !== undefined) updates.dpaNotes = input.notes;
      if (input.dataSubjectVolume !== undefined) updates.dataSubjectVolume = input.dataSubjectVolume;
      if (input.certifications !== undefined) updates.certifications = input.certifications;
      // A `date` column takes 'YYYY-MM-DD'; the input already is one. Wrapping it
      // in new Date() bound a timestamp to a date column.
      if (input.contractRenewalDate !== undefined) updates.contractRenewalDate = input.contractRenewalDate || null;
      if (input.dpaClauseCoverage !== undefined) updates.dpaClauseCoverage = input.dpaClauseCoverage;
      if (input.transferMechanisms !== undefined) updates.transferMechanisms = input.transferMechanisms;
      if (input.dataCategoriesShared !== undefined) updates.dataCategoriesShared = input.dataCategoriesShared;
      if (input.businessOwner !== undefined) updates.businessOwner = input.businessOwner;
      if (input.contactEmail !== undefined) updates.contactEmail = input.contactEmail;
      if (input.criticality !== undefined) updates.criticality = input.criticality;
      if (input.processingRole !== undefined) updates.processingRole = input.processingRole;
      if (input.purpose !== undefined) updates.purpose = input.purpose;
      if (input.nextReviewAt !== undefined) {
        updates.nextReviewAt = input.nextReviewAt ? new Date(input.nextReviewAt) : null;
      }

      // Fetch sub-processor count
      const subs = await ctx.db.select()
        .from(vendorSubProcessors)
        .where(eq(vendorSubProcessors.parentVendorId, input.vendorId));
      const subProcessorsCount = subs.length;

      // Recalculate Risk
      // vendor comes from a single-row select and can be absent; scoring against
      // undefined silently produced a risk level for a vendor that is not there.
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found.' });

      const mergedOrgVendor = { ...orgVendor, ...updates };
      const { score, level, factors } = calculateVendorRisk(vendor, mergedOrgVendor, subProcessorsCount);
      updates.riskScore = score;
      updates.riskLevel = level;
      updates.riskFactors = factors;
      updates.lastRiskAssessment = new Date();
      // D31-lite. Any edit to the relationship is itself evidence of review --
      // lastReviewedAt was written by nothing, so the overdue-review gap rule
      // could never fire and "when did anyone look at this" had no answer.
      updates.lastReviewedAt = new Date();

      await ctx.db.update(organizationVendors)
        .set(updates)
        .where(eq(organizationVendors.id, orgVendor.id));

      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user!.orgId,
        entityType: 'vendor',
        entityId: orgVendor.id,
        action: 'upsert'
      });

      return { success: true };
    }),

  // CUSTOM VENDORS
  createCustom: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
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
      await enforceLimit(ctx.db, ctx.user!.orgId, 'vendors', 1);
      const [newVendor] = await ctx.db.insert(vendors).values({
        name: input.name,
        website: input.website,
        headquartersCountry: input.headquartersCountry,
        category: input.category,
        description: input.description,
        euHostingAvailable: input.euHostingAvailable,
        securityCertifications: input.securityCertifications,
        isGlobal: false,
        organizationId: ctx.user!.orgId
      }).returning();

      if (!newVendor) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Calculate initial risk
      const initialOrgVendor = {
        dpaStatus: 'not_started',
        dataSubjectVolume: input.dataSubjectVolume || '<1K',
        certifications: input.certifications || [],
        contractRenewalDate: input.contractRenewalDate || null
      };

      const { score, level, factors } = calculateVendorRisk(newVendor, initialOrgVendor, 0);

      const [newLink] = await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user!.orgId,
        vendorId: newVendor.id,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date(),
        dataSubjectVolume: input.dataSubjectVolume || '<1K',
        certifications: input.certifications || [],
        contractRenewalDate: input.contractRenewalDate || null,
        addedBy: ctx.user!.id,
      }).returning();
      if (!newLink) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });

      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user!.orgId,
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
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({
        parentVendorId: z.string().uuid(),
        subProcessorVendorId: z.string().uuid(),
        purpose: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        // A sub-processor row hangs off the shared catalogue, so an unproved
        // parentVendorId let any member attach fabricated sub-processors to AWS's
        // global row and shift every tenant's derived risk score. Only a custom
        // vendor this organisation owns may be edited.
        const [parent] = await ctx.db.select({ id: vendors.id })
          .from(vendors)
          .where(and(
            eq(vendors.id, input.parentVendorId),
            eq(vendors.organizationId, ctx.user!.orgId)
          ));
        if (!parent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent vendor not found' });

        const [sub] = await ctx.db.insert(vendorSubProcessors).values({
          parentVendorId: input.parentVendorId,
          subProcessorVendorId: input.subProcessorVendorId,
          purpose: input.purpose
        }).returning();

        await recalculateVendorRiskForAllOrgs(ctx.db, input.parentVendorId);
        return sub;
      }),

    addUnlinked: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({
        parentVendorId: z.string().uuid(),
        name: z.string().min(1),
        country: z.string().length(2).optional(),
        purpose: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        // Same proof as addLinked: the row describes the vendor, but the write
        // mutates the shared catalogue unless the parent is org-owned.
        const [parent] = await ctx.db.select({ id: vendors.id })
          .from(vendors)
          .where(and(
            eq(vendors.id, input.parentVendorId),
            eq(vendors.organizationId, ctx.user!.orgId)
          ));
        if (!parent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent vendor not found' });

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

  getRiskStats: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      // Counted in SQL. These tiles are the whole register -- the page used to
      // derive them from the 25 rows it happened to have loaded -- so pulling
      // every column of every row back to call .filter() on it scaled the wrong
      // way for the one caller that most needed it not to.
      const [row] = await ctx.db.select({
        total: sql<number>`count(*)::int`,
        highOrCritical: sql<number>`count(*) filter (where ${inArray(organizationVendors.riskLevel, ['high', 'critical'])})::int`,
        low: sql<number>`count(*) filter (where ${eq(organizationVendors.riskLevel, 'low')})::int`,
        medium: sql<number>`count(*) filter (where ${eq(organizationVendors.riskLevel, 'medium')})::int`,
        dpasSigned: sql<number>`count(*) filter (where ${eq(organizationVendors.dpaStatus, DPA_STATUS_SIGNED)})::int`,
        missingDpas: sql<number>`count(*) filter (where ${inArray(organizationVendors.dpaStatus, [...DPA_STATUS_MISSING])})::int`,
      })
        .from(organizationVendors)
        .where(eq(organizationVendors.organizationId, ctx.user!.orgId));

      return {
        total: row?.total ?? 0,
        highOrCritical: row?.highOrCritical ?? 0,
        low: row?.low ?? 0,
        medium: row?.medium ?? 0,
        dpasSigned: row?.dpasSigned ?? 0,
        missingDpas: row?.missingDpas ?? 0,
      };
    }),

  // Server-side export over the entire register. The client-side version
  // serialised only the loaded pages, so an organisation with 60 vendors handed
  // an auditor a file describing 25.
  exportRegisterCsv: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.select({
        name: vendors.name,
        category: vendors.category,
        headquartersCountry: vendors.headquartersCountry,
        website: vendors.website,
        dpaStatus: organizationVendors.dpaStatus,
        riskLevel: organizationVendors.riskLevel,
        riskScore: organizationVendors.riskScore,
      })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(eq(organizationVendors.organizationId, ctx.user!.orgId))
        .orderBy(desc(organizationVendors.riskScore));

      // csvDocument rather than a local quoting helper: this file and
      // ropaExportFormats.ts had one each, disagreeing about when to quote, and
      // only one of them was covered by the importer's round-trip test.
      const csv = csvDocument([
        ['Vendor', 'Category', 'Country', 'DPA Status', 'Risk Level', 'Risk Score', 'Website'],
        ...rows.map((r) => [
          r.name, r.category, r.headquartersCountry, r.dpaStatus, r.riskLevel, r.riskScore, r.website,
        ]),
      ]);

      return { csv, count: rows.length };
    }),

  getSubProcessorChanges: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ orgVendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ov] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
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

      return list.map((item) => ({
        ...item.change,
        reviewerName: item.reviewerName
      }));
    }),

  reviewSubProcessorChange: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
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
          eq(vendorSubProcessorChanges.organizationId, ctx.user!.orgId)
        ));
      if (!change) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sub-processor change record not found' });

      const [updated] = await ctx.db.update(vendorSubProcessorChanges)
        .set({
          status: input.status,
          notes: input.notes || null,
          reviewedBy: ctx.user!.id,
          reviewedAt: new Date()
        })
        .where(eq(vendorSubProcessorChanges.id, input.changeId))
        .returning();

      return updated;
    }),

  getIncidentsForVendor: protectedProcedure
    .use(requirePermission('vendors', 'view'))
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
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user!.orgId)
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

      return list.map((item) => ({
        ...item.incident,
        alertId: item.alertId,
        alertStatus: item.alertStatus || 'unread',
        acknowledgedAt: item.acknowledgedAt,
        actionNotes: item.actionNotes,
        reviewerName: item.reviewerName
      }));
    }),

  getUnreadIncidentAlertsCount: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const list = await ctx.db.select()
        .from(organizationVendorIncidentAlerts)
        .where(and(
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user!.orgId),
          eq(organizationVendorIncidentAlerts.status, 'unread')
        ));
      return { count: list.length };
    }),

  reviewIncidentAlert: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
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
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user!.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' });

      const [updated] = await ctx.db.update(organizationVendorIncidentAlerts)
        .set({
          status: input.status,
          actionNotes: input.actionNotes || null,
          acknowledgedBy: ctx.user!.id,
          acknowledgedAt: new Date()
        })
        .where(eq(organizationVendorIncidentAlerts.id, input.alertId))
        .returning();

      return updated;
    }),

  // Publishing fans an alert out to every organisation subscribed to this vendor,
  // so this is a platform-operator action sitting on a tenant-facing router. It had
  // no permission check at all. `vendors:manage` is granted by no built-in role --
  // see the note on ROLE_PERMISSION_DEFAULTS -- so this resolves to owner-only via
  // `*:*`. That is the intent, deliberately narrower than `vendors:edit`, until a
  // real platform-admin role exists. Recorded in known-concerns.md.
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
    .use(requirePermission('vendors', 'view'))
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
    .use(requirePermission('vendors', 'edit'))
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
          eq(organizationVendors.organizationId, ctx.user!.orgId)
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
      await updateVendorRiskScore(ctx.db, ctx.user!.orgId, existing.vendorId);

      return updated;
    }),

  saveDpaAnalysisDraft: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      orgVendorId: z.string().uuid(),
      dpaAiAnalysis: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
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
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ orgVendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(and(
          eq(vendorQuestionnaires.orgVendorId, input.orgVendorId),
          eq(vendorQuestionnaires.organizationId, ctx.user!.orgId)
        ))
        .orderBy(desc(vendorQuestionnaires.createdAt));
    }),

  createQuestionnaire: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
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
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ));
      if (!orgVendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const [newQ] = await ctx.db.insert(vendorQuestionnaires)
        .values({
          organizationId: ctx.user!.orgId,
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
    .use(requirePermission('vendors', 'edit'))
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
          eq(vendorQuestionnaires.organizationId, ctx.user!.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      const updates: any = {
        scoreModifier: input.scoreModifier,
        status: 'reviewed',
        updatedAt: new Date()
      };
      if (input.aiScore !== undefined) updates.aiScore = input.aiScore;
      if (input.aiAnalysis !== undefined) updates.aiAnalysis = input.aiAnalysis;

      const [updated] = await ctx.db.update(vendorQuestionnaires)
        .set(updates)
        .where(eq(vendorQuestionnaires.id, input.questionnaireId))
        .returning();

      // Recalculate risk score for this vendor
      await updateVendorRiskScore(ctx.db, ctx.user!.orgId, existing.vendorId);

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
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
      status: z.enum(['undocumented', 'added_to_register', 'dismissed', 'false_positive']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vendorDiscoveries.organizationId, ctx.user!.orgId)];
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
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const [result] = await ctx.db.select({
        count: sql<number>`count(*)::int`
      })
      .from(vendorDiscoveries)
      .where(and(
        eq(vendorDiscoveries.organizationId, ctx.user!.orgId),
        eq(vendorDiscoveries.status, 'undocumented')
      ));
      return result?.count || 0;
    }),

  triggerDiscoveryScan: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      websiteUrl: z.string().url().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
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
          organizationId: ctx.user!.orgId,
          domain,
          websiteUrl
        });
      }

      return { success: true };
    }),

  dismissDiscovery: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(vendorDiscoveries)
        .set({
          status: 'dismissed',
          resolvedBy: ctx.user!.id,
          resolvedAt: new Date()
        })
        .where(and(
          eq(vendorDiscoveries.id, input.id),
          eq(vendorDiscoveries.organizationId, ctx.user!.orgId)
        ))
        .returning();
      return updated;
    }),

  confirmDiscovery: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
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
        eq(vendorDiscoveries.organizationId, ctx.user!.orgId)
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
          organizationId: ctx.user!.orgId
        }).returning();

        if (!newVendor) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create custom vendor' });
        finalVendorId = newVendor.id;
      }

      if (!finalVendorId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Either vendorId or customVendorData is required' });
      }

      // Check if already linked
      const [existingLink] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, finalVendorId)
      ));

      if (!existingLink) {
        const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, finalVendorId));
        if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found.' });

        const { score, level, factors } = calculateVendorRisk(
          vendor,
          { dpaStatus: 'not_started', dataCategoriesShared: [], dataSubjectVolume: '<1K' },
          0
        );

        const [newLink] = await ctx.db.insert(organizationVendors).values({
          organizationId: ctx.user!.orgId,
          vendorId: finalVendorId,
          dpaStatus: 'not_started',
          riskScore: score,
          riskLevel: level,
          riskFactors: factors,
          lastRiskAssessment: new Date(),
          addedBy: ctx.user!.id
        }).returning();
        if (!newLink) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });

        if (orgEmbeddingsQueue) {
          await orgEmbeddingsQueue.add('embed-vendor', {
            orgId: ctx.user!.orgId,
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
          resolvedBy: ctx.user!.id,
          resolvedAt: new Date()
        })
        .where(eq(vendorDiscoveries.id, input.id))
        .returning();

      return updated;
    }),

  verifyVendorProfile: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      vendorId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(vendors)
        .set({
          isAutoDiscovered: false,
          lastVerifiedAt: new Date(),
          verifiedBy: ctx.user!.id
        })
        .where(and(
          eq(vendors.id, input.vendorId),
          eq(vendors.organizationId, ctx.user!.orgId)
        ))
        .returning();

      return updated;
    }),

  // -------------------------------------------------------------------------
  // Sprint 1. The register's lifecycle and its evidence.
  // -------------------------------------------------------------------------

  /**
   * D30. Status lifecycle. `status` existed on the row and was written by
   * nothing; a register that can only grow stops being evidence the moment a
   * contract ends. `offboarded` is terminal-but-recorded rather than deleted --
   * Art. 28(3)(g) asks what happened to the data, which needs the row to stay.
   */
  setStatus: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      orgVendorId: z.string().uuid(),
      status: z.enum(['active', 'paused', 'offboarded']),
      deletionCertificateRef: z.string().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === 'offboarded') {
        updates.offboardedAt = new Date();
        if (input.deletionCertificateRef !== undefined) {
          updates.deletionCertificateRef = input.deletionCertificateRef;
        }
      } else {
        // Coming back from offboarding clears the end-of-processing record --
        // an active relationship cannot simultaneously carry one.
        updates.offboardedAt = null;
        updates.deletionCertificateRef = null;
      }

      const [updated] = await ctx.db.update(organizationVendors)
        .set(updates)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });
      return updated;
    }),

  /**
   * D30. Unlink -- remove the vendor from this organisation's register without
   * touching the shared catalogue row or anyone else's register. Distinct from
   * offboarding in the same way a deletion differs from an archive.
   */
  unlinkVendor: protectedProcedure
    .use(requirePermission('vendors', 'delete'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      await ctx.db.delete(organizationVendors)
        .where(eq(organizationVendors.id, existing.id));

      if (orgEmbeddingsQueue) {
        await orgEmbeddingsQueue.add('embed-vendor', {
          orgId: ctx.user!.orgId,
          entityType: 'vendor',
          entityId: existing.id,
          action: 'delete'
        });
      }

      return { success: true };
    }),

  /**
   * D33. The vendor record's audit trail, read from the same audit_logs table
   * every tRPC mutation already writes through the middleware in trpc.ts.
   *
   * A vendor's events are keyed two ways: rows whose resourceId is the join-row
   * id (`vendors.org.*` mutations), and rows whose metadata carries the global
   * vendor id (`vendors.custom.*`, sub-processor writes). Matching both is what
   * makes the tab complete; matching only one made ROPA's first trail read as
   * though most of the record had no history.
   */
  history: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      vendorId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      // Prove the join row belongs to this organisation before reading its trail.
      const [ov] = await ctx.db.select({ id: organizationVendors.id })
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!ov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const filters: any[] = [
        eq(auditLogs.organizationId, ctx.user!.orgId),
        or(
          // Mutations keyed on the join row itself...
          eq(auditLogs.resourceId, ov.id),
          // ...and ones keyed on the catalogue row (custom vendors, verify).
          eq(auditLogs.resourceId, input.vendorId),
        ),
        // Only this module's actions: 'vendors' covers both key shapes above.
        ilike(auditLogs.action, 'vendors.%'),
      ];

      if (input.cursor) {
        try {
          const { sortValue, id } = decodeCursor(input.cursor);
          const at = new Date(String(sortValue));
          filters.push(or(
            lt(auditLogs.createdAt, at),
            and(eq(auditLogs.createdAt, at), lt(auditLogs.id, id)),
          ));
        } catch {
          // A stale or mangled cursor serves page one rather than a 500.
        }
      }

      const rows = await ctx.db.select().from(auditLogs)
        .where(and(...filters))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(input.limit + 1);

      const page = rows.slice(0, input.limit);
      const last = page[page.length - 1];

      return {
        entries: page.map((row: any) => ({
          ...row,
          renderedChanges: describeChanges(row.changes),
          changeType: changeTypeOf(row.action ?? ''),
        })),
        nextCursor: rows.length > input.limit && last ? encodeCursor(last.createdAt, last.id) : null,
      };
    }),

  /**
   * The trail as a file. One row per changed field, same shape as the ROPA
   * trail export -- a regulator filters on a field name, not on a blob.
   */
  exportHistoryCsv: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [ov] = await ctx.db.select({ id: organizationVendors.id })
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!ov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const rows = await ctx.db.select().from(auditLogs)
        .where(and(
          eq(auditLogs.organizationId, ctx.user!.orgId),
          or(eq(auditLogs.resourceId, ov.id), eq(auditLogs.resourceId, input.vendorId)),
          ilike(auditLogs.action, 'vendors.%'),
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10000);

      const lines = (rows as any[]).flatMap((row): Array<Record<string, string>> => {
        const changes = describeChanges(row.changes);
        const base: Record<string, string> = {
          timestamp: row.createdAt ? new Date(row.createdAt).toISOString() : '',
          user: row.userEmail || 'system',
          action: row.action,
          description: row.description || '',
        };
        if (changes.length === 0) return [{ ...base, field: '', old_value: '', new_value: '' }];
        return changes.map((change) => ({
          ...base,
          field: change.label,
          old_value: change.before,
          new_value: change.after,
        }));
      });

      const headers = ['timestamp', 'user', 'action', 'description', 'field', 'old_value', 'new_value'];
      return {
        csv: csvDocument([headers, ...lines.map((l) => headers.map((h) => l[h] ?? ''))]),
        filename: `vendor-history-${input.vendorId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`,
      };
    }),

  /**
   * D40. Import the spreadsheet. Parses server-side, matches against the
   * catalogue, creates custom vendors for unmatched rows and returns a preview
   * when asked not to commit -- so the modal can show exactly what will happen
   * before anything is written.
   *
   * enforceLimit runs against the *net* additions once catalogue matches are
   * excluded, because re-linking existing vendors must not consume plan headroom.
   */
  importCsv: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      csv: z.string().max(2_000_000),
      hasHeader: z.boolean().default(true),
      commit: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const rows = parseCsvRows(input.csv);
      if (rows.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The file contains no data rows.' });
      }

      // Headerless files are rejected rather than guessed at: without a header
      // row there is no way to know which column is the vendor name, and
      // guessing wrong writes a register full of countries in the name column.
      if (!input.hasHeader) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'The file must include a header row (Name, Website, Category, ...).',
        });
      }

      const [headerRow, ...dataRows] = rows;
      const mapping = buildColumnMapping(headerRow ?? []);
      if (Object.keys(mapping).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No recognised columns. Expected headers such as Name, Website, Category, Country.',
        });
      }

      const catalogueRows = await ctx.db.select({
        id: vendors.id,
        name: vendors.name,
        website: vendors.website,
        aliases: vendors.aliases,
      })
        .from(vendors)
        .where(eq(vendors.isGlobal, true));
      const catalogue: CatalogueEntry[] = catalogueRows;

      const results = dataRows.map((cells, index) => {
        const normalised = normaliseVendorRow(cells, mapping);
        if ('error' in normalised) {
          return { rowNumber: index + (input.hasHeader ? 2 : 1), error: normalised.error };
        }
        const match = matchCatalogue(normalised.matchCandidate, catalogue);

        return {
          rowNumber: index + (input.hasHeader ? 2 : 1),
          ok: true as const,
          name: normalised.name,
          website: normalised.website,
          category: normalised.category,
          headquartersCountry: normalised.headquartersCountry,
          purpose: normalised.purpose,
          dataCategoriesShared: normalised.dataCategoriesShared,
          businessOwner: normalised.businessOwner,
          contactEmail: normalised.contactEmail,
          criticality: normalised.criticality,
          match: match && match.confidence >= AUTO_LINK_THRESHOLD
            ? { vendorId: match.vendorId, confidence: match.confidence, method: match.method }
            : null,
        };
      });

      const valid = results.filter((r): r is Extract<typeof r, { ok: true }> => r.ok === true);
      const errors = results.filter((r) => r.ok !== true);

      if (!input.commit) {
        return {
          committed: false as const,
          total: dataRows.length,
          validCount: valid.length,
          errorCount: errors.length,
          errors,
          rows: valid.map((r) => ({
            ...r,
            action: r.match ? ('link' as const) : ('create_custom' as const),
          })),
        };
      }

      // ---- commit ------------------------------------------------------------
      const existingLinks = await ctx.db.select({ vendorId: organizationVendors.vendorId })
        .from(organizationVendors)
        .where(eq(organizationVendors.organizationId, ctx.user!.orgId));
      const linked = new Set(existingLinks.map((l) => l.vendorId));

      // Plan headroom against the *net* additions: re-linking a catalogue vendor
      // the org already tracks must not consume an enforceLimit unit, and the
      // preview above has already told the user which rows those are.
      const netAdditions = valid.filter((r) => !(r.match?.vendorId && linked.has(r.match.vendorId))).length;
      if (netAdditions > 0) {
        await enforceLimit(ctx.db, ctx.user!.orgId, 'vendors', netAdditions);
      }

      let created = 0;
      let relinked = 0;
      let skippedExisting = 0;
      const commitErrors: Array<{ rowNumber: number; error: string }> = [];

      for (const row of valid) {
        try {
          let targetVendorId = row.match?.vendorId ?? null;

          if (targetVendorId && linked.has(targetVendorId)) {
            skippedExisting++;
            continue;
          }

          if (!targetVendorId) {
            // Create the custom vendor, then link it.
            const [newVendor] = await ctx.db.insert(vendors).values({
              name: row.name,
              website: row.website,
              category: row.category,
              headquartersCountry: row.headquartersCountry,
              description: row.purpose,
              isGlobal: false,
              organizationId: ctx.user!.orgId,
            }).returning();
            if (!newVendor) throw new Error('Insert returned no row.');
            targetVendorId = newVendor.id;
          }

          const [catalogueRow] = await ctx.db.select().from(vendors).where(eq(vendors.id, targetVendorId));
          if (!catalogueRow) throw new Error('Catalogue row disappeared during import.');
          const { score, level, factors } = calculateVendorRisk(
            catalogueRow,
            {
              dpaStatus: 'not_started',
              dataCategoriesShared: row.dataCategoriesShared,
              dataSubjectVolume: '<1K',
            },
            0,
          );

          await ctx.db.insert(organizationVendors).values({
            organizationId: ctx.user!.orgId,
            vendorId: targetVendorId,
            dpaStatus: 'not_started',
            businessOwner: row.businessOwner,
            contactEmail: row.contactEmail,
            criticality: row.criticality,
            processingRole: 'processor',
            purpose: row.purpose,
            dataCategoriesShared: row.dataCategoriesShared,
            riskScore: score,
            riskLevel: level,
            riskFactors: factors,
            lastRiskAssessment: new Date(),
            addedBy: ctx.user!.id,
          });

          if (row.match) relinked++; else created++;
        } catch (err: any) {
          commitErrors.push({ rowNumber: row.rowNumber, error: err.message ?? 'Import failed for this row.' });
        }
      }

      return {
        committed: true as const,
        total: dataRows.length,
        created,
        relinked,
        skippedExisting,
        errorCount: errors.length,
        errors,
        commitErrors,
      };
    }),
});
