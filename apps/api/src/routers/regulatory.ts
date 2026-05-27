import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { regulatoryUpdates, regulatoryImpactAssessments, processingActivities } from 'db';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { generateImpactAssessments } from '../lib/regulatoryImpact.js';

export const regulatoryRouter = router({
  listHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;
      
      const updates = await db.select()
        .from(regulatoryUpdates)
        .where(eq(regulatoryUpdates.status, 'published'))
        .orderBy(desc(regulatoryUpdates.publishedAt))
        .limit(limit)
        .offset(offset);
        
      return updates;
    }),

  listUnacknowledgedImpacts: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      const impacts = await db.select({
        assessment: regulatoryImpactAssessments,
        update: regulatoryUpdates
      })
      .from(regulatoryImpactAssessments)
      .innerJoin(regulatoryUpdates, eq(regulatoryImpactAssessments.regulatoryUpdateId, regulatoryUpdates.id))
      .where(
        and(
          eq(regulatoryImpactAssessments.organizationId, ctx.user.orgId),
          eq(regulatoryImpactAssessments.status, 'unread')
        )
      )
      .orderBy(desc(regulatoryUpdates.publishedAt));
      
      return impacts.map(row => ({
        ...row.assessment,
        update: row.update
      }));
    }),

  acknowledgeImpact: protectedProcedure
    .input(z.object({
      assessmentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      const [updated] = await db.update(regulatoryImpactAssessments)
        .set({ 
          status: 'acknowledged',
          acknowledgedBy: ctx.user.id,
          acknowledgedAt: new Date()
        })
        .where(
          and(
            eq(regulatoryImpactAssessments.id, input.assessmentId),
            eq(regulatoryImpactAssessments.organizationId, ctx.user.orgId)
          )
        )
        .returning();
        
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  // Admin Routes
  adminListDrafts: protectedProcedure
    .use(requireRole('owner')) // Assuming owner acts as super admin for now
    .query(async () => {
      return db.select()
        .from(regulatoryUpdates)
        .where(eq(regulatoryUpdates.status, 'draft'))
        .orderBy(desc(regulatoryUpdates.createdAt));
    }),

  adminPublishUpdate: protectedProcedure
    .use(requireRole('owner'))
    .input(z.object({
      updateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [update] = await db.update(regulatoryUpdates)
        .set({ 
          status: 'published',
          publishedAt: new Date(),
          reviewedBy: ctx.user!.id
        })
        .where(eq(regulatoryUpdates.id, input.updateId))
        .returning();
        
      if (!update) throw new TRPCError({ code: 'NOT_FOUND' });
      
      // Generate per-org impact assessments
      await generateImpactAssessments(input.updateId);

      return update;
    })
});
