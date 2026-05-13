import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { regulatoryUpdates, regulatoryImpactAssessments, processingActivities } from 'db';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

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
      
      // We would trigger a worker here to evaluate impact rules against all orgs
      // For now we will do a simple inline evaluation for the current org as a mock
      // Or simply do nothing and rely on the worker. Since we need to test it,
      // let's evaluate impact rules for all orgs synchronously for now (or via a simple loop).
      
      // Evaluate impact rules for all organizations
      const allActivities = await db.select().from(processingActivities);
      // In a real system, you group by org.
      const orgActivitiesMap = new Map<string, typeof allActivities>();
      for (const act of allActivities) {
        if (!act.organizationId) continue;
        if (!orgActivitiesMap.has(act.organizationId)) orgActivitiesMap.set(act.organizationId, []);
        orgActivitiesMap.get(act.organizationId)!.push(act);
      }

      const rules = (update.impactRules as any[]) || [];
      
      for (const [orgId, activities] of orgActivitiesMap.entries()) {
        const affectedActivities = [];
        
        for (const activity of activities) {
          let isAffected = false;
          let reason = '';
          
          for (const rule of rules) {
            const conditions = rule.conditions || {};
            // Simplified condition matching
            if (conditions.involvesChildren && activity.involvesChildren) {
              isAffected = true;
              reason = rule.messageTemplate || 'Involves children';
              break;
            }
            if (conditions.usesVendorCategory && conditions.usesVendorCategory.includes('analytics')) {
              // mock logic
              isAffected = true;
              reason = rule.messageTemplate || 'Uses analytics vendor';
              break;
            }
            if (conditions.hasTransfersTo && conditions.hasTransfersTo.includes('US')) {
               // mock logic
               isAffected = true;
               reason = rule.messageTemplate || 'Transfers to US';
               break;
            }
          }
          
          if (isAffected) {
            affectedActivities.push({
              activityId: activity.id,
              activityName: activity.name || activity.purpose,
              reason
            });
          }
        }
        
        if (affectedActivities.length > 0) {
          await db.insert(regulatoryImpactAssessments).values({
            regulatoryUpdateId: update.id,
            organizationId: orgId,
            affectedActivities,
          }).onConflictDoNothing();
        }
      }

      return update;
    })
});
