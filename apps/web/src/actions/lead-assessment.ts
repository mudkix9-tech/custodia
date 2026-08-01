"use server";

import { db } from '../db';
import { leadAssessments, assessmentTemplates } from 'db';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

export async function saveLeadAssessment(data: {
  answers: Array<{ questionId: string, selectedOption: string }>;
  locale?: string;
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

    const locale = data.locale || 'en';
    const translations = (template.translations as Record<string, any>)?.[locale];
    
    const optionIndex = options.findIndex(o => o.text === ans.selectedOption);
    const questionText = translations?.questionText || template.questionText;
    const translatedOptionText = translations?.options?.[ans.selectedOption] || ans.selectedOption;
    const category = translations?.category || template.category || 'General';
    const remediationGuidance = translations?.remediationGuidance || template.remediationGuidance || null;

    snapshot.push({
      questionId: template.id,
      questionText: questionText,
      category: category,
      remediationGuidance: remediationGuidance,
      selectedOption: translatedOptionText,
      originalSelectedOption: ans.selectedOption,
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
    locale: data.locale || 'en',
    utmSource: data.utmSource || null,
    utmMedium: data.utmMedium || null,
    utmCampaign: data.utmCampaign || null,
  }).returning();

  return { leadId: lead.id };
}

export async function saveQuickLeadAssessment(data: {
  totalScore: number;
  riskLevel: string;
  snapshot: any[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}) {
  const headersList = await headers();
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '';
  const userAgent = headersList.get('user-agent') || '';

  const [lead] = await db.insert(leadAssessments).values({
    totalScore: data.totalScore,
    riskLevel: data.riskLevel,
    snapshot: data.snapshot,
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
  const connectionString = process.env.DIRECT_URL || (process.env.DATABASE_URL || '').replace(':6543/', ':5432/');
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

export async function captureLeadEmail(leadId: string, email: string, marketingConsent: boolean) {
  await db.update(leadAssessments)
    .set({ email, marketingConsent })
    .where(eq(leadAssessments.id, leadId));
    
  const PgBoss = (await import('pg-boss')).default;
  const connectionString = process.env.DIRECT_URL || (process.env.DATABASE_URL || '').replace(':6543/', ':5432/');
  
  if (connectionString) {
    const boss = new PgBoss(connectionString);
    await boss.start();
    
    // Queue PDF generation
    await boss.send('generate-lead-pdf', { leadId, email });
    
    // Queue email sequences
    const payload = { type: 'lead', leadId, email };
    await boss.send('email-sequences', { sequence: 'immediate_score', ...payload }, { startAfter: 5 });
    await boss.send('email-sequences', { sequence: 'day_3_reminder', ...payload }, { startAfter: 3 * 24 * 60 * 60 });
    await boss.send('email-sequences', { sequence: 'day_7_push', ...payload }, { startAfter: 7 * 24 * 60 * 60 });
    await boss.send('email-sequences', { sequence: 'day_14_expiry', ...payload }, { startAfter: 14 * 24 * 60 * 60 });
    
    await boss.stop();
    console.log(`[Queue] Enqueued PDF generation and email sequence for lead ${leadId} to ${email}`);
  } else {
    console.error("Missing DATABASE_URL to start pg-boss");
  }
  
  return { success: true };
}
