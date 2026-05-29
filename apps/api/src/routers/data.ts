import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { organizations } from 'db';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { dataExportQueue } from '../lib/queue.js';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const dataRouter = router({
  requestExport: protectedProcedure
    .use(requireRole('admin'))
    .mutation(async ({ ctx }) => {
      checkOrgContext(ctx.user);

      await dataExportQueue.add('export-org-data', {
          organizationId: ctx.user!.orgId,
          requestedBy: ctx.user!.id,
      });

      return { success: true, message: "Data export job has been queued. You will receive an email shortly." };
    }),

  scheduleDeletion: protectedProcedure
    .use(requireRole('owner'))
    .mutation(async ({ ctx }) => {
      checkOrgContext(ctx.user);

      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30); // 30 day grace period

      const [updated] = await ctx.db.update(organizations)
        .set({ deletionScheduledAt: deletionDate, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Failed to schedule deletion" });
      }

      return { success: true, message: "Organization scheduled for deletion", deletionDate };
    }),
});
