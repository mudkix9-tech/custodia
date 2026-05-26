import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, organizations } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { dataExportQueue } from '../lib/queue.js';
import { renderHtmlToPdf } from '../lib/browserPool.js';

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
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });

      // Fetch ROPA data
      const query = db.select().from(processingActivities).where(eq(processingActivities.organizationId, ctx.user!.orgId));
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
              ${activities.map(a => `
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
          ${activities.map(a => `
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
});
