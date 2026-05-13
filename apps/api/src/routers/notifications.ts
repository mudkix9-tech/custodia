import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { notificationQueue } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const notificationsRouter = router({
  listInApp: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      return db.select()
        .from(notificationQueue)
        .where(
          and(
            eq(notificationQueue.organizationId, ctx.user.orgId),
            eq(notificationQueue.channel, 'in_app')
          )
        )
        .orderBy(desc(notificationQueue.createdAt))
        .limit(50);
    }),

  markRead: protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      
      await db.update(notificationQueue)
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
