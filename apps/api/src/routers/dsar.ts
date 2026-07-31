import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { router, publicProcedure, protectedProcedure, requirePermission, verifyGroupScopeAndLog } from '../trpc.js';
import { db } from '../db.js';
import { 
  organizations, 
  dsarRequests, 
  dsarTasks, 
  dsarCommunications, 
  processingActivities, 
  auditLogs,
  users,
  notificationQueue
} from 'db';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';

// Helpers
const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

// Sub-routers
const verificationRouter = router({
  confirm: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const decoded = jwt.verify(input.token, JWT_SECRET) as { dsarId: string, email: string };
        const [dsar] = await ctx.db.select().from(dsarRequests).where(eq(dsarRequests.id, decoded.dsarId));
        
        if (!dsar) throw new TRPCError({ code: 'NOT_FOUND', message: 'DSAR not found' });
        if (dsar.subjectEmail !== decoded.email) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        if (dsar.subjectVerified) {
          return { alreadyVerified: true };
        }

        await ctx.db.update(dsarRequests)
          .set({ 
            subjectVerified: true, 
            verificationMethod: 'email_confirmation',
            verificationDate: new Date(),
            status: 'in_progress' 
          })
          .where(eq(dsarRequests.id, dsar.id));

        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired token' });
      }
    }),
  manual: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ id: z.string().uuid(), method: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(dsarRequests)
        .set({ subjectVerified: true, verificationMethod: input.method, verificationDate: new Date(), status: 'in_progress' })
        .where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),
});

const tasksRouter = router({
  generateFromRopa: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ dsarId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [dsar] = await ctx.db.select().from(dsarRequests).where(and(
        eq(dsarRequests.id, input.dsarId),
        eq(dsarRequests.organizationId, ctx.user!.orgId)
      ));
      
      if (!dsar) throw new TRPCError({ code: 'NOT_FOUND' });

      // 1. Get all active processing activities for this org
      const activities = await ctx.db.query.processingActivities.findMany({
        where: and(
          eq(processingActivities.organizationId, ctx.user!.orgId),
          eq(processingActivities.status, 'active'),
          isNull(processingActivities.deletedAt)
        ),
        with: {
          recipients: { with: { vendor: true } },
          dataCategories: true,
        },
      });

      const tasks: any[] = [];
      const vendorTasksMap = new Map<string, any>();

      for (const activity of activities) {
        const isSpecialCategory = activity.dataCategories.some((dc: any) => dc.isSpecialCategory);
        
        // 2. For each vendor, create a search task
        for (const recipient of activity.recipients) {
          if (!recipient.vendorId) continue;

          if (vendorTasksMap.has(recipient.vendorId)) {
            const existing = vendorTasksMap.get(recipient.vendorId);
            existing.relatedActivities.push(activity.name);
            if (isSpecialCategory) existing.priority = 'high';
          } else {
            const vendor = recipient.vendor;
            const t = {
              dsarId: input.dsarId,
              systemName: vendor?.name || recipient.name,
              vendorId: recipient.vendorId,
              searchInstructions: vendor?.dsarSearchInstructions || `Search ${recipient.name} for records matching: ${dsar.subjectEmail}`,
              status: 'pending',
              priority: isSpecialCategory ? 'high' : 'normal',
              relatedActivities: [activity.name],
              dataCategories: activity.dataCategories.map((dc: any) => dc.category),
            };
            vendorTasksMap.set(recipient.vendorId, t);
            tasks.push(t);
          }
        }

        // 3. Internal systems check (if storage and no vendors)
        // Simple heuristic: if there are no vendors linked, assume internal
        const hasVendors = activity.recipients.some((r: any) => r.vendorId !== null);
        if (!hasVendors) {
          tasks.push({
            dsarId: input.dsarId,
            systemName: 'Internal systems',
            searchInstructions: `Search internal systems used for: "${activity.name}". Check for records matching: ${dsar.subjectEmail}`,
            status: 'pending',
            priority: isSpecialCategory ? 'high' : 'normal',
            relatedActivities: [activity.name],
          });
        }
      }

      if (tasks.length > 0) {
        await ctx.db.insert(dsarTasks).values(tasks);
      }

      return tasks;
    }),

  list: protectedProcedure
    .use(requirePermission('dsar', 'view'))
    .input(paginationInput.extend({ dsarId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      return paginatedQuery(
        dsarTasks,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc',
        [eq(dsarTasks.dsarId, input.dsarId)]
      );
    }),

  update: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      data: z.record(z.any())
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(dsarTasks).set({ ...input.data, updatedAt: new Date() }).where(eq(dsarTasks.id, input.id)).returning();
      return updated;
    }),
  addManual: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ dsarId: z.string().uuid(), systemName: z.string(), searchInstructions: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [inserted] = await ctx.db.insert(dsarTasks).values({
        dsarId: input.dsarId,
        systemName: input.systemName,
        searchInstructions: input.searchInstructions,
        priority: 'normal'
      }).returning();
      return inserted;
    }),
});

