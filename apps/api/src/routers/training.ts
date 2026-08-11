import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { trainingModules, trainingCompletions, users, documents, organizations } from 'db';
import { eq, and, desc, inArray, isNull, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { renderPdf } from '../lib/pdfClient.js';
import crypto from 'crypto';

// Helpers
const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

export const trainingRouter = router({
  // MODULES
  listModules: protectedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const limit = input.limit;
      const res = await ctx.db.select().from(trainingModules)
        .where(or(
          eq(trainingModules.isGlobal, true),
          eq(trainingModules.organizationId, ctx.user!.orgId)
        ))
        .orderBy(desc(trainingModules.createdAt))
        // Basic cursor fallback could be added here, but since it's a mix of global and org, we just query it plain for now
        // with limit + 1. Proper pagination on mixed OR conditions with paginatedQuery requires a bit of manual tweaking,
        // so we'll leave it as a simple limit query or use paginatedQuery if we adapt the helper to take custom where arrays.
        .limit(limit + 1);

      const has_more = res.length > limit;
      const data = res.slice(0, limit);
      return {
        data,
        pagination: { has_more, next_cursor: null } // simplified
      };
    }),

  getModule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const mod = await ctx.db.query.trainingModules.findFirst({
        where: and(
          eq(trainingModules.id, input.id),
          or(
            eq(trainingModules.isGlobal, true),
            eq(trainingModules.organizationId, ctx.user!.orgId)
          )
        )
      });
      if (!mod) throw new TRPCError({ code: 'NOT_FOUND' });
      return mod;
    }),

  createModule: protectedProcedure
    .use(requirePermission('ropa', 'edit')) // Assuming admin/editor permissions
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      isMandatory: z.boolean().default(true),
      passingScore: z.number().default(70),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [newMod] = await ctx.db.insert(trainingModules).values({
        organizationId: ctx.user!.orgId,
        title: input.title,
        description: input.description,
        isMandatory: input.isMandatory,
        passingScore: input.passingScore,
        status: 'draft',
      }).returning();
      return newMod;
    }),

  updateModule: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().optional(),
      description: z.string().optional(),
      content: z.any().optional(),
      quiz: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const { id, ...data } = input;
      const [updated] = await ctx.db.update(trainingModules)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(trainingModules.id, id),
          eq(trainingModules.organizationId, ctx.user!.orgId),
          eq(trainingModules.isGlobal, false) // Cannot edit global
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return updated;
    }),

  publishModule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(trainingModules)
        .set({ status: 'published', updatedAt: new Date() })
        .where(and(
          eq(trainingModules.id, input.id),
          eq(trainingModules.organizationId, ctx.user!.orgId)
        ))
        .returning();
      
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      // Auto-assign to existing users if mandatory
      if (updated.isMandatory) {
        const orgUsers = await ctx.db.query.users.findMany({
          where: eq(users.organizationId, ctx.user!.orgId)
        });
        
        const existingCompletions = await ctx.db.query.trainingCompletions.findMany({
          where: eq(trainingCompletions.moduleId, input.id)
        });
        const existingUserIds = existingCompletions.map((c: any) => c.userId);

        const newAssignments = orgUsers
          .filter((u: any) => !existingUserIds.includes(u.id))
          .map((u: any) => ({
            organizationId: ctx.user!.orgId,
            userId: u.id,
            moduleId: input.id,
            status: 'not_started',
          }));

        if (newAssignments.length > 0) {
          await ctx.db.insert(trainingCompletions).values(newAssignments);
        }
      }

      return updated;
    }),

  getStats: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const completions = await ctx.db.query.trainingCompletions.findMany({
        where: and(
          eq(trainingCompletions.organizationId, ctx.user!.orgId),
          eq(trainingCompletions.moduleId, input.id)
        )
      });
      const passed = completions.filter((c: any) => c.status === 'passed').length;
      return {
        totalAssigned: completions.length,
        passed,
        inProgress: completions.filter((c: any) => c.status === 'in_progress').length,
        notStarted: completions.filter((c: any) => c.status === 'not_started').length,
        averageScore: completions.length > 0 
          ? Math.round(completions.reduce((acc: any, c: any) => acc + (c.quizScore || 0), 0) / completions.length)
          : 0
      };
    }),

  // COMPLETIONS (EMPLOYEE)
  myModules: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    const myComps = await ctx.db.query.trainingCompletions.findMany({
      where: eq(trainingCompletions.userId, ctx.user!.id),
      with: { module: true },
      orderBy: desc(trainingCompletions.createdAt)
    });

    // Also inject global modules if missing
    const globals = await ctx.db.query.trainingModules.findMany({
      where: and(eq(trainingModules.isGlobal, true), eq(trainingModules.status, 'published'))
    });

    const missingCompsToInsert: any[] = [];
    const missingModules: any[] = [];

    for (const g of globals) {
      if (!myComps.find((c: any) => c.moduleId === g.id)) {
        missingCompsToInsert.push({
          organizationId: ctx.user!.orgId,
          userId: ctx.user!.id,
          moduleId: g.id,
          status: 'not_started'
        });
        missingModules.push(g);
      }
    }

    if (missingCompsToInsert.length > 0) {
      const insertedComps = await ctx.db.insert(trainingCompletions).values(missingCompsToInsert).returning();
      for (let i = 0; i < insertedComps.length; i++) {
        myComps.push({ ...insertedComps[i], module: missingModules[i] } as any);
      }
    }

    return myComps;
  }),

  startModule: protectedProcedure
    .input(z.object({ completionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(trainingCompletions)
        .set({ status: 'in_progress', startedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(trainingCompletions.id, input.completionId),
          eq(trainingCompletions.userId, ctx.user!.id),
          eq(trainingCompletions.status, 'not_started')
        )).returning();
      return updated;
    }),

  trackProgress: protectedProcedure
    .input(z.object({ 
      completionId: z.string().uuid(),
      slideId: z.string(),
      timeSpentMs: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const comp = await ctx.db.query.trainingCompletions.findFirst({
        where: and(
          eq(trainingCompletions.id, input.completionId),
          eq(trainingCompletions.userId, ctx.user!.id)
        )
      });
      if (!comp) throw new TRPCError({ code: 'NOT_FOUND' });
      
      const views = Array.isArray(comp.slidesViewed) ? [...comp.slidesViewed] : [];
      const existing = views.find(v => v.slideId === input.slideId);
      if (existing) {
        existing.timeSpentMs += input.timeSpentMs;
      } else {
        views.push({ slideId: input.slideId, timeSpentMs: input.timeSpentMs, firstViewedAt: new Date() });
      }

      await ctx.db.update(trainingCompletions)
        .set({ slidesViewed: views, updatedAt: new Date() })
        .where(eq(trainingCompletions.id, input.completionId));
      return { success: true };
    }),

  submitQuiz: protectedProcedure
    .input(z.object({
      completionId: z.string().uuid(),
      answers: z.record(z.string(), z.string()), // Question ID -> Selected Option ID
    }))
    .mutation(async ({ ctx, input }) => {
      const comp = await ctx.db.query.trainingCompletions.findFirst({
        where: and(
          eq(trainingCompletions.id, input.completionId),
          eq(trainingCompletions.userId, ctx.user!.id)
        ),
        with: { module: true }
      });
      if (!comp || !comp.module) throw new TRPCError({ code: 'NOT_FOUND' });

      // Cooling period logic
      if (comp.lastAttemptAt && comp.status === 'failed') {
        const timeSince = new Date().getTime() - new Date(comp.lastAttemptAt).getTime();
        if (timeSince < 24 * 60 * 60 * 1000) { // 24 hours
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You must wait 24 hours before retaking this quiz.' });
        }
      }

      const quizData = comp.module.quiz as any;
      if (!quizData || !quizData.questions) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      let correctAnswers = 0;
      const totalQuestions = quizData.questions.length;

      quizData.questions.forEach((q: any) => {
        const selectedId = input.answers[q.id];
        const correctOption = q.options.find((o: any) => o.correct);
        if (selectedId && correctOption && selectedId === correctOption.id) {
          correctAnswers++;
        }
      });

      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const passed = score >= (comp.module.passingScore || 70);
      const status = passed ? 'passed' : 'failed';
      
      const payload: any = {
        status,
        quizScore: score,
        quizPassed: passed,
        quizAttempts: (comp.quizAttempts || 0) + 1,
        lastAttemptAt: new Date(),
        quizAnswers: input.answers,
        updatedAt: new Date()
      };

      if (passed) {
        payload.completedAt = new Date();
        if (comp.module.recurrence === 'annual') {
          payload.expiresAt = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
        }
        await dispatchWebhook(ctx.user!.orgId, 'training.completed', { completionId: comp.id, userId: ctx.user!.id, moduleId: comp.moduleId });
        payload.certificateId = `CERT-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        
        // Generate PDF
        try {
          const org = await ctx.db.query.organizations.findFirst({ where: eq(organizations.id, ctx.user!.orgId) });
          const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
          
          const pdfBuffer = await renderPdf('training-certificate', {
            recipientName: user?.name || 'Employee',
            moduleTitle: comp.module.title,
            score,
            completedAt: new Date().toISOString(),
            organizationName: org?.name || 'Organization',
            certificateId: payload.certificateId,
          });

          // Mock Document Creation
          const [doc] = await ctx.db.insert(documents).values({
            organizationId: ctx.user!.orgId,
            uploaderId: ctx.user!.id,
            filename: `certificate_${payload.certificateId}.pdf`,
            originalName: `certificate_${payload.certificateId}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: pdfBuffer.length,
            status: 'ready',
            s3Key: `certs/${payload.certificateId}.pdf`
          }).returning();

          if (doc) payload.certificateDocumentId = doc.id;

          // Update user last training timestamp
          await ctx.db.update(users)
            .set({ lastTrainingCompletedAt: new Date() })
            .where(eq(users.id, ctx.user!.id));

        } catch (e) {
          console.error("PDF generation failed:", e);
        }
      }

      const [updated] = await ctx.db.update(trainingCompletions)
        .set(payload)
        .where(eq(trainingCompletions.id, input.completionId)).returning();
      
      return { updated, passed, score };
    }),

  getCertificateBase64: protectedProcedure
    .input(z.object({ completionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // In a real app we fetch from S3 via documents table. 
      // For this mock, we just return a stub or regenerate it to show the flow.
      return { url: 'mock_s3_url' };
    }),

  orgOverview: protectedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const res = await paginatedQuery(
        trainingCompletions,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );

      const compIds = res.data.map((r: any) => r.id);
      if (compIds.length > 0) {
        const fullComps = await ctx.db.query.trainingCompletions.findMany({
          where: inArray(trainingCompletions.id, compIds),
          with: { user: true, module: true }
        });
        const map = new Map(fullComps.map((c: any) => [c.id, c]));
        res.data = res.data.map((r: any) => map.get(r.id) || r);
      }

      return res;
    }),
});
