import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { dpias, dpiaRisks, dpiaMeasures, auditLogs } from 'db';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const dpiaRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return db.select()
        .from(dpias)
        .where(eq(dpias.organizationId, ctx.user!.orgId))
        .orderBy(desc(dpias.updatedAt));
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const dpia = await db.query.dpias.findFirst({
        where: and(
          eq(dpias.id, input.id),
          eq(dpias.organizationId, ctx.user!.orgId)
        ),
      });

      if (!dpia) throw new TRPCError({ code: 'NOT_FOUND' });
      return dpia;
    }),

  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      processingActivityIds: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [newDpia] = await db.insert(dpias).values({
        organizationId: ctx.user!.orgId,
        title: input.title,
        description: input.description,
        processingActivityIds: input.processingActivityIds,
      }).returning();

      if (!newDpia) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });


      return newDpia;
    }),

  update: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      data: z.record(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [updated] = await db.update(dpias)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(dpias.id, input.id), eq(dpias.organizationId, ctx.user!.orgId)))
        .returning();

      return updated;
    }),

  risks: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ dpiaId: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, input.dpiaId));
      }),
      
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        dpiaId: z.string().uuid(),
        description: z.string().min(1),
        likelihood: z.number().min(1).max(5).optional(),
        severity: z.number().min(1).max(5).optional(),
      }))
      .mutation(async ({ input }) => {
        const initialRiskScore = (input.likelihood && input.severity) ? input.likelihood * input.severity : null;
        
        const [inserted] = await db.insert(dpiaRisks).values({
          ...input,
          initialRiskScore,
        }).returning();
        return inserted;
      }),
      
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.record(z.any()),
      }))
      .mutation(async ({ input }) => {
        // If updating likelihood or severity, recalculate initialRiskScore
        const [updated] = await db.update(dpiaRisks)
          .set(input.data)
          .where(eq(dpiaRisks.id, input.id))
          .returning();
        return updated;
      }),
      
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const [deleted] = await db.delete(dpiaRisks).where(eq(dpiaRisks.id, input.id)).returning();
        return deleted;
      })
  }),

  measures: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ dpiaRiskId: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.select().from(dpiaMeasures).where(eq(dpiaMeasures.dpiaRiskId, input.dpiaRiskId));
      }),
      
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        dpiaRiskId: z.string().uuid(),
        description: z.string().min(1),
        status: z.string().default('planned'),
      }))
      .mutation(async ({ input }) => {
        const [inserted] = await db.insert(dpiaMeasures).values(input).returning();
        return inserted;
      }),
      
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.record(z.any()),
      }))
      .mutation(async ({ input }) => {
        const [updated] = await db.update(dpiaMeasures)
          .set(input.data)
          .where(eq(dpiaMeasures.id, input.id))
          .returning();
        return updated;
      }),
      
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const [deleted] = await db.delete(dpiaMeasures).where(eq(dpiaMeasures.id, input.id)).returning();
        return deleted;
      })
  })
});