const commsRouter = router({
  list: protectedProcedure
    .use(requirePermission('dsar', 'view'))
    .input(paginationInput.extend({ dsarId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      return paginatedQuery(
        dsarCommunications,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'sentAt',
        'desc',
        [eq(dsarCommunications.dsarId, input.dsarId)]
      );
    }),

  send: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({
      dsarId: z.string().uuid(),
      subject: z.string(),
      body: z.string(),
      type: z.string().default('response')
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [dsar] = await ctx.db.select().from(dsarRequests).where(and(eq(dsarRequests.id, input.dsarId), eq(dsarRequests.organizationId, ctx.user!.orgId)));
      if (!dsar) throw new TRPCError({ code: 'NOT_FOUND' });

      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      if (!org) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Org not found' });

      try {
        // Enqueue the outbound email
        await ctx.db.insert(notificationQueue).values({
          organizationId: ctx.user!.orgId,
          type: 'dsar.reply_received',
          title: input.subject,
          body: input.body,
          channel: 'email',
          emailTo: dsar.subjectEmail,
          status: 'pending',
          priority: 'high',
          payload: { dsarId: dsar.id }
        });

        const [comm] = await ctx.db.insert(dsarCommunications).values({
          dsarId: input.dsarId,
          direction: 'outbound',
          type: input.type,
          channel: 'email',
          subject: input.subject,
          body: input.body,
          sentBy: ctx.user!.id,
          // emailMessageId will be updated by the worker
        }).returning();

        return comm;
      } catch (err) {
        console.error('Email queue failed', err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to queue email' });
      }
    }),
  logInbound: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ dsarId: z.string().uuid(), subject: z.string(), body: z.string(), channel: z.string().default('email') }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [comm] = await ctx.db.insert(dsarCommunications).values({
        dsarId: input.dsarId,
        direction: 'inbound',
        type: 'follow_up',
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        sentBy: ctx.user!.id
      }).returning();
      return comm;
    }),
  generateResponse: protectedProcedure
    .use(requirePermission('dsar', 'view'))
    .input(z.object({ dsarId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [dsar] = await ctx.db.select().from(dsarRequests).where(and(eq(dsarRequests.id, input.dsarId), eq(dsarRequests.organizationId, ctx.user!.orgId)));
      if (!dsar) throw new TRPCError({ code: 'NOT_FOUND' });
      return { 
        subject: `Response to your Data Subject Request (${dsar.referenceNumber})`, 
        body: `<p>Dear ${dsar.subjectName},</p><p>We have completed processing your request...</p>` 
      };
    }),
});


