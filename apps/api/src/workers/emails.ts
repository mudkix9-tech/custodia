import { createWorker, createQueue } from '../lib/queue.js';
import { Resend } from 'resend';
import { db } from '../db.js';
import { assessments, users, pendingSignups, organizations } from 'db';
import { eq } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export const emailQueue = createQueue('email-sequences');

// Define Job Payload
type EmailJobData = 
  | { sequence: 'immediate_score' | 'day_3_reminder' | 'day_7_push' | 'day_14_expiry'; type: 'assessment'; assessmentId: string; email: string; }
  | { sequence: 'immediate_score' | 'day_3_reminder' | 'day_7_push' | 'day_14_expiry'; type: 'lead'; leadId: string; email: string; };

// Start Worker
export const emailWorker = createWorker('email-sequences', async (job: any) => {
  const data = job.data as EmailJobData;
  console.log(`[Email Worker] Processing job ${job.id} of sequence ${data.sequence} for ${data.email} (${data.type})`);
  
  let score: number = 0;
  let hasConverted = false;
  let targetId = '';
  
  if (data.type === 'assessment') {
    targetId = data.assessmentId;
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, data.assessmentId));
    if (!assessment) return;
    score = assessment.overallScore ?? 0;
    
    if (data.sequence !== 'immediate_score') {
      const [pending] = await db.select().from(pendingSignups).where(eq(pendingSignups.assessmentId, data.assessmentId));
      if (data.sequence === 'day_7_push' || data.sequence === 'day_14_expiry') {
        if (assessment.organizationId) {
          const [org] = await db.select().from(organizations).where(eq(organizations.id, assessment.organizationId));
          if (org && org.subscriptionStatus === 'active') {
            console.log(`[Email Worker] Skipping ${data.sequence} because org ${org.id} is already active/upgraded.`);
            return;
          }
        }
      }
    }
  } else if (data.type === 'lead') {
    targetId = data.leadId;
    const { leadAssessments } = await import('db');
    const [lead] = await db.select().from(leadAssessments).where(eq(leadAssessments.id, data.leadId));
    if (!lead) return;
    score = lead.totalScore ?? 0;
    
    // Stop funnel if they converted
    if (lead.convertedToOrgId && data.sequence !== 'immediate_score') {
       const [org] = await db.select().from(organizations).where(eq(organizations.id, lead.convertedToOrgId));
       if (org && org.subscriptionStatus === 'active') {
          console.log(`[Email Worker] Skipping ${data.sequence} because org ${org.id} is already active/upgraded.`);
          return;
       }
    }
  }

  let subject = '';
  let html = '';

  switch (data.sequence) {
    case 'immediate_score':
      subject = `Your GDPR compliance score: ${score}% — critical issues found`;
      html = `
        <h2>Your GDPR Gap Assessment is complete</h2>
        <p>Your overall compliance score is <strong>${score}%</strong>.</p>
        <p>We found several critical issues. Click the magic link you received earlier to view the detailed breakdown and action plan.</p>
        <br/>
        <p>Or, use this shareable link with your team: <a href="${process.env.APP_URL}/assessment/results?id=${targetId}">View Score</a></p>
      `;
      break;

    case 'day_3_reminder':
      subject = `Your GDPR gaps are still open. Here's what other agencies fixed first.`;
      html = `
        <p>Hi there,</p>
        <p>It's been a few days since you completed your GDPR assessment. Your score of ${score}% indicates high risk areas.</p>
        <p>Most agencies tackle their Vendor Processing Agreements (DPAs) first. Privaro helps you automate this.</p>
        <p><a href="${process.env.APP_URL}/assessment/results?id=${targetId}">Return to your dashboard</a></p>
      `;
      break;

    case 'day_7_push':
      subject = `Missing vendor DPAs takes 10 minutes to fix with Privaro.`;
      html = `
        <p>Hi,</p>
        <p>One of your critical gaps — missing vendor DPAs — is an easy fix with Privaro OS.</p>
        <p>Start your 14-day free trial of our Professional tier today and automate your vendor compliance.</p>
        <p><a href="${process.env.APP_URL}/pricing">View Privaro Plans</a></p>
      `;
      break;

    case 'day_14_expiry':
      subject = `Your assessment expires in 16 days.`;
      html = `
        <p>Hi,</p>
        <p>Just a heads up that your free GDPR gap assessment will expire in 16 days.</p>
        <p>Upgrade your account to keep your compliance dashboard permanently active and unlock DSAR automation.</p>
        <p><a href="${process.env.APP_URL}/pricing">Upgrade to Pro</a></p>
      `;
      break;
  }

  try {
    await resend.emails.send({
      from: 'Custodia <noreply@trycustodia.online>',
      to: data.email,
      subject,
      html,
    });
    console.log(`[Email Worker] Sent ${data.sequence} to ${data.email}`);
  } catch (err) {
    console.error(`[Email Worker] Failed to send email to ${data.email}`, err);
    throw err;
  }
}, { drainDelay: 15 });

if (emailWorker) {
  emailWorker.on('error', (err: Error) => {
    console.warn('[Email Worker] Error:', err.message);
  });
}

export const scheduleEmailSequence = async (payload: { type: 'assessment', assessmentId: string, email: string } | { type: 'lead', leadId: string, email: string }) => {
  const basePayload = payload.type === 'assessment' 
     ? { type: 'assessment' as const, assessmentId: payload.assessmentId, email: payload.email }
     : { type: 'lead' as const, leadId: payload.leadId, email: payload.email };
     
  // 1. Immediate (delay 5 seconds just to ensure DB is committed)
  await emailQueue.add('immediate', { sequence: 'immediate_score', ...basePayload }, { delay: 5000 });
  
  // 2. Day 3 Reminder
  await emailQueue.add('day_3', { sequence: 'day_3_reminder', ...basePayload }, { delay: 3 * 24 * 60 * 60 * 1000 });
  
  // 3. Day 7 Push
  await emailQueue.add('day_7', { sequence: 'day_7_push', ...basePayload }, { delay: 7 * 24 * 60 * 60 * 1000 });
  
  // 4. Day 14 Expiry Warning
  await emailQueue.add('day_14', { sequence: 'day_14_expiry', ...basePayload }, { delay: 14 * 24 * 60 * 60 * 1000 });
};
