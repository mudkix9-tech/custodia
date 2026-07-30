import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { assessments, assessmentAnswers, auditLogs, organizations, notificationQueue } from 'db';
import { eq, and } from 'drizzle-orm';
import { generateDownloadUrl, getS3ClientForRegion, getS3BucketForOrg } from '../lib/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { buildAssessmentReportData } from '../lib/assessmentFormat.js';

export const generateAssessmentPdfWorker = createWorker('assessment-pdf', async (job: any) => {
  const { assessmentId, orgId, userId } = job.data;
  console.log(`[Worker] Generating Assessment PDF for assessmentId: ${assessmentId}, orgId: ${orgId}`);

  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId)
    });

    let [foundAssessment] = await db.select().from(assessments)
      .where(and(eq(assessments.id, assessmentId), eq(assessments.organizationId, orgId)));
      
    let isLead = false;
    let foundLead: any = null;

    if (!foundAssessment) {
      const { leadAssessments } = await import('db');
      const [lead] = await db.select().from(leadAssessments)
        .where(eq(leadAssessments.id, assessmentId));
      if (lead) {
        isLead = true;
        foundLead = lead;
      } else {
        throw new Error(`Assessment not found for ID: ${assessmentId}`);
      }
    }

    const { assessmentTemplates } = await import('db');
    let answersWithTemplates: any[] = [];
    
    if (isLead) {
      const snapshot = Array.isArray(foundLead.snapshot) ? (foundLead.snapshot as any[]) : [];
      const { inArray } = await import('drizzle-orm');
      const questionIds = snapshot.map(s => s.questionId);
      
      let templatesMap = new Map();
      if (questionIds.length > 0) {
        const templates = await db.select().from(assessmentTemplates).where(
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
           gdprArticles: t.gdprArticles || []
        };
      });
    } else {
      answersWithTemplates = await db.select({
          questionId: assessmentAnswers.questionId,
          selectedOption: assessmentAnswers.selectedOption,
          riskScore: assessmentAnswers.riskScore,
          category: assessmentTemplates.category,
          questionText: assessmentTemplates.questionText,
          gdprArticles: assessmentTemplates.gdprArticles
      })
      .from(assessmentAnswers)
      .innerJoin(assessmentTemplates, eq(assessmentAnswers.questionId, assessmentTemplates.id))
      .where(eq(assessmentAnswers.assessmentId, assessmentId));
    }

    const reportData = buildAssessmentReportData(
      org?.name || 'Organization',
      isLead ? (foundLead.totalScore || 0) : (foundAssessment.overallScore || 0),
      answersWithTemplates
    );

    // Call Vercel endpoint to render PDF
    const frontendUrl = process.env.FRONTEND_INTERNAL_URL || 'http://localhost:3000';
    const apiKey = process.env.INTERNAL_API_KEY || 'development_key';
    
    console.log(`Calling Vercel API to generate PDF: ${frontendUrl}/api/internal/pdf/assessment`);
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

    // Upload to S3
    const fileKey = `assessments/${orgId}/${assessmentId}/report_${Date.now()}.pdf`;
    const dataRegion = org?.dataRegion || 'eu-central-1';
    
    const s3Client = getS3ClientForRegion(dataRegion);
    await s3Client.send(new PutObjectCommand({
      Bucket: getS3BucketForOrg(dataRegion),
      Key: fileKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf'
    }));
    
    await db.insert(auditLogs).values({
      action: 'assessment_report_exported',
      description: 'Exported assessment report PDF',
      organizationId: orgId,
      userId: userId,
      metadata: { assessmentId }
    });
    
    const downloadUrl = await generateDownloadUrl(fileKey, dataRegion, 3600 * 24 * 7, `Assessment_Report_${assessmentId.split('-')[0]}.pdf`);
    
    // Send notification
    await db.insert(notificationQueue).values({
      organizationId: orgId,
      userId: userId,
      type: 'assessment.report_ready',
      title: 'Your Assessment Report is ready',
      body: 'Your assessment report PDF has been generated and is ready for download.',
      payload: { url: downloadUrl },
      channel: 'email',
    });

    console.log(`[Worker] Successfully generated and uploaded Assessment PDF for assessmentId: ${assessmentId}`);
  } catch (err) {
    console.error(`[Worker] Failed to generate Assessment PDF for assessmentId: ${assessmentId}`, err);
    throw err;
  }
});
