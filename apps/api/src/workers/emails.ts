import { createWorker } from '../lib/queue.js';
import { Queue, Worker, Job } from 'bullmq';
import { Resend } from 'resend';
import { db } from '../db.js';
import { assessments, users, pendingSignups, organizations , createRedisClient } from 'db';
import { eq } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

// Connect to local redis. If no redis is running, this will fail gracefully during dev.
const connection = createRedisClient({
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    // Stop retrying after 3 attempts in dev to avoid spamming the console
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  }
});

export const emailQueue = new Queue('email-sequences', { connection });

// Define Job Payload
type EmailJobData = {
  type: 'immediate_score' | 'day_3_reminder' | 'day_7_push' | 'day_14_expiry';
  assessmentId: string;
  email: string;
};

// Start Worker
export const emailWorker = createWorker<EmailJobData>('email-sequences', async (job: Job<EmailJobData>) => {
  console.log(`[Email Worker] Processing job ${job.id} of type ${job.data.type} for ${job.data.email}`);
  
  const { type, assessmentId, email } = job.data;
  
  // Verify assessment exists
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
  if (!assessment) return;

  // Verify conversion status for follow-ups
  if (type !== 'immediate_score') {
    const [pending] = await db.select().from(pendingSignups).where(eq(pendingSignups.assessmentId, assessmentId));
    // If there is no pending signup, it means they converted (or it expired)
    // Wait, if they converted, they have a user record. We only want to stop reminders if they upgraded or logged in.
    // Actually, if they converted, we still want to send day_3/day_7 if they haven't fixed things or upgraded.
    
    if (type === 'day_7_push' || type === 'day_14_expiry') {
      if (assessment.organizationId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, assessment.organizationId));
        if (org && org.subscriptionStatus === 'active') {
          console.log(`[Email Worker] Skipping ${type} because org ${org.id} is already active/upgraded.`);
          return; // They upgraded, stop the funnel
        }
      }
    }
  }

  let subject = '';
  let html = '';

  const score = assessment.overallScore;

  switch (type) {
    case 'immediate_score':
      subject = `Your GDPR compliance score: ${score}% — critical issues found`;
      html = `
        <h2>Your GDPR Gap Assessment is complete</h2>
        <p>Your overall compliance score is <strong>${score}%</strong>.</p>
        <p>We found several critical issues. Click the magic link you received earlier to view the detailed breakdown and action plan.</p>
        <br/>
        <p>Or, use this shareable link with your team: <a href="${process.env.APP_URL}/assessment/results?id=${assessmentId}">View Score</a></p>
      `;
      break;

    case 'day_3_reminder':
      subject = `Your GDPR gaps are still open. Here's what other agencies fixed first.`;
      html = `
        <p>Hi there,</p>
        <p>It's been a few days since you completed your GDPR assessment. Your score of ${score}% indicates high risk areas.</p>
        <p>Most agencies tackle their Vendor Processing Agreements (DPAs) first. Privaro helps you automate this.</p>
        <p><a href="${process.env.APP_URL}/assessment/results?id=${assessmentId}">Return to your dashboard</a></p>
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
      from: 'Privaro <hello@privaro.io>',
      to: email,
      subject,
      html,
    });
    console.log(`[Email Worker] Sent ${type} to ${email}`);
  } catch (err) {
    console.error(`[Email Worker] Failed to send email to ${email}`, err);
    throw err;
  }
}, { drainDelay: 15 });

emailWorker.on('error', (err) => {
  console.warn('[Email Worker] Error:', err.message);
});

export const scheduleEmailSequence = async (assessmentId: string, email: string) => {
  // 1. Immediate (delay 5 seconds just to ensure DB is committed)
  await emailQueue.add('immediate', { type: 'immediate_score', assessmentId, email }, { delay: 5000 });
  
  // 2. Day 3 Reminder
  await emailQueue.add('day_3', { type: 'day_3_reminder', assessmentId, email }, { delay: 3 * 24 * 60 * 60 * 1000 });
  
  // 3. Day 7 Push
  await emailQueue.add('day_7', { type: 'day_7_push', assessmentId, email }, { delay: 7 * 24 * 60 * 60 * 1000 });
  
  // 4. Day 14 Expiry Warning
  await emailQueue.add('day_14', { type: 'day_14_expiry', assessmentId, email }, { delay: 14 * 24 * 60 * 60 * 1000 });
};
