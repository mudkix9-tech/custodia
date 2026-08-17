import { paginatedQuery } from '../utils/pagination.js';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, legitimateInterestAssessments, processingDataCategories, processingRecipients, processingTransfers, auditLogs, vendors, organizationVendors, clientProcessingActivities, reconsentFlags, dpias } from 'db';
import { eq, and, desc, inArray, not, count, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { assertOwned, assertParentOwned } from '../lib/tenancy.js';
import DOMPurify from 'isomorphic-dompurify';
import { queueNotification } from '../utils/notifications.js';
import { reconsentQueue } from '../workers/index.js';
import { enforceLimit } from '../lib/billing.js';
import { isAdequateDestination } from '../constants/transferDestinations.js';

const sanitize = (text?: string) => {
  if (!text) return text;
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};

// Helpers
const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Update payloads.
//
// These four mutations took an unconstrained `z.record(z.any())` and spread it into
// `.set()`. Ownership of the *row* was checked; the *contents* were not, so anyone
// holding `ropa:edit` could set `organization_id` and move a record into another
// tenant, or write `created_by`, `deleted_at`, `version`, or a `dpia_id` belonging
// to someone else. The tenancy guard cannot see that class — the filter is correct
// and the payload is the problem.
//
// Unknown keys are *stripped*, not rejected (zod's default). The editor autosaves
// `watch()` wholesale, which includes five form fields that have no column
// (`isLargeScale`, `isAutomatedDecisionMaking`, `retentionSchedule`, `securityNotes`,
// `lawfulBasisNotes`); Drizzle already discarded those silently, so stripping keeps
// the tab working while closing the hole. `.strict()` here would 400 every save.
//
// `lawfulBasis` and `retentionPeriod` are bounded strings rather than enums on
// purpose: the onboarding templates seed values the editor's own selects cannot
// represent ('legitimate_interests', prose retention periods), and those rows are
// autosaved back verbatim. Tightening them belongs with the fix to the templates,
// not here, where it would break editing every seeded activity.
// ---------------------------------------------------------------------------

const activityUpdateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  purpose: z.string().min(1),
  role: z.enum(['controller', 'processor', 'joint_controller']),
  controllerName: z.string().max(255).nullable(),
  lawfulBasis: z.string().max(50),
  lawfulBasisDetail: z.string().nullable(),
  isSystematicMonitoring: z.boolean(),
  retentionPeriod: z.string().max(100).nullable(),
  retentionJustification: z.string().nullable(),
  retentionReviewDate: z.coerce.date().nullable(),
  deletionProcedure: z.string().nullable(),
  securityMeasures: z.array(z.string()),
  securityMeasuresDetail: z.string().nullable(),
  status: z.enum(['draft', 'active', 'under_review', 'archived']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  // Ownership is proved in the mutation — a uuid alone does not say whose DPIA it is.
  dpiaId: z.string().uuid().nullable(),
}).partial();

const dataCategoryUpdateSchema = z.object({
  category: z.string().min(1).max(100),
  categoryGroup: z.string().min(1).max(100),
  description: z.string().nullable(),
  source: z.string().max(100).nullable(),
  sourceDetail: z.string().nullable(),
  isSpecialCategory: z.boolean(),
}).partial();

const recipientUpdateSchema = z.object({
  recipientType: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  vendorId: z.string().uuid().nullable(),
  purpose: z.string().nullable(),
}).partial();

// tiaCompleted and tiaRiskLevel are deliberately absent: they are Chapter V evidence
// derived from a completed TIA, and nothing a register editor may assert directly.
const transferUpdateSchema = z.object({
  destinationCountry: z.string().length(2),
  destinationEntity: z.string().max(255).nullable(),
  vendorId: z.string().uuid().nullable(),
  transferMechanism: z.string().min(1).max(100),
  mechanismDetail: z.string().nullable(),
  tiaRequired: z.boolean(),
  supplementaryMeasures: z.array(z.string()),
}).partial();

