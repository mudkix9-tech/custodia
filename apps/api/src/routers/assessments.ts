import { z } from 'zod';
import { db } from '../db.js';
import { assessmentTemplates, assessments, assessmentAnswers, actionItems, pendingSignups } from 'db';
import { eq } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc.js';
import { scheduleEmailSequence } from '../workers/emails.js';

export const assessmentsRouter = router({
  getQuestions: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(assessmentTemplates);
  }),

  startAssessment: publicProcedure.mutation(async ({ ctx }) => {
    const anonSessionId = (ctx.req as any).cookies?.pvr_anon_session;
    const [assessment] = await ctx.db.insert(assessments).values({
      status: 'in_progress',
      anonymousSessionId: anonSessionId || null,
    }).returning();
    return assessment;
  }),

  resumeAssessment: publicProcedure.query(async ({ ctx }) => {
    const anonSessionId = (ctx.req as any).cookies?.pvr_anon_session;
    if (!anonSessionId) return null;

    const assessment = await ctx.db.query.assessments.findFirst({
      where: eq(assessments.anonymousSessionId, anonSessionId),
      orderBy: (assessments: any, { desc }: any) => [desc(assessments.createdAt)],
    });

    if (!assessment) return null;

    const answersList = await ctx.db.select().from(assessmentAnswers).where(eq(assessmentAnswers.assessmentId, assessment.id));
    
    // Convert to map for frontend
    const answersMap: Record<string, any> = {};
    answersList.forEach((a: any) => {
      answersMap[a.questionId] = { text: a.selectedOption, riskWeight: a.riskScore };
    });

    return { assessment, answers: answersMap };
  }),

  submitAnswer: publicProcedure
    .input(z.object({
      assessmentId: z.string().uuid(),
      questionId: z.string().uuid(),
      selectedOption: z.string(),
      riskScore: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [answer] = await ctx.db.insert(assessmentAnswers).values({
        assessmentId: input.assessmentId,
        questionId: input.questionId,
        selectedOption: input.selectedOption,
        riskScore: input.riskScore,
      }).returning();
      return answer;
    }),

  calculateResults: publicProcedure
    .input(z.object({
      assessmentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch all answers for this assessment
      const answers = await ctx.db.select().from(assessmentAnswers).where(eq(assessmentAnswers.assessmentId, input.assessmentId));
      
      // 2. Calculate overall score (0 to 100)
      // Maximum possible risk per question is 10.
      const totalPossibleRisk = answers.length * 10;
      const actualRisk = answers.reduce((acc: number, curr: any) => acc + curr.riskScore, 0);
      
      // If actualRisk is 0, score is 100%. If actualRisk is max, score is 0%.
      let score = 100;
      if (totalPossibleRisk > 0) {
         score = Math.round(100 - ((actualRisk / totalPossibleRisk) * 100));
      }

      // 3. Mark assessment as completed (expires in 30 days for free users)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await ctx.db.update(assessments)
        .set({ status: 'calculated', completedAt: new Date(), overallScore: score, expiresAt })
        .where(eq(assessments.id, input.assessmentId));

      // 4. Clear old action items if any (idempotency)
      await ctx.db.delete(actionItems).where(eq(actionItems.assessmentId, input.assessmentId));

      // 5. Generate Action Items based on risk scores
      for (const ans of answers) {
        if (ans.riskScore >= 5) {
          // Fetch the question to determine the article reference and title
          const [question] = await ctx.db.select().from(assessmentTemplates).where(eq(assessmentTemplates.id, ans.questionId));
          
          if (question) {
            let gdprRef = 'Article 5 (Principles relating to processing of personal data)';
            let title = `Address risk in ${question.category}`;
            let desc = `You answered "${ans.selectedOption}" to the question: "${question.questionText}". This poses a significant GDPR compliance risk.`;

            // Simple mapping for demonstration. In production, this would be a JSON map in the DB.
            if (question.category === 'Vendor Management') gdprRef = 'Article 28 (Processor)';
            if (question.category === 'Data Subject Rights') gdprRef = 'Articles 15-22 (Rights of the data subject)';
            if (question.category === 'Security') gdprRef = 'Article 32 (Security of processing)';
            if (question.category === 'Lawful Basis') gdprRef = 'Article 6 (Lawfulness of processing)';

            await ctx.db.insert(actionItems).values({
              assessmentId: input.assessmentId,
              title: title,
              description: desc,
              gdprArticleReference: gdprRef,
              priority: ans.riskScore >= 8 ? 'High' : 'Medium',
            });
          }
        }
      }

      return { score, status: 'calculated' };
    }),

  captureEmail: publicProcedure
    .input(z.object({
      assessmentId: z.string().uuid(),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const anonSessionId = (ctx.req as any).cookies?.pvr_anon_session || null;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await ctx.db.insert(pendingSignups).values({
        email: input.email,
        anonymousSessionId: anonSessionId,
        assessmentId: input.assessmentId,
        expiresAt: expiresAt,
      });

      await ctx.db.update(assessments)
        .set({ status: 'completed', email: input.email })
        .where(eq(assessments.id, input.assessmentId));
        
      // Schedule the BullMQ Email Sequence
      await scheduleEmailSequence(input.assessmentId, input.email).catch(console.error);
        
      return { success: true };
    }),

  getResults: publicProcedure
    .input(z.object({ assessmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [assessment] = await ctx.db.select().from(assessments).where(eq(assessments.id, input.assessmentId));
      const items = await ctx.db.select().from(actionItems).where(eq(actionItems.assessmentId, input.assessmentId));
      
      return { assessment, actionItems: items };
    }),
});
