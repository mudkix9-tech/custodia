import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { trainingModules, trainingCompletions, users, documents, organizations } from 'db';
import { eq, and, desc, inArray, isNull, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import puppeteer from 'puppeteer';
import crypto from 'crypto';

// Helpers
const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const trainingRouter = router({
  // MODULES
  listModules: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    // Return both global modules and org-specific modules
    return db.select().from(trainingModules)
      .where(or(
        eq(trainingModules.isGlobal, true),
        eq(trainingModules.organizationId, ctx.user!.orgId)
      ))
      .orderBy(desc(trainingModules.createdAt));
  }),

  getModule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const mod = await db.query.trainingModules.findFirst({
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
      const [newMod] = await db.insert(trainingModules).values({
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
      const [updated] = await db.update(trainingModules)
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
      const [updated] = await db.update(trainingModules)
        .set({ status: 'published', updatedAt: new Date() })
        .where(and(
          eq(trainingModules.id, input.id),
          eq(trainingModules.organizationId, ctx.user!.orgId)
        ))
        .returning();
      
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      // Auto-assign to existing users if mandatory
      if (updated.isMandatory) {
        const orgUsers = await db.query.users.findMany({
          where: eq(users.organizationId, ctx.user!.orgId)
        });
        
        const existingCompletions = await db.query.trainingCompletions.findMany({
          where: eq(trainingCompletions.moduleId, input.id)
        });
        const existingUserIds = existingCompletions.map(c => c.userId);

        const newAssignments = orgUsers
          .filter(u => !existingUserIds.includes(u.id))
          .map(u => ({
            organizationId: ctx.user!.orgId,
            userId: u.id,
            moduleId: input.id,
            status: 'not_started',
          }));

        if (newAssignments.length > 0) {
          await db.insert(trainingCompletions).values(newAssignments);
        }
      }

      return updated;
    }),

  getStats: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const completions = await db.query.trainingCompletions.findMany({
        where: and(
          eq(trainingCompletions.organizationId, ctx.user!.orgId),
          eq(trainingCompletions.moduleId, input.id)
        )
      });
      const passed = completions.filter(c => c.status === 'passed').length;
      return {
        totalAssigned: completions.length,
        passed,
        inProgress: completions.filter(c => c.status === 'in_progress').length,
        notStarted: completions.filter(c => c.status === 'not_started').length,
        averageScore: completions.length > 0 
          ? Math.round(completions.reduce((acc, c) => acc + (c.quizScore || 0), 0) / completions.length)
          : 0
      };
    }),

  // COMPLETIONS (EMPLOYEE)
  myModules: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    const myComps = await db.query.trainingCompletions.findMany({
      where: eq(trainingCompletions.userId, ctx.user!.id),
      with: { module: true },
      orderBy: desc(trainingCompletions.createdAt)
    });

    // Also inject global modules if missing
    const globals = await db.query.trainingModules.findMany({
      where: and(eq(trainingModules.isGlobal, true), eq(trainingModules.status, 'published'))
    });

    for (const g of globals) {
      if (!myComps.find(c => c.moduleId === g.id)) {
        const [newComp] = await db.insert(trainingCompletions).values({
          organizationId: ctx.user!.orgId,
          userId: ctx.user!.id,
          moduleId: g.id,
          status: 'not_started'
        }).returning();
        myComps.push({ ...newComp, module: g } as any);
      }
    }

    return myComps;
  }),

  startModule: protectedProcedure
    .input(z.object({ completionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(trainingCompletions)
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
      const comp = await db.query.trainingCompletions.findFirst({
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

      await db.update(trainingCompletions)
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
      const comp = await db.query.trainingCompletions.findFirst({
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
        payload.certificateId = `CERT-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        
        // Generate PDF
        try {
          const org = await db.query.organizations.findFirst({ where: eq(organizations.id, ctx.user!.orgId) });
          const user = await db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
          
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; border: 10px solid #294036; padding: 50px; margin: 0; height: 100vh; box-sizing: border-box; }
                h1 { color: #294036; font-size: 48px; margin-top: 50px; }
                h2 { color: #57534e; font-weight: normal; margin-bottom: 50px; }
                p { font-size: 20px; color: #1c1917; }
                .name { font-size: 36px; font-weight: bold; color: #294036; text-decoration: underline; margin: 20px 0; }
                .module { font-size: 28px; font-weight: bold; color: #294036; margin: 20px 0; }
                .footer { margin-top: 100px; font-size: 14px; color: #78716c; }
              </style>
            </head>
            <body>
              <h1>Certificate of Completion</h1>
              <h2>GDPR & Data Protection Training</h2>
              <p>This certifies that</p>
              <div class="name">${user?.name || 'Employee'}</div>
              <p>has successfully completed the course</p>
              <div class="module">${comp.module.title}</div>
              <p>Score: ${score}% | Date: ${new Date().toLocaleDateString()}</p>
              <p>Issued by: ${org?.name || 'Organization'}</p>
              <div class="footer">Certificate ID: ${payload.certificateId}</div>
            </body>
            </html>
          `;

          const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
          const page = await browser.newPage();
          await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
          const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
          await browser.close();

          // Mock Document Creation
          const [doc] = await db.insert(documents).values({
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
          await db.update(users)
            .set({ lastTrainingCompletedAt: new Date() })
            .where(eq(users.id, ctx.user!.id));

        } catch (e) {
          console.error("PDF generation failed:", e);
        }
      }

      const [updated] = await db.update(trainingCompletions)
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

  orgOverview: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    const comps = await db.query.trainingCompletions.findMany({
      where: eq(trainingCompletions.organizationId, ctx.user!.orgId),
      with: { user: true, module: true }
    });
    return comps;
  }),
});