export const ropaRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      return paginatedQuery(
        processingActivities,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'updatedAt',
        'desc',
        // auditExport and scoring already filter on this. The register did not, so a
        // deleted activity stayed on screen, in the CSV and in the PDF while the audit
        // pack and the compliance score behaved as though it were gone.
        [isNull(processingActivities.deletedAt)],
      );
    }),

  // The dashboard tile wants an org-wide total. list is cursor-paginated, so
  // counting its rows would silently cap at the page size.
  countActive: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      const [row] = await ctx.db.select({ value: count() })
        .from(processingActivities)
        .where(and(
          eq(processingActivities.organizationId, ctx.user!.orgId),
          eq(processingActivities.status, 'active'),
        ));
      return row?.value ?? 0;
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await ctx.db.query.processingActivities.findFirst({
        where: and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        ),
        with: {
          clients: {
            with: { client: true }
          }
        }
      });

      if (!activity) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return activity;
    }),

  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      name: z.string().min(1),
      purpose: z.string().min(1),
      description: z.string().optional(),
      // The CSV importer refuses to guess a basis and cites Art. 30(1)(c) when it
      // rejects a row. The primary create path accepted '' and satisfied a NOT NULL
      // column with it, so the register rendered 'Unspecified' for anything made in
      // the UI. The form now collects it.
      lawfulBasis: z.string().min(1),
      // Art. 30(1) vs 30(2): the two records answer different questions.
      role: z.enum(['controller', 'processor', 'joint_controller']).default('controller'),
      controllerName: z.string().optional(),
      // Rendered on the create form and silently dropped: a user who chose
      // Active/Critical got Draft/Low back.
      status: z.enum(['draft', 'active', 'under_review', 'archived']).default('draft'),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
      isSystematicMonitoring: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await enforceLimit(ctx.db, ctx.user!.orgId, 'ropa', 1);
      
      const [newActivity] = await ctx.db.insert(processingActivities).values({
        organizationId: ctx.user!.orgId,
        name: sanitize(input.name)!,
        purpose: sanitize(input.purpose)!,
        description: sanitize(input.description),
        lawfulBasis: input.lawfulBasis,
        role: input.role,
        controllerName: sanitize(input.controllerName),
        status: input.status,
        riskLevel: input.riskLevel,
        isSystematicMonitoring: input.isSystematicMonitoring,
        createdBy: ctx.user!.id,
      }).returning();

      if (!newActivity) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: newActivity.id,
        action: 'upsert'
      });

      return newActivity;
    }),

  bulkCreate: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.array(z.object({
      name: z.string().min(1),
      purpose: z.string().min(1),
      description: z.string().optional(),
      lawfulBasis: z.string(),
      status: z.string().default('draft'),
      riskLevel: z.string().default('low'),
      role: z.enum(['controller', 'processor', 'joint_controller']).default('controller'),
      controllerName: z.string().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      if (input.length === 0) return [];
      await enforceLimit(ctx.db, ctx.user!.orgId, 'ropa', input.length);

      const values = input.map((item: any) => ({
        ...item,
        name: sanitize(item.name)!,
        purpose: sanitize(item.purpose)!,
        description: sanitize(item.description),
        controllerName: sanitize(item.controllerName),
        organizationId: ctx.user!.orgId,
        createdBy: ctx.user!.id,
      }));

      const newActivities = await ctx.db.insert(processingActivities).values(values).returning();

      for (const act of newActivities) {
        await orgEmbeddingsQueue.add('embed-ropa', {
          orgId: ctx.user!.orgId,
          entityType: 'processing_activity',
          entityId: act.id,
          action: 'upsert'
        });
      }

      return newActivities;
    }),

  update: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      updatedAt: z.string().datetime().optional(), // for optimistic locking
      data: activityUpdateSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const activity = await ctx.db.query.processingActivities.findFirst({
        where: and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        )
      });

      if (!activity) throw new TRPCError({ code: 'NOT_FOUND' });
      
      // Optimistic Locking check
      if (input.updatedAt && new Date(input.updatedAt).getTime() !== activity.updatedAt?.getTime()) {
        throw new TRPCError({ 
          code: 'CONFLICT', 
          message: 'The record was updated by someone else. Please reload.' 
        });
      }

      // A client-supplied foreign key is exactly the case the first tenancy audit missed:
      // the row being edited is ours, the DPIA it points at need not be.
      if (input.data.dpiaId) {
        await assertParentOwned(ctx.db, dpias, input.data.dpiaId, ctx.user!.orgId, 'DPIA');
      }

      const sanitizedData = { ...input.data };
      if (sanitizedData.name) sanitizedData.name = sanitize(sanitizedData.name);
      if (sanitizedData.purpose) sanitizedData.purpose = sanitize(sanitizedData.purpose);
      if (sanitizedData.description) sanitizedData.description = sanitize(sanitizedData.description);

      const [updated] = await ctx.db.update(processingActivities)
        .set({ ...sanitizedData, updatedAt: new Date() })
        .where(eq(processingActivities.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: updated.id,
        action: 'upsert'
      });

      if (activity.lawfulBasis === 'consent' && activity.purpose !== updated.purpose) {
        // Fetch context for Claude
        const dataCats = await ctx.db.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, activity.id));
        const recipients = await ctx.db.select({ vendorName: vendors.name, purpose: processingRecipients.purpose })
          .from(processingRecipients)
          .leftJoin(vendors, eq(processingRecipients.vendorId, vendors.id))
          .where(eq(processingRecipients.processingActivityId, activity.id));

        // Use a Redis-based debounce trick: setting the jobId to include a time-block (e.g. per 5-minute window) 
        // to prevent rapid back-to-back checks for the same activity in a single edit session.
        const timeBlock = Math.floor(Date.now() / (5 * 60 * 1000)); 
        await reconsentQueue.add('evaluate-material-change', {
          activityId: updated.id,
          organizationId: ctx.user!.orgId,
          oldPurpose: activity.purpose,
          newPurpose: updated.purpose,
          lawfulBasis: activity.lawfulBasis,
          dataCategories: dataCats.map((d: any) => d.category),
          vendorList: recipients.map((r: any) => ({ name: r.vendorName || 'Unknown', purpose: r.purpose }))
        }, {
          jobId: `reconsent-${updated.id}-${timeBlock}`,
          delay: 5000 // wait 5 seconds before processing, allows final edit to settle
        });
      }

      return updated;
    }),

  delete: protectedProcedure
    .use(requirePermission('ropa', 'delete'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [deleted] = await ctx.db.update(processingActivities)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        ))
        .returning();

      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND' });

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: deleted.id,
        action: 'delete'
      });

      return deleted;
    }),

  // Advanced features and nested routers to be expanded...
  history: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ activityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        
        // We can just use standard filtering on resourceId
        const logs = await ctx.db.select().from(auditLogs)
          .where(and(
            eq(auditLogs.organizationId, ctx.user!.orgId),
            eq(auditLogs.resourceId, input.activityId)
          ))
          .orderBy(desc(auditLogs.createdAt));
          
        return logs;
      }),
  }),

  dataCategories: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        return ctx.db.select().from(processingDataCategories)
          .where(eq(processingDataCategories.processingActivityId, input.processingActivityId));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        category: z.string().max(100),
        categoryGroup: z.string().max(100),
        isSpecialCategory: z.boolean().default(false),
        source: z.string().max(100).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        const [inserted] = await ctx.db.insert(processingDataCategories).values(input).returning();

        if (inserted?.isSpecialCategory) {
          const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, input.processingActivityId));

          await ctx.db.update(processingActivities)
            .set({
              requiresDpia: true,
              involvesSpecialCategories: true,
              riskLevel: 'high', // escalate if currently low/medium
            })
            .where(eq(processingActivities.id, input.processingActivityId));

          if (ctx.user?.orgId && activity) {
            // Queue notification
            await queueNotification({
              organizationId: ctx.user.orgId,
              type: 'compliance.gap_detected' as any,
              title: 'DPIA required',
              body: `Adding special category data to "${activity.name}" requires a Data Protection Impact Assessment.`,
              actionUrl: `/ropa/${input.processingActivityId}?tab=dpia`,
            });
          }
        }
        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: dataCategoryUpdateSchema
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: processingDataCategories,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Data category',
          via: [{ table: processingActivities, on: eq(processingDataCategories.processingActivityId, processingActivities.id) }],
        });

        const [updated] = await ctx.db.update(processingDataCategories)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingDataCategories.id, input.id))
          .returning();

        if (updated?.isSpecialCategory && !existing.isSpecialCategory) {
          const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, updated.processingActivityId));
          await ctx.db.update(processingActivities)
            .set({
              requiresDpia: true,
              involvesSpecialCategories: true,
              riskLevel: 'high',
            })
            .where(eq(processingActivities.id, updated.processingActivityId));

          if (ctx.user?.orgId && activity) {
            // Queue notification
            await queueNotification({
              organizationId: ctx.user.orgId,
              type: 'compliance.gap_detected' as any,
              title: 'DPIA required',
              body: `Adding special category data to "${activity.name}" requires a Data Protection Impact Assessment.`,
              actionUrl: `/ropa/${updated.processingActivityId}?tab=dpia`,
            });
          }
        } else if (!updated?.isSpecialCategory && existing.isSpecialCategory && updated) {
          // Check if there are any other special categories remaining
          const remainingSpecial = await ctx.db.select().from(processingDataCategories)
            .where(and(
              eq(processingDataCategories.processingActivityId, updated.processingActivityId),
              eq(processingDataCategories.isSpecialCategory, true),
              not(eq(processingDataCategories.id, input.id))
            ));

          if (remainingSpecial.length === 0) {
            await ctx.db.update(processingActivities)
              .set({
                requiresDpia: false,
                involvesSpecialCategories: false,
                riskLevel: 'medium', // Reset to default/medium
              })
              .where(eq(processingActivities.id, updated.processingActivityId));
          }
        }

        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: processingDataCategories,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Data category',
          via: [{ table: processingActivities, on: eq(processingDataCategories.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingDataCategories)
          .where(eq(processingDataCategories.id, input.id))
          .returning();

        if (existing.isSpecialCategory) {
          const remainingSpecial = await ctx.db.select().from(processingDataCategories)
            .where(and(
              eq(processingDataCategories.processingActivityId, existing.processingActivityId),
              eq(processingDataCategories.isSpecialCategory, true),
              not(eq(processingDataCategories.id, input.id)) // Exclude the deleted one
            ));

          if (remainingSpecial.length === 0) {
            await ctx.db.update(processingActivities)
              .set({
                requiresDpia: false,
                involvesSpecialCategories: false,
                riskLevel: 'medium',
              })
              .where(eq(processingActivities.id, existing.processingActivityId));
          }
        }

        return deleted;
      })
  }),

  recipients: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // processing_recipients carries no organization_id, so the activity is
        // what has to be proved — otherwise this reads any tenant's recipients.
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const records = await ctx.db.select({
          recipient: processingRecipients,
          vendor: {
            id: vendors.id,
            name: vendors.name,
            headquartersCountry: vendors.headquartersCountry,
            category: vendors.category,
          },
          orgVendor: {
            dpaStatus: organizationVendors.dpaStatus,
            usingEuHosting: organizationVendors.usingEuHosting,
            riskScore: organizationVendors.riskScore,
            riskLevel: organizationVendors.riskLevel,
            dpaClauseCoverage: organizationVendors.dpaClauseCoverage,
          }
        })
        .from(processingRecipients)
        .leftJoin(vendors, eq(processingRecipients.vendorId, vendors.id))
        .leftJoin(organizationVendors, and(
          eq(vendors.id, organizationVendors.vendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ))
        .where(eq(processingRecipients.processingActivityId, input.processingActivityId));
        
        return records.map((r: any) => ({
          ...r.recipient,
          vendorData: r.vendor ? { ...r.vendor, ...r.orgVendor } : null
        }));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        recipientType: z.string().default('vendor'),
        name: z.string(),
        purpose: z.string().optional(),
        vendorId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Unchecked, this wrote a recipient — and below, a transfer record and a
        // re-consent flag — into another tenant's processing activity.
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const [inserted] = await ctx.db.insert(processingRecipients).values({
          ...input,
        }).returning();

        // Auto-create transfer if vendor is outside EU and no EU hosting
        if (input.vendorId) {
          const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
          const [orgVendor] = await ctx.db.select().from(organizationVendors).where(and(eq(organizationVendors.vendorId, input.vendorId), eq(organizationVendors.organizationId, ctx.user!.orgId)));
          
          // The EU-27 array this used to hardcode treated Norway, Iceland,
          // Liechtenstein, the UK, Switzerland, Japan, Korea, Canada and the rest of
          // the adequacy list as third countries, and fabricated a Chapter V transfer
          // requiring SCCs for each. isAdequateDestination covers the EEA plus every
          // adequacy decision, and onboarding.ts was already using it.
          const hq = vendor?.headquartersCountry;
          const isAdequateHq = !!hq && isAdequateDestination(hq);
          const hasEuHosting = orgVendor?.usingEuHosting;

          if (!isAdequateHq && !hasEuHosting && hq) {
            // It's a non-EU transfer, create draft transfer
            const [existingTransfer] = await ctx.db.select().from(processingTransfers).where(and(
              eq(processingTransfers.processingActivityId, input.processingActivityId),
              eq(processingTransfers.vendorId, input.vendorId)
            ));

            if (!existingTransfer) {
              await ctx.db.insert(processingTransfers).values({
                processingActivityId: input.processingActivityId,
                destinationCountry: hq.substring(0, 2),
                destinationEntity: vendor.name,
                vendorId: input.vendorId,
                transferMechanism: 'pending_assessment',
              });
            }
          }
        }

        // Check if activity is consent-based to flag for re-consent on vendor addition
        const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, input.processingActivityId));
        if (activity && activity.lawfulBasis === 'consent') {
          await ctx.db.insert(reconsentFlags).values({
            organizationId: ctx.user!.orgId,
            processingActivityId: input.processingActivityId,
            reason: `Vendor '${input.name}' was added to this consent-based processing activity.`,
            confidence: 'high',
            status: 'flagged'
          });
        }

        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: recipientUpdateSchema
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingRecipients,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Recipient',
          via: [{ table: processingActivities, on: eq(processingRecipients.processingActivityId, processingActivities.id) }],
        });

        const [updated] = await ctx.db.update(processingRecipients)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingRecipients.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingRecipients,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Recipient',
          via: [{ table: processingActivities, on: eq(processingRecipients.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingRecipients)
          .where(eq(processingRecipients.id, input.id))
          .returning();

        if (deleted) {
          const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, deleted.processingActivityId));
          if (activity && activity.lawfulBasis === 'consent') {
            await ctx.db.insert(reconsentFlags).values({
              organizationId: ctx.user!.orgId,
              processingActivityId: deleted.processingActivityId,
              reason: `A vendor was removed from this consent-based processing activity.`,
              confidence: 'high',
              status: 'flagged'
            });
          }
        }

        return deleted;
      })
  }),

  transfers: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        return ctx.db.select().from(processingTransfers)
          .where(eq(processingTransfers.processingActivityId, input.processingActivityId));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        // char(2). Unbounded, this surfaced as a Postgres 22001 from deep inside the
        // insert rather than as a validation error naming the field.
        destinationCountry: z.string().length(2),
        transferMechanism: z.string().max(100),
        mechanismDetail: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        const [inserted] = await ctx.db.insert(processingTransfers).values({
          ...input,
        }).returning();
        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: transferUpdateSchema
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingTransfers,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Transfer',
          via: [{ table: processingActivities, on: eq(processingTransfers.processingActivityId, processingActivities.id) }],
        });

        const [updated] = await ctx.db.update(processingTransfers)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingTransfers.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingTransfers,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Transfer',
          via: [{ table: processingActivities, on: eq(processingTransfers.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingTransfers)
          .where(eq(processingTransfers.id, input.id))
          .returning();
        return deleted;
      })
  }),
});
