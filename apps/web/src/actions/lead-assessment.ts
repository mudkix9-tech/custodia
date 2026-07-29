"use server";

import { db } from '../db';
import { leadAssessments, assessmentTemplates } from 'db';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

export async function saveLeadAssessment(data: {
  answers: Array<{ questionId: string, selectedOption: string }>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}) {
  const headersList = await headers();
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '';
  const userAgent = headersList.get('user-agent') || '';

  const templates = await db.select().from(assessmentTemplates);
  let totalRisk = 0;
  let totalPossibleRisk = 0;
  const snapshot: any[] = [];

  for (const ans of data.answers) {
    const template = templates.find(t => t.id === ans.questionId);
    if (!template) {
      throw new Error(`Invalid questionId: ${ans.questionId}`);
    }

    const options = template.options as Array<{ text: string, riskWeight?: number }>;
    const option = options.find(o => o.text === ans.selectedOption);
    if (!option) {
      throw new Error(`Invalid selectedOption "${ans.selectedOption}" for questionId: ${ans.questionId}`);
    }

    const riskScore = option.riskWeight ?? 0;
    totalRisk += riskScore;
    totalPossibleRisk += (template.maxRiskWeight ?? 10);

    snapshot.push({
      questionId: template.id,
      questionText: template.questionText,
      selectedOption: ans.selectedOption,
      score: riskScore
    });
  }

  let overallScore = 100;
  if (totalPossibleRisk > 0) {
    overallScore = Math.round(100 - ((totalRisk / totalPossibleRisk) * 100));
  }

  let riskLevel = 'LOW';
  if (overallScore < 50) riskLevel = 'HIGH';
  else if (overallScore <= 75) riskLevel = 'MEDIUM';

  const [lead] = await db.insert(leadAssessments).values({
    totalScore: overallScore,
    riskLevel,
    snapshot,
    ipAddress,
    userAgent,
    utmSource: data.utmSource || null,
    utmMedium: data.utmMedium || null,
    utmCampaign: data.utmCampaign || null,
  }).returning();

  return { leadId: lead.id };
}

export async function requestLeadPdf(leadId: string, email: string) {
  await db.update(leadAssessments).set({ email }).where(eq(leadAssessments.id, leadId));
  
  const PgBoss = (await import('pg-boss')).default;
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const boss = new PgBoss(connectionString);
    await boss.start();
    await boss.send('generate-lead-pdf', { leadId, email });
    await boss.stop();
    console.log(`[Queue] Enqueued PDF generation for lead ${leadId} to ${email}`);
  } else {
    console.error("Missing DATABASE_URL to start pg-boss");
  }
  
  return { success: true };
}
