// @ts-nocheck
import React from 'react';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, organizations } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { dataExportQueue } from '../lib/queue.js';
import { renderHtmlToPdf } from '../lib/browserPool.js';
import { generateExecutiveReportHtml, ExecutiveReportData } from '../lib/auditTemplates/executiveReport.js';

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

      // 1. Generate HTML string
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1c1917; line-height: 1.6; }
            h1 { color: #294036; border-bottom: 2px solid #294036; padding-bottom: 8px; }
            h2 { color: #294036; margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #e7e5e4; padding: 8px 12px; text-align: left; }
            th { background-color: #f5f5f4; font-weight: 600; }
            .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
            .page-break { page-break-before: always; }
            .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #78716c; padding: 10px 0; border-top: 1px solid #e7e5e4; }
          </style>
        </head>
        <body>
          <div class="cover">
            <h1>Record of Processing Activities (Article 30 GDPR)</h1>
            <h2>${org?.name || 'Organization'}</h2>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Report Type: ${input.type === 'full_audit' ? 'Full Audit Report' : 'Client Summary'}</p>
          </div>
          
          <div class="page-break"></div>

          <h2>Processing Activities Inventory</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Lawful Basis</th>
                <th>Status</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${activities.map((a: any) => `
                <tr>
                  <td><strong>${a.name}</strong></td>
                  <td>${a.purpose}</td>
                  <td>${a.lawfulBasis || 'N/A'}</td>
                  <td>${a.status}</td>
                  <td>${a.riskLevel}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="page-break"></div>
          <h2>Detailed Activity Records</h2>
          ${activities.map((a: any) => `
            <div style="margin-bottom: 32px; border: 1px solid #e7e5e4; padding: 16px; border-radius: 8px;">
              <h3 style="margin-top: 0;">${a.name}</h3>
              <p><strong>Purpose:</strong> ${a.purpose}</p>
              <p><strong>Description:</strong> ${a.description || 'None'}</p>
              <p><strong>Lawful Basis:</strong> ${a.lawfulBasis || 'N/A'}</p>
              <p><strong>Retention Period:</strong> ${a.retentionPeriod || 'Not specified'} - ${a.retentionJustification || ''}</p>
              <p><strong>Security Measures:</strong> ${(Array.isArray(a.securityMeasures) ? a.securityMeasures : []).join(', ') || 'None specified'}</p>
            </div>
          `).join('')}
          
        </body>
        </html>
      `;

      // 2. Launch Puppeteer and generate PDF
      try {
        const pdfBuffer = await renderHtmlToPdf(htmlContent, {
          margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Privaro OS - Generated securely</div>'
        });

        // Normally, we would upload this to S3 and return a URL.
        // For now, we return it as a base64 string so the frontend can download it.
        const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
        return { 
          success: true, 
          pdfData: base64Pdf,
          filename: `ropa_audit_${org?.slug || 'export'}_${new Date().getTime()}.pdf`
        };
      } catch (err) {
        console.error("Puppeteer PDF generation failed:", err);
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

      const htmlContent = generateExecutiveReportHtml(reportData);

      try {
        const pdfBuffer = await renderHtmlToPdf(htmlContent, {
          margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%; color: #78716c;">Privaro OS - Executive Summary Report</div>'
        });

        const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
        return {
          success: true,
          pdfData: base64Pdf,
          filename: `executive_report_${org?.slug || 'export'}_${new Date().getTime()}.pdf`
        };
      } catch (err) {
        console.error("Puppeteer PDF generation failed:", err);
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
      
      const { AssessmentReport } = await import('../lib/auditTemplates/assessmentReport.js');
      const { renderReactToPdfStream } = await import('../lib/pdfRenderer.js');
      const { generateDownloadUrl, getS3ClientForRegion, getS3BucketForOrg } = await import('../lib/s3.js');
      const { assessments, assessmentAnswers, actionItems, auditLogs, organizations } = await import('db');
      
      // 1. Fetch data
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });
      
      let assessment = undefined;
      let answers: any[] = [];
      let items: any[] = [];
      
      const [foundAssessment] = await ctx.db.select().from(assessments)
        .where(and(eq(assessments.id, input.assessmentId), eq(assessments.organizationId, ctx.user!.orgId)));
        
      if (foundAssessment) {
        assessment = foundAssessment;
        answers = await ctx.db.select().from(assessmentAnswers).where(eq(assessmentAnswers.assessmentId, input.assessmentId));
        items = await ctx.db.select().from(actionItems).where(eq(actionItems.assessmentId, input.assessmentId));
      } else {
        const { leadAssessments } = await import('db');
        const [lead] = await ctx.db.select().from(leadAssessments).where(eq(leadAssessments.id, input.assessmentId));
        
        // Ensure they either converted it to their org, or they just happen to be logged in and requesting it
        if (!lead || (lead.convertedToOrgId && lead.convertedToOrgId !== ctx.user!.orgId)) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Assessment not found' });
        }
        
        assessment = {
          overallScore: lead.totalScore
        };
        
        const snapshot = Array.isArray(lead.snapshot) ? lead.snapshot : [];
        answers = snapshot.map((s: any) => ({
           questionId: s.questionId,
           selectedOption: s.selectedValue || s.selectedOption,
           riskScore: s.score || s.riskScore
        }));
        
        items = snapshot.filter((s: any) => (s.score || s.riskScore) > 0).map((s: any) => ({
           title: `Address risk regarding: ${s.questionId}`,
           description: `Your answer "${s.selectedValue || s.selectedOption}" indicates a compliance gap.`,
           severity: (s.score || s.riskScore) > 5 ? 'High' : 'Medium'
        }));
      }
      
      const reportData = {
        organizationName: org?.name || 'Organization',
        reportDate: new Date().toLocaleDateString(),
        overallScore: assessment.overallScore || 0,
        riskLevel: (assessment.overallScore || 0) < 50 ? 'High' : (assessment.overallScore || 0) <= 75 ? 'Medium' : 'Low',
        answers: answers.map(a => ({
          questionText: a.questionId,
          selectedOption: a.selectedOption,
          riskScore: a.riskScore
        })),
        actionItems: items.map(i => ({
          title: i.title,
          description: i.description || '',
          severity: i.severity
        }))
      };
      
      try {
        const element = React.createElement(AssessmentReport, { data: reportData });
        const pdfStream = await renderReactToPdfStream(element);
        
        const fileKey = `assessments/${ctx.user!.orgId}/${input.assessmentId}/report_${Date.now()}.pdf`;
        const dataRegion = org?.dataRegion || 'eu-central-1';
        
        const { Upload } = await import('@aws-sdk/lib-storage');
        const abortController = new AbortController();
        
        // Listen to stream errors to abort the AWS S3 multipart upload
        pdfStream.on('error', (err) => {
          console.error("PDF generation stream emitted error:", err);
          abortController.abort(err);
        });

        const upload = new Upload({
          client: getS3ClientForRegion(dataRegion),
          params: {
            Bucket: getS3BucketForOrg(dataRegion),
            Key: fileKey,
            Body: pdfStream,
            ContentType: 'application/pdf',
          },
          abortController
        });

        // If the stream aborts, the upload will throw here
        await upload.done();
        
        await ctx.db.insert(auditLogs).values({
          action: 'assessment_report_exported',
          description: 'Exported assessment report PDF',
          organizationId: ctx.user!.orgId,
          userId: ctx.user!.id,
          newValue: { assessmentId: input.assessmentId }
        });
        
        const downloadUrl = await generateDownloadUrl(fileKey, org?.dataRegion || 'eu-central-1', 3600, `Assessment_Report_${input.assessmentId.split('-')[0]}.pdf`);
        return { success: true, url: downloadUrl };
      } catch (err) {
        console.error("Failed to generate/upload Assessment PDF:", err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate PDF' });
      }
    }),
});
