import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, users } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const settingsRouter = router({
  getOrgSettings: protectedProcedure
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return {
        slackWebhookUrl: org.slackWebhookUrl,
        notificationPreferences: org.notificationPreferences,
      };
    }),

  updateOrgSettings: protectedProcedure
    .input(z.object({
      slackWebhookUrl: z.string().url().optional().or(z.literal('')),
      notificationPreferences: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      // Ensure only admins can update org settings
      if (ctx.user!.role !== 'admin' && ctx.user!.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Must be admin or owner' });
      }

      const updateData: any = {};
      if (input.slackWebhookUrl !== undefined) updateData.slackWebhookUrl = input.slackWebhookUrl === '' ? null : input.slackWebhookUrl;
      if (input.notificationPreferences !== undefined) updateData.notificationPreferences = input.notificationPreferences;

      const [updated] = await db.update(organizations)
        .set(updateData)
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning();

      return updated;
    }),

  getUserSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user!.id));
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return {
        notificationOverrides: user.notificationOverrides,
      };
    }),

  updateUserSettings: protectedProcedure
    .input(z.object({
      notificationOverrides: z.record(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(users)
        .set({ notificationOverrides: input.notificationOverrides })
        .where(eq(users.id, ctx.user!.id))
        .returning();

      return updated;
    }),
});
