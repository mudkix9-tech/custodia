import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, legitimateInterestAssessments, processingDataCategories, processingRecipients, processingTransfers, auditLogs, vendors, organizationVendors, clientProcessingActivities } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import DOMPurify from 'isomorphic-dompurify';

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

export const ropaRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return db.select()
        .from(processingActivities)
        .where(eq(processingActivities.organizationId, ctx.user!.orgId))
        .orderBy(desc(processingActivities.updatedAt));
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await db.query.processingActivities.findFirst({
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
      lawfulBasis: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [newActivity] = await db.insert(processingActivities).values({
        organizationId: ctx.user!.orgId,
        name: sanitize(input.name)!,
        purpose: sanitize(input.purpose)!,
        description: sanitize(input.description),
        lawfulBasis: input.lawfulBasis,
        createdBy: ctx.user!.id,
      }).returning();

      if (!newActivity) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });


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
    })))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      if (input.length === 0) return [];

      const values = input.map(item => ({
        ...item,
        name: sanitize(item.name)!,
        purpose: sanitize(item.purpose)!,
        description: sanitize(item.description),
        organizationId: ctx.user!.orgId,
        createdBy: ctx.user!.id,
      }));

      const newActivities = await db.insert(processingActivities).values(values).returning();



      return newActivities;
    }),

  update: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      updatedAt: z.string().datetime().optional(), // for optimistic locking
      data: z.record(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const activity = await db.query.processingActivities.findFirst({
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

      const sanitizedData = { ...input.data };
      if (sanitizedData.name) sanitizedData.name = sanitize(sanitizedData.name);
      if (sanitizedData.purpose) sanitizedData.purpose = sanitize(sanitizedData.purpose);
      if (sanitizedData.description) sanitizedData.description = sanitize(sanitizedData.description);

      const [updated] = await db.update(processingActivities)
        .set({ ...sanitizedData, updatedAt: new Date() })
        .where(eq(processingActivities.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });



      return updated;
    }),

  delete: protectedProcedure
    .use(requirePermission('ropa', 'delete'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [deleted] = await db.update(processingActivities)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        ))
        .returning();

      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND' });

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
        const logs = await db.select().from(auditLogs)
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
      .query(async ({ input }) => {
        return db.select().from(processingDataCategories)
          .where(eq(processingDataCategories.processingActivityId, input.processingActivityId));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        category: z.string(),
        categoryGroup: z.string(),
        isSpecialCategory: z.boolean().default(false),
        source: z.string().optional(),
        retentionPeriod: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const [inserted] = await db.insert(processingDataCategories).values(input).returning();
        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.record(z.any())
      }))
      .mutation(async ({ input }) => {
        const [updated] = await db.update(processingDataCategories)
          .set(input.data)
          .where(eq(processingDataCategories.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const [deleted] = await db.delete(processingDataCategories)
          .where(eq(processingDataCategories.id, input.id))
          .returning();
        return deleted;
      })
  }),

  recipients: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const records = await db.select({
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
            riskLevel: organizationVendors.riskLevel,
          }
        })
        .from(processingRecipients)
        .leftJoin(vendors, eq(processingRecipients.vendorId, vendors.id))
        .leftJoin(organizationVendors, and(
          eq(vendors.id, organizationVendors.vendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ))
        .where(eq(processingRecipients.processingActivityId, input.processingActivityId));
        
        return records.map(r => ({
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
        const [inserted] = await db.insert(processingRecipients).values({
          ...input,
        }).returning();

        // Auto-create transfer if vendor is outside EU and no EU hosting
        if (input.vendorId) {
          const [vendor] = await db.select().from(vendors).where(eq(vendors.id, input.vendorId));
          const [orgVendor] = await db.select().from(organizationVendors).where(and(eq(organizationVendors.vendorId, input.vendorId), eq(organizationVendors.organizationId, ctx.user!.orgId)));
          
          const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
          const hq = vendor?.headquartersCountry;
          const isEuHq = hq && EU_COUNTRIES.includes(hq);
          const hasEuHosting = orgVendor?.usingEuHosting;

          if (!isEuHq && !hasEuHosting && hq) {
            // It's a non-EU transfer, create draft transfer
            const [existingTransfer] = await db.select().from(processingTransfers).where(and(
              eq(processingTransfers.processingActivityId, input.processingActivityId),
              eq(processingTransfers.vendorId, input.vendorId)
            ));

            if (!existingTransfer) {
              await db.insert(processingTransfers).values({
                processingActivityId: input.processingActivityId,
                destinationCountry: hq.substring(0, 2),
                destinationEntity: vendor.name,
                vendorId: input.vendorId,
                transferMechanism: 'pending_assessment',
              });
            }
          }
        }

        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.record(z.any())
      }))
      .mutation(async ({ input }) => {
        const [updated] = await db.update(processingRecipients)
          .set(input.data)
          .where(eq(processingRecipients.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const [deleted] = await db.delete(processingRecipients)
          .where(eq(processingRecipients.id, input.id))
          .returning();
        return deleted;
      })
  }),

  transfers: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.select().from(processingTransfers)
          .where(eq(processingTransfers.processingActivityId, input.processingActivityId));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        destinationCountry: z.string(),
        transferMechanism: z.string(),
        safeguards: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const [inserted] = await db.insert(processingTransfers).values({
          ...input,
        }).returning();
        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.record(z.any())
      }))
      .mutation(async ({ input }) => {
        const [updated] = await db.update(processingTransfers)
          .set(input.data)
          .where(eq(processingTransfers.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const [deleted] = await db.delete(processingTransfers)
          .where(eq(processingTransfers.id, input.id))
          .returning();
        return deleted;
      })
  }),
});
