import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { reconsentFlags, processingActivities } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const reconsentRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['flagged', 'dismissed', 'all']).default('flagged')
    }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      if (!user?.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      let whereClause = eq(reconsentFlags.organizationId, user.orgId);
      
      if (input.status !== 'all') {
        whereClause = and(whereClause, eq(reconsentFlags.status, input.status)) as typeof whereClause;
      }

      const flags = await ctx.db.select({
        flag: reconsentFlags,
        activity: {
          id: processingActivities.id,
          name: processingActivities.name,
          purpose: processingActivities.purpose
        }
      })
      .from(reconsentFlags)
      .innerJoin(processingActivities, eq(reconsentFlags.processingActivityId, processingActivities.id))
      .where(whereClause)
      .orderBy(desc(reconsentFlags.detectedAt));

      return flags.map((f: any) => ({
        ...f.flag,
        activity: f.activity
      }));
    }),

  dismiss: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (!user?.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const [updated] = await ctx.db.update(reconsentFlags)
        .set({
          status: 'dismissed',
          dismissedBy: user.id,
          dismissedAt: new Date()
        })
        .where(and(
          eq(reconsentFlags.id, input.id),
          eq(reconsentFlags.organizationId, user.orgId)
        ))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return updated;
    })
});
