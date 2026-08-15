import { z } from 'zod';
import { router, protectedProcedure, requireRole, requirePlatformAdmin } from '../trpc.js';
import { db } from '../db.js';
import { regulatoryUpdates, regulatoryUpdateMatches, processingActivities } from 'db';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { generateImpactAssessments } from '../lib/regulatoryImpact.js';

export const regulatoryRouter = router({
  listHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;
      
      const updates = await ctx.db.select()
        .from(regulatoryUpdates)
        .where(eq(regulatoryUpdates.status, 'published'))
        .orderBy(desc(regulatoryUpdates.publishedAt));
        
      if (!ctx.user?.orgId) return updates.slice(offset, offset + limit);

      const matches = await ctx.db.select()
        .from(regulatoryUpdateMatches)
        .where(
          and(
            eq(regulatoryUpdateMatches.organizationId, ctx.user.orgId),
            eq(regulatoryUpdateMatches.status, 'assessed')
          )
        );

      const updatesWithMatches = updates.map((update: any) => {
        const updateMatches = matches.filter((m: any) => m.regulatoryUpdateId === update.id);
        return {
          ...update,
          matches: updateMatches
        };
      });

      // Sort updates with *unacknowledged* matches to the top
      updatesWithMatches.sort((a: any, b: any) => {
        const aHasUnacknowledged = a.matches.some((m: any) => m.acknowledgedAt === null);
        const bHasUnacknowledged = b.matches.some((m: any) => m.acknowledgedAt === null);
        if (aHasUnacknowledged && !bHasUnacknowledged) return -1;
        if (!aHasUnacknowledged && bHasUnacknowledged) return 1;
        // Fall back to chronological
        return new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime();
      });

      return updatesWithMatches.slice(offset, offset + limit);
    }),

  listUnacknowledgedImpacts: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      // Fetch distinct updates that have unacknowledged matches for this org
      const matches = await ctx.db.select({
        match: regulatoryUpdateMatches,
        update: regulatoryUpdates
      })
      .from(regulatoryUpdateMatches)
      .innerJoin(regulatoryUpdates, eq(regulatoryUpdateMatches.regulatoryUpdateId, regulatoryUpdates.id))
      .where(
        and(
          eq(regulatoryUpdateMatches.organizationId, ctx.user.orgId),
          eq(regulatoryUpdateMatches.status, 'assessed'),
          isNull(regulatoryUpdateMatches.acknowledgedAt)
        )
      )
      .orderBy(desc(regulatoryUpdates.publishedAt));
      
      // Group by update
      const grouped = new Map<string, any>();
      for (const row of matches) {
        if (!grouped.has(row.update.id)) {
          grouped.set(row.update.id, {
            update: row.update,
            matches: []
          });
        }
        grouped.get(row.update.id).matches.push(row.match);
      }
      
      return Array.from(grouped.values());
    }),

  acknowledgeImpact: protectedProcedure
    .input(z.object({
      updateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      // Acknowledge all matches for this org and this update
      await ctx.db.update(regulatoryUpdateMatches)
        .set({ 
          acknowledgedBy: ctx.user.id,
          acknowledgedAt: new Date()
        })
        .where(
          and(
            eq(regulatoryUpdateMatches.regulatoryUpdateId, input.updateId),
            eq(regulatoryUpdateMatches.organizationId, ctx.user.orgId),
            isNull(regulatoryUpdateMatches.acknowledgedAt)
          )
        );
        
      return { success: true };
    }),

  // Admin Routes
  adminListDrafts: protectedProcedure
    .use(requireRole('owner')) // Assuming owner acts as super admin for now
    .query(async ({ ctx }) => {
      return ctx.db.select()
        .from(regulatoryUpdates)
        .where(eq(regulatoryUpdates.status, 'draft'))
        .orderBy(desc(regulatoryUpdates.createdAt));
    }),

  // Publishing fans impact assessments and notifications to *every* organisation,
  // so a tenant role cannot be the gate — every customer has an owner.
  adminPublishUpdate: protectedProcedure
    .use(requirePlatformAdmin())
    .input(z.object({
      updateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [update] = await ctx.db.update(regulatoryUpdates)
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
