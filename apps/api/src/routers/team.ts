import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { users, auditLogs } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const teamRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return db.select().from(users).where(eq(users.organizationId, ctx.user!.orgId));
    }),

  invite: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      // Check if user already exists
      const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email)
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'User already exists' });
      }

      // Generate a random temporary password or just rely on magic links
      // For now, NextAuth Resend uses magic links, so we just create the user shell.
      const [newUser] = await db.insert(users).values({
        organizationId: ctx.user!.orgId,
        email: input.email,
        name: input.name,
        role: input.role,
        invitedAt: new Date(),
        invitedBy: ctx.user!.id,
      }).returning();

      if (!newUser) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });


      // TODO: Actually send the invite email via Resend/Postmark here.
      
      return newUser;
    }),

  updateRole: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      if (input.userId === ctx.user!.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change your own role' });
      }

      const [updated] = await db.update(users)
        .set({ role: input.role, updatedAt: new Date() })
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

      // Instead of hard delete, maybe just remove them from the org or soft delete.
      // We will nullify organizationId to remove them from the org.
      const [removed] = await db.update(users)
        .set({ organizationId: null, role: 'member' })
        .where(and(eq(users.id, input.userId), eq(users.organizationId, ctx.user!.orgId)))
        .returning();


      return { success: true };
    }),
});
