import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { 
  clients, 
  clientProcessingActivities, 
  processingActivities, 
  organizationVendors 
} from 'db';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

export const clientsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgClients = await db.query.clients.findMany({
      where: eq(clients.organizationId, ctx.user.orgId),
      orderBy: (clients, { desc }) => [desc(clients.createdAt)],
      with: {
        processingActivities: true,
      }
    });

    return orgClients.map(c => ({
      ...c,
      linkedActivitiesCount: c.processingActivities.length,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, input.id),
          eq(clients.organizationId, ctx.user.orgId)
        ),
        with: {
          processingActivities: {
            with: {
              processingActivity: true
            }
          }
        }
      });

      if (!client) throw new TRPCError({ code: 'NOT_FOUND' });

      return client;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      legalName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional().or(z.literal('')),
      countryCode: z.string().length(2).optional(),
      industry: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [newClient] = await db.insert(clients).values({
        organizationId: ctx.user.orgId,
        ...input,
        contactEmail: input.contactEmail || undefined,
      }).returning();
      return newClient;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      legalName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional().or(z.literal('')),
      countryCode: z.string().length(2).optional(),
      industry: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await db.update(clients)
        .set({ ...data, contactEmail: data.contactEmail || undefined, updatedAt: new Date() })
        .where(and(
          eq(clients.id, id),
          eq(clients.organizationId, ctx.user.orgId)
        )).returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      }
      await db.update(clients)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(clients.id, input.id),
          eq(clients.organizationId, ctx.user.orgId)
        ));
      return { success: true };
    }),

  togglePortal: protectedProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      }
      
      const payload: any = { portalEnabled: input.enabled, updatedAt: new Date() };
      
      if (input.enabled) {
        // Generate token if it doesn't exist
        const client = await db.query.clients.findFirst({
          where: and(eq(clients.id, input.id), eq(clients.organizationId, ctx.user.orgId))
        });
        if (!client) throw new TRPCError({ code: 'NOT_FOUND' });
        
        if (!client.portalToken) {
          payload.portalToken = crypto.randomBytes(32).toString('hex');
        }
      }

      const [updated] = await db.update(clients)
        .set(payload)
        .where(and(
          eq(clients.id, input.id),
          eq(clients.organizationId, ctx.user.orgId)
        )).returning();
      return updated;
    }),

  rotateToken: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      }
      const newToken = crypto.randomBytes(32).toString('hex');
      const [updated] = await db.update(clients)
        .set({ portalToken: newToken, updatedAt: new Date() })
        .where(and(
          eq(clients.id, input.id),
          eq(clients.organizationId, ctx.user.orgId)
        )).returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  linkActivity: protectedProcedure
    .input(z.object({ clientId: z.string().uuid(), processingActivityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify activity belongs to org
      const act = await db.query.processingActivities.findFirst({
        where: and(
          eq(processingActivities.id, input.processingActivityId),
          eq(processingActivities.organizationId, ctx.user.orgId)
        )
      });
      if (!act) throw new TRPCError({ code: 'NOT_FOUND' });

      await db.insert(clientProcessingActivities).values({
        clientId: input.clientId,
        processingActivityId: input.processingActivityId,
      }).onConflictDoNothing();
      return { success: true };
    }),

  unlinkActivity: protectedProcedure
    .input(z.object({ clientId: z.string().uuid(), processingActivityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify client belongs to org
      const client = await db.query.clients.findFirst({
        where: and(eq(clients.id, input.clientId), eq(clients.organizationId, ctx.user.orgId))
      });
      if (!client) throw new TRPCError({ code: 'NOT_FOUND' });

      await db.delete(clientProcessingActivities)
        .where(and(
          eq(clientProcessingActivities.clientId, input.clientId),
          eq(clientProcessingActivities.processingActivityId, input.processingActivityId)
        ));
      return { success: true };
    }),

  linkActivitiesBulk: protectedProcedure
    .input(z.object({ clientId: z.string().uuid(), activityIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.activityIds.length === 0) return { success: true };
      
      const acts = await db.query.processingActivities.findMany({
        where: and(
          inArray(processingActivities.id, input.activityIds),
          eq(processingActivities.organizationId, ctx.user.orgId)
        )
      });
      
      if (acts.length === 0) throw new TRPCError({ code: 'NOT_FOUND' });

      const values = acts.map(a => ({
        clientId: input.clientId,
        processingActivityId: a.id,
      }));

      await db.insert(clientProcessingActivities).values(values).onConflictDoNothing();
      return { success: true, linked: acts.length };
    }),

  updateActivitiesBulk: protectedProcedure
    .input(z.object({ processingActivityId: z.string().uuid(), clientIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      // Used by ROPA editor to sync clients
      const act = await db.query.processingActivities.findFirst({
        where: and(eq(processingActivities.id, input.processingActivityId), eq(processingActivities.organizationId, ctx.user.orgId))
      });
      if (!act) throw new TRPCError({ code: 'NOT_FOUND' });

      await db.delete(clientProcessingActivities)
        .where(eq(clientProcessingActivities.processingActivityId, input.processingActivityId));

      if (input.clientIds.length > 0) {
        // Filter out non-org clients securely
        const orgClients = await db.query.clients.findMany({
          where: and(
            eq(clients.organizationId, ctx.user.orgId),
            inArray(clients.id, input.clientIds)
          )
        });

        const values = orgClients.map(c => ({
          clientId: c.id,
          processingActivityId: input.processingActivityId,
        }));

        if (values.length > 0) {
          await db.insert(clientProcessingActivities).values(values);
        }
      }
      return { success: true };
    }),

  getPortalPreview: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Re-use logic from portalRouter, but with auth checks
      // In a real implementation we could extract the shared logic, but for now we'll do a simple mock or call it
      throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Use iframe pointing to actual portal internally' });
    }),

  updateDpa: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      dpaStatus: z.string(),
      dpaSignedAt: z.string().optional().nullable(),
      dpaExpiresAt: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(clients)
        .set({
          dpaStatus: input.dpaStatus,
          dpaSignedAt: input.dpaSignedAt ? new Date(input.dpaSignedAt) : null,
          dpaExpiresAt: input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(clients.id, input.id),
          eq(clients.organizationId, ctx.user.orgId)
        )).returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  uploadDpa: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      documentId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify doc
      const [updated] = await db.update(clients)
        .set({ dpaDocumentId: input.documentId, updatedAt: new Date() })
        .where(and(
          eq(clients.id, input.clientId),
          eq(clients.organizationId, ctx.user.orgId)
        )).returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  getComplianceScore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Similar to portal score calculation
      const cpa = await db.query.clientProcessingActivities.findMany({
        where: eq(clientProcessingActivities.clientId, input.id),
        with: { processingActivity: true }
      });
      const acts = cpa.map(c => c.processingActivity);
      let score = 100;
      if (acts.length > 0) {
        score -= acts.filter(a => a.status === 'draft').length * 5;
      }
      return Math.max(0, score);
    }),

  generateComplianceReport: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Mock PDF generation
      const mockS3Url = `https://s3.privaro.io/exports/client_${input.id}_report.pdf`;
      return { url: mockS3Url };
    }),

});
