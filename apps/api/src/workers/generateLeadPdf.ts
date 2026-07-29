import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { leadAssessments } from 'db';
import { eq } from 'drizzle-orm';
import { generateAssessmentReportHtml } from '../lib/auditTemplates/assessmentReport.js';
import { renderHtmlToPdf } from '../lib/browserPool.js';
import { generateUploadUrl, generateDownloadUrl } from '../lib/s3.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export const generateLeadPdfWorker = createWorker('generate-lead-pdf', async (job: any) => {
  const { leadId, email } = job.data;
  console.log(`[Worker] Generating Lead PDF for leadId: ${leadId}, email: ${email}`);

  try {
    const [lead] = await db.select().from(leadAssessments).where(eq(leadAssessments.id, leadId));
    
    if (!lead || !lead.snapshot) {
      throw new Error(`Lead or snapshot not found for leadId: ${leadId}`);
    }

    // Process snapshot into ReportData format
    const snapshot = lead.snapshot as any[];
    
    const actionItems = snapshot
      .filter(s => s.riskScore > 0)
      .map(s => ({
        title: `Address risk regarding: ${s.questionId}`,
        description: `Your answer "${s.selectedOption}" indicates a compliance gap.`,
        severity: s.riskScore > 5 ? 'High' : 'Medium'
      }));

    const reportData = {
      organizationName: 'Your Digital Agency',
      reportDate: new Date().toLocaleDateString(),
      overallScore: lead.totalScore || 0,
      riskLevel: lead.riskLevel || 'Medium',
      answers: snapshot.map(s => ({
        questionText: s.questionId, // Snapshot contains questionId or text
        selectedOption: s.selectedOption,
        riskScore: s.riskScore
      })),
      actionItems
    };

    const htmlContent = generateAssessmentReportHtml(reportData);

    const pdfBuffer = await renderHtmlToPdf(htmlContent, {
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%; color: #78716c;">Privaro OS - Assessment Report</div>'
    });

    const fileKey = `leads/${leadId}/report_${Date.now()}.pdf`;
    const uploadUrl = await generateUploadUrl(fileKey, 'application/pdf', 'eu-west-1');
    
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: pdfBuffer as any,
      headers: { 'Content-Type': 'application/pdf' }
    });
    
    if (!res.ok) throw new Error('Failed to upload Lead PDF to S3');
    
    // Generate 48-hour presigned URL (48 * 3600 = 172800)
    const downloadUrl = await generateDownloadUrl(fileKey, 'eu-west-1', 172800);

    await resend.emails.send({
      from: 'Privaro <hello@privaro.com>',
      to: email,
      subject: 'Your GDPR Gap Assessment Report',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your GDPR Gap Assessment Report is ready</h2>
          <p>Thank you for completing the GDPR Gap Assessment. Your detailed report has been generated.</p>
          <p>You can download it securely using the link below (valid for 48 hours):</p>
          <div style="margin: 30px 0;">
            <a href="${downloadUrl}" style="background-color: #294036; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download PDF Report</a>
          </div>
          <p>If you have any questions, feel free to reply to this email.</p>
        </div>
      `,
    });

    console.log(`[Worker] Successfully generated and emailed Lead PDF for leadId: ${leadId}`);
  } catch (err) {
    console.error(`[Worker] Failed to generate Lead PDF for leadId: ${leadId}`, err);
    throw err;
  }
});
