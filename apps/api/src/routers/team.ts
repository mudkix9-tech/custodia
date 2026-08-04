import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { users } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { enforceLimit } from '../lib/billing.js';
import React from 'react';
import { sendEmail, TeamInvitation } from 'emails';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const teamRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return ctx.db.select().from(users).where(eq(users.organizationId, ctx.user!.orgId));
    }),

  invite: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1).optional(),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await enforceLimit(ctx.db, ctx.user!.orgId, 'users', 1);

      const existing = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email)
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'User already exists' });
      }

      const [newUser] = await ctx.db.insert(users).values({
        organizationId: ctx.user!.orgId,
        email: input.email,
        name: input.name || input.email.split('@')[0],
        role: input.role,
        invitedAt: new Date(),
        invitedBy: ctx.user!.id,
      } as any).returning();

      if (!newUser) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      
      const inviter = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user!.id)
      });
      const inviterName = inviter?.name || inviter?.email || 'A colleague';
      
      // In a real app we'd fetch orgName, but using a placeholder for now
      const orgName = 'Your Organization'; 
      const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      
      await sendEmail({
        to: newUser.email,
        subject: `${inviterName} invited you to join ${orgName}`,
        template: React.createElement(TeamInvitation, {
          inviterName,
          orgName,
          role: input.role,
          url,
        }),
      });

      return newUser;
    }),

  bulkInvite: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      emails: z.array(z.string()),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const validEmails: string[] = [];
      const invalidEmails: string[] = [];
      
      const emailSchema = z.string().email();
      for (const email of input.emails) {
        if (emailSchema.safeParse(email).success) {
          validEmails.push(email);
        } else {
          invalidEmails.push(email);
        }
      }
      
      const existingUsersRes = await ctx.db.query.users.findMany({
        where: eq(users.organizationId, ctx.user!.orgId)
      });
      const existingEmails = new Set(existingUsersRes.map((u: any) => u.email));
      
      const newValidEmails: string[] = [];
      const duplicateEmails: string[] = [];

      for (const email of validEmails) {
        if (existingEmails.has(email)) {
          duplicateEmails.push(email);
        } else {
          newValidEmails.push(email);
        }
      }
      
      if (newValidEmails.length > 0) {
        await enforceLimit(ctx.db, ctx.user!.orgId, 'users', newValidEmails.length);
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const email of newValidEmails) {
        const [newUser] = await ctx.db.insert(users).values({
          organizationId: ctx.user!.orgId,
          email: email,
          name: email.split('@')[0],
          role: input.role,
          invitedAt: new Date(),
          invitedBy: ctx.user!.id,
        } as any).returning();

        const inviter = await ctx.db.query.users.findFirst({
          where: eq(users.id, ctx.user!.id)
        });
        const inviterName = inviter?.name || inviter?.email || 'A colleague';
        
        const orgName = 'Your Organization';
        const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

        try {
          await sendEmail({
            to: newUser.email,
            subject: `${inviterName} invited you to join ${orgName}`,
            template: React.createElement(TeamInvitation, {
              inviterName,
              orgName,
              role: input.role,
              url,
            }),
          });
          sentCount++;
        } catch (error) {
          console.error(`Failed to send email to ${email}:`, error);
          failedCount++;
        }
      }

      return {
        sentCount,
        failedCount,
        duplicateCount: duplicateEmails.length,
        invalidCount: invalidEmails.length,
      };
    }),

  resendInvite: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      userId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const existing = await ctx.db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.organizationId, ctx.user!.orgId))
      });

      if (!existing || !existing.invitedAt || existing.emailVerified) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is not a pending invitee' });
      }

      await ctx.db.update(users)
        .set({ invitedAt: new Date() })
        .where(eq(users.id, input.userId));

      const inviter = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user!.id)
      });
      const inviterName = inviter?.name || inviter?.email || 'A colleague';
      
      const orgName = 'Your Organization';
      const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

      await sendEmail({
        to: existing.email,
        subject: `${inviterName} invited you to join ${orgName}`,
        template: React.createElement(TeamInvitation, {
          inviterName,
          orgName,
          role: existing.role,
          url,
        }),
      });

      return { success: true };
    }),

  updateRole: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
      customRoleId: z.string().uuid().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      if (input.userId === ctx.user!.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change your own role' });
      }

      const [updated] = await ctx.db.update(users)
        .set({ role: input.role, customRoleId: input.customRoleId !== undefined ? input.customRoleId : null, tokenInvalidatedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(users.id, input.userId), eq(users.organizationId, ctx.user!.orgId)))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await dispatchWebhook(ctx.user!.orgId, 'team.role_changed', { userId: input.userId });
      return updated;
    }),

  updatePermissions: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      userId: z.string().uuid(),
      permissions: z.array(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      if (input.userId === ctx.user!.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change your own permissions' });
      }

      const [updated] = await ctx.db.update(users)
        .set({ permissions: input.permissions, tokenInvalidatedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(users.id, input.userId), eq(users.organizationId, ctx.user!.orgId)))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      return updated;
    }),

  remove: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      userId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      if (input.userId === ctx.user!.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove yourself' });
      }

      const [removed] = await ctx.db.update(users)
        .set({ organizationId: null, role: 'member', tokenInvalidatedAt: new Date() })
        .where(and(eq(users.id, input.userId), eq(users.organizationId, ctx.user!.orgId)))
        .returning();

      await dispatchWebhook(ctx.user!.orgId, 'team.user_removed', { userId: input.userId });
      return { success: true };
    }),
});