export const dsarRouter = router({
  verification: verificationRouter,
  tasks: tasksRouter,
  comms: commsRouter,

  submitPublic: publicProcedure
    .input(z.object({
      orgSlug: z.string(),
      requestType: z.string(),
      subjectName: z.string(),
      subjectEmail: z.string().email(),
      subjectIdentifier: z.any().optional(),
      details: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.slug, input.orgSlug));
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

      const referenceNumber = `DSAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const deadlineAt = new Date();
      deadlineAt.setDate(deadlineAt.getDate() + 30); // 30 days deadline

      const [newDsar] = await ctx.db.insert(dsarRequests).values({
        organizationId: org.id,
        referenceNumber,
        requestType: input.requestType,
        subjectName: input.subjectName,
        subjectEmail: input.subjectEmail,
        subjectIdentifier: input.subjectIdentifier,
        originalMessage: input.details,
        source: 'intake_portal',
        deadlineAt
      }).returning();

      if (!newDsar) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await orgEmbeddingsQueue.add('embed-dsar', {
        orgId: org.id,
        entityType: 'dsar',
        entityId: newDsar.id,
        action: 'upsert'
      });

      // Trigger Identity Verification Email
      const token = jwt.sign({ dsarId: newDsar.id, email: input.subjectEmail }, JWT_SECRET, { expiresIn: '7d' });
      const verifyLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/dsar/verify?token=${token}`;
      
      try {
        await resend.emails.send({
          from: `${org.name} via Custodia <noreply@${process.env.EMAIL_FROM_DOMAIN || 'trycustodia.online'}>`,
          replyTo: org.dpoEmail || `support@${process.env.EMAIL_FROM_DOMAIN || 'trycustodia.online'}`,
          to: input.subjectEmail,
          subject: `Action Required: Verify your data request to ${org.name}`,
          html: `
            <p>Hi ${input.subjectName},</p>
            <p>We received your request (${input.requestType}) regarding your personal data at ${org.name}.</p>
            <p>To protect your privacy, we must verify your email address before processing the request. Please click the link below to verify your identity:</p>
            <p><a href="${verifyLink}">Verify My Request</a></p>
            <p>This link will expire in 7 days.</p>
          `
        });

        // Log the outbound comm
        await ctx.db.insert(dsarCommunications).values({
          dsarId: newDsar.id,
          direction: 'outbound',
          type: 'verification_request',
          channel: 'email',
          subject: `Action Required: Verify your data request to ${org.name}`,
          body: 'System sent verification email with link.'
        });
      } catch(e) {
        console.error('Failed to send verification email on submit', e);
      }

      return { referenceNumber };
    }),

  list: protectedProcedure
    .use(requirePermission('dsar', 'view'))
    .input(paginationInput.extend({ includeChildEntities: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      let targetOrgs: string | string[] = ctx.user!.orgId;
      let orgMap = new Map<string, string>();

      if (input.includeChildEntities) {
        if (ctx.user!.entityScope !== 'group') throw new TRPCError({ code: 'FORBIDDEN' });
        
        const childOrgs = await ctx.db.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(eq(organizations.parentOrganizationId, ctx.user!.orgId));
          
        const parentOrg = await ctx.db.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, ctx.user!.orgId));
          
        const allOrgs = [...parentOrg, ...childOrgs];
        targetOrgs = allOrgs.map((o: any) => o.id);
        allOrgs.forEach((o: any) => orgMap.set(o.id, o.name));
        
        await verifyGroupScopeAndLog(
          ctx.user!.id,
          ctx.user!.orgId,
          targetOrgs,
          ctx.user!.entityScope,
          'query'
        );
      }

      const result = await paginatedQuery(
        dsarRequests,
        targetOrgs,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );

      if (input.includeChildEntities) {
        result.data = result.data.map((r: any) => ({
          ...r,
          organizationName: orgMap.get(r.organizationId) || 'Unknown'
        }));
      }

      return result;
    }),

  getById: protectedProcedure
    .use(requirePermission('dsar', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const dsar = await ctx.db.query.dsarRequests.findFirst({
        where: and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId)),
        with: {
          assignedTo: true
        }
      });
      if (!dsar) throw new TRPCError({ code: 'NOT_FOUND' });
      return dsar;
    }),

  updateStatus: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      status: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(dsarRequests)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId)))
        .returning();

      await orgEmbeddingsQueue.add('embed-dsar', {
        orgId: ctx.user!.orgId,
        entityType: 'dsar',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),

  extendDeadline: protectedProcedure
    .use(requirePermission('dsar', 'edit')) // Should be admin in a real strict RBAC
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string(),
      days: z.number().min(1).max(60)
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [dsar] = await ctx.db.select().from(dsarRequests).where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId)));
      if (!dsar) throw new TRPCError({ code: 'NOT_FOUND' });

      // Ensure extension happens within original 30 days
      const daysSinceReceipt = (Date.now() - dsar.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReceipt > 30) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Extensions must be communicated within the original 30-day period.' });
      }

      const extendedDeadline = new Date(dsar.deadlineAt);
      extendedDeadline.setDate(extendedDeadline.getDate() + input.days);

      const [updated] = await ctx.db.update(dsarRequests)
        .set({ 
          extended: true, 
          extensionReason: input.reason, 
          extendedDeadlineAt: extendedDeadline,
          updatedAt: new Date() 
        })
        .where(eq(dsarRequests.id, dsar.id))
        .returning();
        
      await orgEmbeddingsQueue.add('embed-dsar', {
        orgId: ctx.user!.orgId,
        entityType: 'dsar',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),

  refuse: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string(),
      detail: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(dsarRequests)
        .set({ 
          status: 'refused',
          refusalReason: input.reason,
          refusalDetail: input.detail,
          updatedAt: new Date() 
        })
        .where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId)))
        .returning();
        
      await orgEmbeddingsQueue.add('embed-dsar', {
        orgId: ctx.user!.orgId,
        entityType: 'dsar',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),

  assign: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ id: z.string().uuid(), userId: z.string().uuid().nullable() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(dsarRequests).set({ assignedTo: input.userId, updatedAt: new Date() }).where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId))).returning();
      return updated;
    }),

  close: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(dsarRequests).set({ status: 'completed', completedAt: new Date(), completedBy: ctx.user!.id, updatedAt: new Date() }).where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId))).returning();
      
      await orgEmbeddingsQueue.add('embed-dsar', {
        orgId: ctx.user!.orgId,
        entityType: 'dsar',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),

  exportDataPackage: protectedProcedure
    .use(requirePermission('dsar', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      // In a real app: compile tasks, generate JSON/PDF, upload to S3, return signed URL
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      const mockUrl = `https://s3.custodia.io/mock-package-${input.id}.json`;
      const [updated] = await ctx.db.update(dsarRequests).set({ dataPackageUrl: mockUrl, dataPackageFormat: 'json', dataPackageExpiresAt: expiry, updatedAt: new Date() }).where(and(eq(dsarRequests.id, input.id), eq(dsarRequests.organizationId, ctx.user!.orgId))).returning();
      return updated;
    }),
});
