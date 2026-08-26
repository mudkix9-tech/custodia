/**
 * Vendor Intake Router — Sprint 3 delegated vendor request & review workflow.
 *
 * All endpoints are strictly scoped to `orgId = ctx.user!.orgId`.
 * Every client-supplied id is proved via assertOwned or direct eq(organizationId).
 */
import { router, protectedProcedure } from '../trpc.js';
import { requirePermission } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
import {
  vendorIntakeRequests,
  organizationVendors,
  vendors,
} from 'db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { calculateNextReviewDate } from '../lib/vendorGovernance.js';
import { normaliseDataCategoryList } from '../constants/vendorDataCategories.js';
import { assertOwned } from '../lib/tenancy.js';

export const vendorIntakeRouter = router({
  /** List intake requests for the current organisation. */
  list: protectedProcedure
    .use(requirePermission('vendors', 'read'))
    .input(
      z.object({
        status: z.enum(['pending_review', 'approved', 'rejected', 'more_info_requested']).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const conditions = [eq(vendorIntakeRequests.organizationId, orgId)];
      if (input?.status) {
        conditions.push(eq(vendorIntakeRequests.status, input.status));
      }

      return await db
        .select()
        .from(vendorIntakeRequests)
        .where(and(...conditions))
        .orderBy(desc(vendorIntakeRequests.createdAt));
    }),

  /** Get single intake request by ID. */
  getById: protectedProcedure
    .use(requirePermission('vendors', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const [req] = await db
        .select()
        .from(vendorIntakeRequests)
        .where(
          and(
            eq(vendorIntakeRequests.id, input.id),
            eq(vendorIntakeRequests.organizationId, orgId)
          )
        );

      if (!req) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor intake request not found',
        });
      }

      return req;
    }),

  /** Submit a new vendor request (employee or manager). */
  submit: protectedProcedure
    .use(requirePermission('vendors', 'create'))
    .input(
      z.object({
        vendorName: z.string().min(1).max(255),
        vendorWebsite: z.string().max(500).optional().nullable(),
        category: z.string().max(100).optional().nullable(),
        businessOwner: z.string().max(255).optional().nullable(),
        purpose: z.string().max(2000).optional().nullable(),
        dataCategories: z.array(z.string()).default([]),
        estimatedDataSubjects: z.string().max(50).optional().nullable(),
        criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        requesterName: z.string().max(255).optional().nullable(),
        requesterEmail: z.string().email().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const normalisedCategories = normaliseDataCategoryList(input.dataCategories);

      const [created] = await db
        .insert(vendorIntakeRequests)
        .values({
          organizationId: orgId,
          requestedBy: ctx.user!.id,
          requesterName: input.requesterName || null,
          requesterEmail: input.requesterEmail || null,
          vendorName: input.vendorName.trim(),
          vendorWebsite: input.vendorWebsite?.trim() || null,
          category: input.category?.trim() || null,
          businessOwner: input.businessOwner?.trim() || null,
          purpose: input.purpose?.trim() || null,
          dataCategories: normalisedCategories,
          estimatedDataSubjects: input.estimatedDataSubjects || null,
          criticality: input.criticality,
          status: 'pending_review',
        })
        .returning();

      return created;
    }),

  /** Approve an intake request: creates or links to the register. */
  approve: protectedProcedure
    .use(requirePermission('vendors', 'write'))
    .input(
      z.object({
        id: z.string().uuid(),
        reviewNotes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;

      // 1. Ownership proof
      const intake = await assertOwned(db, {
        table: vendorIntakeRequests,
        id: input.id,
        orgId,
        label: 'Vendor intake request',
      });

      if (intake.status === 'approved') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vendor intake request has already been approved',
        });
      }

      // 2. Find or create catalogue vendor
      let catalogueVendorId: string | null = null;

      if (intake.vendorWebsite) {
        let domain = intake.vendorWebsite.replace(/^https?:\/\//i, '').split('/')[0]!.replace(/^www\./i, '');
        const [existingByDomain] = await db
          .select()
          .from(vendors)
          .where(sql`LOWER(${vendors.website}) LIKE ${`%${domain}%`}`);
        if (existingByDomain) {
          catalogueVendorId = existingByDomain.id;
        }
      }

      if (!catalogueVendorId) {
        const [existingByName] = await db
          .select()
          .from(vendors)
          .where(sql`LOWER(${vendors.name}) = LOWER(${intake.vendorName})`);
        if (existingByName) {
          catalogueVendorId = existingByName.id;
        }
      }

      if (!catalogueVendorId) {
        const [newVendor] = await db
          .insert(vendors)
          .values({
            name: intake.vendorName,
            website: intake.vendorWebsite || null,
            category: intake.category || 'Software / SaaS',
          })
          .returning();
        catalogueVendorId = newVendor!.id;
      }

      // 3. Link vendor to organisation register if not already linked
      const [existingLink] = await db
        .select()
        .from(organizationVendors)
        .where(
          and(
            eq(organizationVendors.organizationId, orgId),
            eq(organizationVendors.vendorId, catalogueVendorId)
          )
        );

      let orgVendorId: string;
      const initialNextReviewAt = calculateNextReviewDate(new Date(), intake.criticality);

      if (existingLink) {
        orgVendorId = existingLink.id;
        await db
          .update(organizationVendors)
          .set({
            businessOwner: intake.businessOwner || existingLink.businessOwner,
            purpose: intake.purpose || existingLink.purpose,
            criticality: intake.criticality || existingLink.criticality,
            dataCategoriesShared: intake.dataCategories || existingLink.dataCategoriesShared,
            reviewCadence: intake.criticality === 'critical' ? 'quarterly' : intake.criticality === 'high' ? 'biannual' : 'annual',
            nextReviewAt: existingLink.nextReviewAt || initialNextReviewAt,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(organizationVendors.id, existingLink.id),
              eq(organizationVendors.organizationId, orgId)
            )
          );
      } else {
        const [newLink] = await db
          .insert(organizationVendors)
          .values({
            organizationId: orgId,
            vendorId: catalogueVendorId,
            businessOwner: intake.businessOwner || null,
            purpose: intake.purpose || null,
            criticality: intake.criticality || 'medium',
            dataCategoriesShared: intake.dataCategories || [],
            reviewCadence: intake.criticality === 'critical' ? 'quarterly' : intake.criticality === 'high' ? 'biannual' : 'annual',
            nextReviewAt: initialNextReviewAt,
            dpaStatus: 'not_started',
            status: 'active',
          })
          .returning();
        orgVendorId = newLink!.id;
      }

      // 4. Update intake request status
      const [updated] = await db
        .update(vendorIntakeRequests)
        .set({
          status: 'approved',
          createdVendorId: catalogueVendorId,
          createdOrgVendorId: orgVendorId,
          reviewNotes: input.reviewNotes || null,
          reviewedBy: ctx.user!.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorIntakeRequests.id, input.id),
            eq(vendorIntakeRequests.organizationId, orgId)
          )
        )
        .returning();

      return {
        intake: updated,
        orgVendorId,
        vendorId: catalogueVendorId,
      };
    }),

  /** Reject an intake request. */
  reject: protectedProcedure
    .use(requirePermission('vendors', 'write'))
    .input(
      z.object({
        id: z.string().uuid(),
        rejectionReason: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      await assertOwned(db, {
        table: vendorIntakeRequests,
        id: input.id,
        orgId,
        label: 'Vendor intake request',
      });

      const [updated] = await db
        .update(vendorIntakeRequests)
        .set({
          status: 'rejected',
          reviewNotes: input.rejectionReason,
          reviewedBy: ctx.user!.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorIntakeRequests.id, input.id),
            eq(vendorIntakeRequests.organizationId, orgId)
          )
        )
        .returning();

      return updated;
    }),

  /** Request additional information on an intake request. */
  requestMoreInfo: protectedProcedure
    .use(requirePermission('vendors', 'write'))
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      await assertOwned(db, {
        table: vendorIntakeRequests,
        id: input.id,
        orgId,
        label: 'Vendor intake request',
      });

      const [updated] = await db
        .update(vendorIntakeRequests)
        .set({
          status: 'more_info_requested',
          reviewNotes: input.notes,
          reviewedBy: ctx.user!.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorIntakeRequests.id, input.id),
            eq(vendorIntakeRequests.organizationId, orgId)
          )
        )
        .returning();

      return updated;
    }),
});
