
import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { leadAssessments } from 'db';
import { eq } from 'drizzle-orm';

import { generateUploadUrl, generateDownloadUrl, getS3ClientForRegion, getS3BucketForOrg } from '../lib/s3.js';
import { Upload } from '@aws-sdk/lib-storage';
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

    // Fetch templates to get true categories and GDPR articles
    const snapshot = Array.isArray(lead.snapshot) ? (lead.snapshot as any[]) : [];
    const { assessmentTemplates } = await import('db');
    const { inArray } = await import('drizzle-orm');
    const questionIds = snapshot.map(s => s.questionId);
    
    let templatesMap = new Map();
    if (questionIds.length > 0) {
      const templates = await db.select().from(assessmentTemplates).where(
        inArray(assessmentTemplates.id, questionIds)
      );
      templates.forEach(t => templatesMap.set(t.id, t));
    }

    const answersWithTemplates = snapshot.map((s: any) => {
      const t = templatesMap.get(s.questionId) || {};
      return {
         questionId: s.questionId,
         selectedOption: s.selectedValue || s.selectedOption,
         riskScore: s.score || s.riskScore || 0,
         category: t.category || 'General',
         questionText: t.questionText || s.questionId,
         gdprArticles: t.gdprArticles || []
      };
    });

    const { buildAssessmentReportData } = await import('../lib/assessmentFormat.js');
    const reportData = buildAssessmentReportData(
      'Your Digital Agency',
      lead.totalScore || 0,
      answersWithTemplates
    );

    const frontendUrl = process.env.FRONTEND_INTERNAL_URL || 'http://localhost:3000';
    const apiKey = process.env.INTERNAL_API_KEY || 'development_key';
    
    console.log(`Calling Vercel API to generate Lead PDF: ${frontendUrl}/api/internal/pdf/assessment`);
    const response = await fetch(`${frontendUrl}/api/internal/pdf/assessment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'INTERNAL_API_KEY': apiKey,
      },
      body: JSON.stringify({ reportData }),
      signal: AbortSignal.timeout(15000), // 15-second timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vercel API returned ${response.status}: ${errText}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    const fileKey = `leads/${leadId}/report_${Date.now()}.pdf`;
    const dataRegion = 'eu-central-1';
    
    const upload = new Upload({
      client: getS3ClientForRegion(dataRegion),
      params: {
        Bucket: getS3BucketForOrg(dataRegion),
        Key: fileKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }
    });

    await upload.done();
    
    // Generate 48-hour presigned URL (48 * 3600 = 172800)
    const downloadUrl = await generateDownloadUrl(fileKey, 'eu-central-1', 7 * 24 * 3600, `Lead_Report_${leadId.split('-')[0]}.pdf`);

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
