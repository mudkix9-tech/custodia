import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, users } from 'db';
import { eq } from 'drizzle-orm';
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
      return org;
    }),

  updateOrgSettings: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      legalName: z.string().optional().nullable(),
      slug: z.string().optional(),
      registrationNumber: z.string().optional().nullable(),
      countryCode: z.string().length(2).optional().or(z.literal('')),
      address: z.any().optional().nullable(),
      hasDpo: z.boolean().optional(),
      dpoName: z.string().optional().nullable(),
      dpoEmail: z.string().email().optional().or(z.literal('')).nullable(),
      dpoIsExternal: z.boolean().optional(),
      leadSupervisoryAuthority: z.string().optional().nullable(),
      slackWebhookUrl: z.string().url().optional().or(z.literal('').transform(() => null)).nullable(),
      notificationPreferences: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      if (ctx.user!.role !== 'admin' && ctx.user!.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Must be admin or owner' });
      }

      // Convert empty strings to null for DB constraints if needed
      const updateData = { ...input };
      if (updateData.countryCode === '') updateData.countryCode = undefined; // Assuming DB schema handles it or allows it
      if (updateData.dpoEmail === '') updateData.dpoEmail = null;

      const [updated] = await db.update(organizations)
        .set({
            ...updateData,
            updatedAt: new Date(),
        })
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning();

      return updated;
    }),

  getUserSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user!.id));
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),

  updateUserSettings: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      notificationOverrides: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { ...input };

      const [updated] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user!.id))
        .returning();

      return updated;
    }),
});
