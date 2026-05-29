import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { notificationQueue } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { paginatedQuery } from '../utils/pagination.js';

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

export const notificationsRouter = router({
  listInApp: protectedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      return paginatedQuery(
        notificationQueue,
        ctx.user.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc',
        [eq(notificationQueue.channel, 'in_app')]
      );
    }),

  markRead: protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      await ctx.db.update(notificationQueue)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(
          and(
            eq(notificationQueue.organizationId, ctx.user.orgId),
            eq(notificationQueue.channel, 'in_app'),
            inArray(notificationQueue.id, input.ids)
          )
        );
        
      return { success: true };
    }),
});
