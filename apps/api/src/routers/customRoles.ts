import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { customRoles, users } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const customRolesRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return ctx.db.select().from(customRoles).where(eq(customRoles.organizationId, ctx.user!.orgId));
    }),

  create: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      permissions: z.record(z.string(), z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const [newRole] = await ctx.db.insert(customRoles).values({
        organizationId: ctx.user!.orgId,
        name: input.name,
        description: input.description || null,
        permissions: input.permissions,
      } as any).returning();

      return newRole;
    }),

  update: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      permissions: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const { id, ...updateData } = input;

      const [updatedRole] = await ctx.db.update(customRoles)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, ctx.user!.orgId)))
        .returning();

      if (!updatedRole) throw new TRPCError({ code: 'NOT_FOUND' });

      // Optional: invalidate tokens for users with this custom role
      await ctx.db.update(users)
        .set({ tokenInvalidatedAt: new Date() })
        .where(eq(users.customRoleId, id));

      return updatedRole;
    }),

  delete: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const role = await ctx.db.query.customRoles.findFirst({
        where: and(eq(customRoles.id, input.id), eq(customRoles.organizationId, ctx.user!.orgId))
      });

      if (!role) throw new TRPCError({ code: 'NOT_FOUND' });
      if (role.isDefault) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete default enterprise roles' });

      // Unassign role from users
      await ctx.db.update(users)
        .set({ customRoleId: null, tokenInvalidatedAt: new Date() })
        .where(eq(users.customRoleId, input.id));

      await ctx.db.delete(customRoles)
        .where(and(eq(customRoles.id, input.id), eq(customRoles.organizationId, ctx.user!.orgId)));

      return { success: true };
    }),
});
