"use server";

import { db } from '../db';
import { leadAssessments } from 'db';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

export async function saveLeadAssessment(data: {
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
