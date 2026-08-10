// @ts-nocheck
import React from 'react';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, organizations } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { dataExportQueue } from '../lib/queue.js';
import { renderPdf } from '../lib/pdfClient.js';
import type { ExecutiveReportData } from '../lib/auditTemplates/executiveReport.js';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const exportRouter = router({
  generatePdf: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ 
      type: z.enum(['full_audit', 'client_summary']),
      clientId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      // Fetch org details
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });

      // Fetch ROPA data
      const query = ctx.db.select().from(processingActivities).where(eq(processingActivities.organizationId, ctx.user!.orgId));
      // If client_summary, filter by client (assuming we add a where clause if needed)
      const activities = await query;

      // The template lives in apps/web/src/lib/pdf/templates/ropaRecord.tsx and
      // renders with @react-pdf/renderer, so this process needs no browser.
      try {
        const pdfBuffer = await renderPdf('ropa-record', {
          organizationName: org?.name || 'Organization',
          reportDate: new Date().toLocaleDateString(),
          reportType: input.type,
          activities: activities.map((a: any) => ({
            name: a.name,
            purpose: a.purpose,
            description: a.description,
            lawfulBasis: a.lawfulBasis,
            status: a.status,
            riskLevel: a.riskLevel,
            retentionPeriod: a.retentionPeriod,
            retentionJustification: a.retentionJustification,
            securityMeasures: Array.isArray(a.securityMeasures) ? a.securityMeasures : [],
          })),
        });

        // Still base64 so the frontend can download it directly; uploading to S3
        // and returning a URL remains the intended end state.
        const base64Pdf = pdfBuffer.toString('base64');
        return {
          success: true,
          pdfData: base64Pdf,
          filename: `ropa_audit_${org?.slug || 'export'}_${new Date().getTime()}.pdf`
        };
      } catch (err) {
        console.error('ROPA PDF generation failed:', err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate PDF' });
      }
    }),

  generateAuditZip: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .mutation(async ({ ctx }) => {
      checkOrgContext(ctx.user);

      // Queue the job using the same pattern as dataExport
      await dataExportQueue.add('full-audit-export', {
        organizationId: ctx.user!.orgId,
        requestedBy: ctx.user!.id,
        isFullAudit: true
      });

      return { success: true, message: 'Audit export queued' };
    }),

  generateExecutiveReport: protectedProcedure
    .use(requirePermission('assessments', 'view'))
    .mutation(async ({ ctx }) => {
      checkOrgContext(ctx.user);

      // Fetch org details
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });

      // Gather mock data for the executive report
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const trendData = [];
      let baseScore = 60;
      for (let i = 0; i < 6; i++) {
        const monthIndex = (currentMonth - 5 + i + 12) % 12;
        trendData.push({
          month: months[monthIndex],
          score: Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 10 - 2)))
        });
        baseScore = trendData[trendData.length - 1].score + 2;
      }

      const reportData: ExecutiveReportData = {
        organizationName: org?.name || 'Organization',
        reportDate: new Date().toLocaleDateString(),
        overallScore: trendData[trendData.length - 1].score, // Use latest score
        industryAverage: 58,
        topQuartile: 85,
        trendData,
        topRisks: [
          'High number of unresolved gaps in vendor assessments',
          'Delay in completing employee privacy training',
          'Missing data processing agreements for 2 key vendors'
        ],
        keyAchievements: [
          'Successfully launched new Trust Portal',
          'Completed annual DPIA for core product',
          'Reduced average DSAR response time by 4 days'
        ],
        recommendedActions: [
          'Prioritize vendor reassessments for critical suppliers',
          'Schedule targeted training follow-ups for non-compliant departments',
          'Review and update data retention policies for legacy systems'
        ]
      };

      try {
        const pdfBuffer = await renderPdf('executive', reportData);
        const base64Pdf = pdfBuffer.toString('base64');
        return {
          success: true,
          pdfData: base64Pdf,
          filename: `executive_report_${org?.slug || 'export'}_${new Date().getTime()}.pdf`
        };
      } catch (err) {
        console.error('Executive report PDF generation failed:', err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate PDF' });
      }
    }),

  generateAssessmentReportPdf: protectedProcedure
    .use(requirePermission('assessments', 'view'))
    .input(z.object({
      assessmentId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const { assessmentId } = input;
      const orgId = ctx.user!.orgId;

      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });

      const { assessments, assessmentAnswers, assessmentTemplates, auditLogs } = await import('db');
      
      let [foundAssessment] = await ctx.db.select().from(assessments)
        .where(and(eq(assessments.id, assessmentId), eq(assessments.organizationId, orgId)));
        
      let isLead = false;
      let foundLead: any = null;

      if (!foundAssessment) {
        const { leadAssessments } = await import('db');
        const [lead] = await ctx.db.select().from(leadAssessments)
          .where(eq(leadAssessments.id, assessmentId));
        if (lead) {
          isLead = true;
          foundLead = lead;
        } else {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Assessment not found' });
        }
      }

      let answersWithTemplates: any[] = [];
      
      if (isLead) {
        const snapshot = Array.isArray(foundLead.snapshot) ? (foundLead.snapshot as any[]) : [];
        const { inArray } = await import('drizzle-orm');
        const questionIds = snapshot.map(s => s.questionId);
        
        let templatesMap = new Map();
        if (questionIds.length > 0) {
          const templates = await ctx.db.select().from(assessmentTemplates).where(
            inArray(assessmentTemplates.id, questionIds)
          );
          templates.forEach(t => templatesMap.set(t.id, t));
        }

        answersWithTemplates = snapshot.map((s: any) => {
          const t = templatesMap.get(s.questionId) || {};
          return {
             questionId: s.questionId,
             selectedOption: s.selectedValue || s.selectedOption,
             riskScore: s.score || s.riskScore || 0,
             category: t.category || 'General',
             questionText: t.questionText || s.questionId,
             gdprArticles: t.gdprArticles || [],
             dependsOn: t.dependsOn,
             remediationGuidance: t.remediationGuidance
          };
        });
      } else {
        answersWithTemplates = await ctx.db.select({
            questionId: assessmentAnswers.questionId,
            selectedOption: assessmentAnswers.selectedOption,
            riskScore: assessmentAnswers.riskScore,
            category: assessmentTemplates.category,
            questionText: assessmentTemplates.questionText,
            gdprArticles: assessmentTemplates.gdprArticles,
            dependsOn: assessmentTemplates.dependsOn,
            remediationGuidance: assessmentTemplates.remediationGuidance
        })
        .from(assessmentAnswers)
        .innerJoin(assessmentTemplates, eq(assessmentAnswers.questionId, assessmentTemplates.id))
        .where(eq(assessmentAnswers.assessmentId, assessmentId));
      }

      const { buildAssessmentReportData } = await import('../lib/assessmentFormat.js');
      const reportData = buildAssessmentReportData(
        org?.name || 'Organization',
        isLead ? (foundLead.totalScore || 0) : (foundAssessment?.overallScore || 0),
        answersWithTemplates
      );

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await renderPdf('assessment', reportData, { timeoutMs: 15000 });
      } catch (err) {
        console.error('Assessment PDF generation failed:', err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate PDF' });
      }
      
      await ctx.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: ctx.user!.id,
        action: 'pdf.download',
        resourceType: 'assessment',
        resourceId: assessmentId,
        description: 'Downloaded Assessment Report PDF',
        metadata: { assessmentId }
      });
      
      const base64Pdf = pdfBuffer.toString('base64');

      return { 
        success: true, 
        pdfData: base64Pdf,
        filename: `Assessment_Report_${assessmentId.split('-')[0]}.pdf` 
      };
    }),
});
