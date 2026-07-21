import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
import { 
  vendorAssessmentTemplates, 
  vendorAssessments, 
  organizationVendors, 
  users, 
  organizations, 
  vendors,
  assessmentTemplates,
  assessments,
  assessmentAnswers,
  actionItems,
  pendingSignups
} from 'db';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';
import React from 'react';
import { GoogleGenAI } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';
import { sendEmail, AssessmentInvitation, AssessmentReminder } from 'emails';
import { updateVendorRiskScore } from './vendors.js';
import { scheduleEmailSequence } from '../workers/emails.js';
import { trackAiUsage } from '../lib/billing.js';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'privaro',
  location: process.env.GCP_LOCATION || 'us-central1',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'mock-key',
});

const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.string(),
  type: z.enum(['choice', 'text']),
  options: z.array(z.object({
    text: z.string(),
    score: z.number()
  }))
});

export const assessmentsRouter = router({
  // ============================================================================
  // ORIGINAL GAP ASSESSMENT PROCEDURES
  // ============================================================================
  getQuestions: publicProcedure.query(async ({ ctx }) => {
    return await db.select().from(assessmentTemplates);
  }),

  startAssessment: publicProcedure.mutation(async ({ ctx }) => {
    const anonSessionId = (ctx.req as any).cookies?.pvr_anon_session;
    const [assessment] = await db.insert(assessments).values({
      status: 'in_progress',
      anonymousSessionId: anonSessionId || null,
    }).returning();
    return assessment;
  }),

  resumeAssessment: publicProcedure.query(async ({ ctx }) => {
    const anonSessionId = (ctx.req as any).cookies?.pvr_anon_session;
    if (!anonSessionId) return null;

    const assessment = await db.query.assessments.findFirst({
      where: eq(assessments.anonymousSessionId, anonSessionId),
      orderBy: (assessments: any, { desc }: any) => [desc(assessments.createdAt)],
    });

    if (!assessment) return null;

    const answersList = await db.select().from(assessmentAnswers).where(eq(assessmentAnswers.assessmentId, assessment.id));
    
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
      const [answer] = await db.insert(assessmentAnswers).values({
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
      const answers = await db.select().from(assessmentAnswers).where(eq(assessmentAnswers.assessmentId, input.assessmentId));
      
      const totalPossibleRisk = answers.length * 10;
      const actualRisk = answers.reduce((acc: number, curr: any) => acc + curr.riskScore, 0);
      
      let score = 100;
      if (totalPossibleRisk > 0) {
         score = Math.round(100 - ((actualRisk / totalPossibleRisk) * 100));
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await db.update(assessments)
        .set({ status: 'calculated', completedAt: new Date(), overallScore: score, expiresAt })
        .where(eq(assessments.id, input.assessmentId));

      await db.delete(actionItems).where(eq(actionItems.assessmentId, input.assessmentId));

      for (const ans of answers) {
        if (ans.riskScore >= 5) {
          const [question] = await db.select().from(assessmentTemplates).where(eq(assessmentTemplates.id, ans.questionId));
          
          if (question) {
            let gdprRef = 'Article 5 (Principles relating to processing of personal data)';
            let title = `Address risk in ${question.category}`;
            let desc = `You answered "${ans.selectedOption}" to the question: "${question.questionText}". This poses a significant GDPR compliance risk.`;

            if (question.category === 'Vendor Management') gdprRef = 'Article 28 (Processor)';
            if (question.category === 'Data Subject Rights') gdprRef = 'Articles 15-22 (Rights of the data subject)';
            if (question.category === 'Security') gdprRef = 'Article 32 (Security of processing)';
            if (question.category === 'Lawful Basis') gdprRef = 'Article 6 (Lawfulness of processing)';

            await db.insert(actionItems).values({
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

      await db.insert(pendingSignups).values({
        email: input.email,
        anonymousSessionId: anonSessionId,
        assessmentId: input.assessmentId,
        expiresAt: expiresAt,
      });

      await db.update(assessments)
        .set({ status: 'completed', email: input.email })
        .where(eq(assessments.id, input.assessmentId));
        
      await scheduleEmailSequence(input.assessmentId, input.email).catch(console.error);
        
      return { success: true };
    }),

  getResults: publicProcedure
    .input(z.object({ assessmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [assessment] = await db.select().from(assessments).where(eq(assessments.id, input.assessmentId));
      const items = await db.select().from(actionItems).where(eq(actionItems.assessmentId, input.assessmentId));
      
      return { assessment, actionItems: items };
    }),

  // ============================================================================
  // VENDOR COMPLIANCE QUESTIONNAIRES PROCEDURES (PHASE 7)
  // ============================================================================
  getTemplates: protectedProcedure.query(async ({ ctx }) => {
    return await db.select()
      .from(vendorAssessmentTemplates)
      .where(
        eq(vendorAssessmentTemplates.organizationId, ctx.user.orgId)
      )
      .orderBy(desc(vendorAssessmentTemplates.createdAt));
  }),

  getSystemTemplates: publicProcedure.query(async () => {
    return await db.select()
      .from(vendorAssessmentTemplates)
      .orderBy(desc(vendorAssessmentTemplates.createdAt));
  }),

  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      questions: z.array(questionSchema)
    }))
    .mutation(async ({ ctx, input }) => {
      const [newTemplate] = await db.insert(vendorAssessmentTemplates)
        .values({
          organizationId: ctx.user.orgId,
          name: input.name,
          description: input.description || null,
          questions: input.questions,
          isDefault: false
        })
        .returning();
      return newTemplate;
    }),

  getAssessments: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().default(0),
      status: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vendorAssessments.organizationId, ctx.user.orgId)];
      if (input.status) {
        conditions.push(eq(vendorAssessments.status, input.status));
      }

      const items = await db.select({
        assessment: vendorAssessments,
        vendorName: vendors.name,
        template: vendorAssessmentTemplates
      })
      .from(vendorAssessments)
      .innerJoin(organizationVendors, eq(vendorAssessments.vendorId, organizationVendors.id))
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .innerJoin(vendorAssessmentTemplates, eq(vendorAssessments.templateId, vendorAssessmentTemplates.id))
      .where(and(...conditions))
      .limit(input.limit)
      .offset(input.offset)
      .orderBy(desc(vendorAssessments.sentAt));

      return items;
    }),

  getVendorAssessments: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      return await db.select({
        assessment: vendorAssessments,
        template: vendorAssessmentTemplates
      })
      .from(vendorAssessments)
      .innerJoin(vendorAssessmentTemplates, eq(vendorAssessments.templateId, vendorAssessmentTemplates.id))
      .where(
        and(
          eq(vendorAssessments.organizationId, ctx.user.orgId),
          eq(vendorAssessments.vendorId, input.vendorId)
        )
      )
      .orderBy(desc(vendorAssessments.sentAt));
    }),

  sendAssessment: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      templateId: z.string().uuid(),
      recipientEmail: z.string().email(),
      recipientName: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [template] = await db.select()
        .from(vendorAssessmentTemplates)
        .where(eq(vendorAssessmentTemplates.id, input.templateId));
      
      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Assessment template not found'
        });
      }

      const [orgVendor] = await db.select({
        vendorName: vendors.name
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(
        and(
          eq(organizationVendors.organizationId, ctx.user.orgId),
          eq(organizationVendors.id, input.vendorId)
        )
      );

      if (!orgVendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        });
      }

      const [org] = await db.select({
        name: organizations.name
      })
      .from(organizations)
      .where(eq(organizations.id, ctx.user.orgId));

      const accessToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const [assessment] = await db.insert(vendorAssessments)
        .values({
          organizationId: ctx.user.orgId,
          vendorId: input.vendorId,
          templateId: input.templateId,
          status: 'sent',
          sentAt: new Date(),
          expiresAt,
          recipientEmail: input.recipientEmail,
          recipientName: input.recipientName || null,
          accessToken,
          questionsSnapshot: template.questions,
          responses: {},
          score: null,
          submissionLocked: false
        })
        .returning();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const linkUrl = `${frontendUrl}/public/assessments/${accessToken}`;
      const expiresStr = expiresAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      try {
        await sendEmail({
          to: [input.recipientEmail],
          subject: `Security & GDPR Compliance Assessment Request from ${org?.name || 'Acme Corp'}`,
          template: React.createElement(AssessmentInvitation, {
            orgName: org?.name || 'Acme Corp',
            vendorName: orgVendor.vendorName || 'Vendor',
            recipientName: input.recipientName || 'Security Lead',
            url: linkUrl,
            expiresAt: expiresStr
          })
        });
      } catch (err: any) {
        console.error('Failed to send assessment invitation email:', err.message);
      }

      return assessment;
    }),

  getAssessmentByToken: publicProcedure
    .input(z.object({
      token: z.string()
    }))
    .query(async ({ input }) => {
      const [record] = await db.select({
        assessment: vendorAssessments,
        orgName: organizations.name,
        vendorName: vendors.name
      })
      .from(vendorAssessments)
      .innerJoin(organizations, eq(vendorAssessments.organizationId, organizations.id))
      .innerJoin(organizationVendors, eq(vendorAssessments.vendorId, organizationVendors.id))
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(eq(vendorAssessments.accessToken, input.token));

      if (!record) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid assessment token.'
        });
      }

      return record;
    }),

  submitAssessmentResponses: publicProcedure
    .input(z.object({
      token: z.string(),
      responses: z.record(z.string()),
      respondentEmail: z.string().email(),
      respondentIp: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const [record] = await db.select()
        .from(vendorAssessments)
        .where(eq(vendorAssessments.accessToken, input.token));

      if (!record) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid assessment token.'
        });
      }

      if (record.status === 'completed' || record.submissionLocked) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'This assessment has already been completed and locked.'
        });
      }

      if (record.status === 'expired') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'This assessment invitation has expired.'
        });
      }

      const questions = (record.questionsSnapshot || []) as any[];
      let earnedPoints = 0;
      let maxPoints = 0;

      for (const q of questions) {
        const answer = input.responses[q.id];
        const maxQScore = Math.max(...(q.options || []).map((o: any) => o.score || 0));
        maxPoints += maxQScore;

        if (answer) {
          const selected = (q.options || []).find((o: any) => o.text === answer);
          if (selected) {
            earnedPoints += selected.score || 0;
          }
        }
      }

      const baseScore = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;

      const prompt = `You are a professional GDPR auditor evaluating a vendor's privacy and security questionnaire responses.
Here are the questionnaire questions and the vendor's answers:
${questions.map((q: any) => `Question: ${q.text}
Category: ${q.category}
Answer: ${input.responses[q.id] || 'Not answered'}`).join('\n\n')}

Analyze their responses and identify any GDPR compliance gaps, security risks, or concerning practices (such as lack of encryption at rest, data transfers to non-adequate countries without safeguards, or lack of breach notification commitments).

You must return a JSON response with the following format:
{
  "scoreAdjustment": <number between -20 and 0 depending on the severity of gaps: 0 for no extra risk, -5 for minor gaps, -15 for major gaps, -20 for critical security failures>,
  "aiSummary": "<a concise 2-3 sentence summary of the security/privacy gaps identified, or stating that the practices are solid if no gaps are found>"
}
Only return valid JSON, nothing else.`;

      let scoreAdjustment = 0;
      let aiSummary = "Assessment completed. AI evaluation completed successfully.";

      try {
        await trackAiUsage(record.organizationId, 1);

        let responseText = "";
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'mock-key') {
          const msg = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 500,
            system: "You are a GDPR audit assistant. Always return raw JSON.",
            messages: [{ role: 'user', content: prompt }]
          });
          responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
        } else {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          responseText = response.text || "";
        }

        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = responseText.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonStr);
          if (typeof parsed.scoreAdjustment === 'number') {
            scoreAdjustment = Math.max(-20, Math.min(0, Math.round(parsed.scoreAdjustment)));
          }
          if (typeof parsed.aiSummary === 'string') {
            aiSummary = parsed.aiSummary.trim();
          }
        }
      } catch (err: any) {
        console.warn("AI analysis failed, using rule-based fallback:", err.message);
        let penalty = 0;
        if (input.responses['q_encryption_transit'] === 'No') penalty -= 5;
        if (input.responses['q_encryption_rest'] === 'No') penalty -= 5;
        if (input.responses['q_incident_response'] === 'No formal breach notification timelines') penalty -= 10;
        scoreAdjustment = Math.max(-20, penalty);
        aiSummary = `Assessment reviewed with default rule-based checks. Gaps identified: ${
          penalty < 0 ? 'Critical security elements (encryption/incident notification) are missing or non-compliant.' : 'No major security gaps detected by rule checks.'
        }`;
      }

      const [updated] = await db.update(vendorAssessments)
        .set({
          status: 'completed',
          completedAt: new Date(),
          responses: input.responses,
          score: baseScore,
          aiSummary,
          scoreAdjustment,
          respondentEmail: input.respondentEmail,
          respondentIp: input.respondentIp || null,
          submissionLocked: true
        })
        .where(eq(vendorAssessments.id, record.id))
        .returning();

      const [orgVendor] = await db.select({
        vendorId: organizationVendors.vendorId
      })
      .from(organizationVendors)
      .where(eq(organizationVendors.id, record.vendorId));

      if (orgVendor) {
        await updateVendorRiskScore(db, record.organizationId, orgVendor.vendorId);
      }

      return updated;
    }),

  reviewAssessment: protectedProcedure
    .input(z.object({
      assessmentId: z.string().uuid(),
      scoreAdjustment: z.number().min(-50).max(50),
      aiSummary: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [assessment] = await db.select()
        .from(vendorAssessments)
        .where(
          and(
            eq(vendorAssessments.id, input.assessmentId),
            eq(vendorAssessments.organizationId, ctx.user.orgId)
          )
        );

      if (!assessment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Assessment not found.'
        });
      }

      const [updated] = await db.update(vendorAssessments)
        .set({
          scoreAdjustment: input.scoreAdjustment,
          aiSummary: input.aiSummary || assessment.aiSummary,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        })
        .where(eq(vendorAssessments.id, input.assessmentId))
        .returning();

      const [orgVendor] = await db.select({
        vendorId: organizationVendors.vendorId
      })
      .from(organizationVendors)
      .where(eq(organizationVendors.id, assessment.vendorId));

      if (orgVendor) {
        await updateVendorRiskScore(db, assessment.organizationId, orgVendor.vendorId);
      }

      return updated;
    })
});
