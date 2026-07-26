import { createWorker } from '../lib/queue.js';
import { Queue, Worker } from 'bullmq';
import { db } from '../db.js';
import { eq, and, lt, lte, ne } from 'drizzle-orm';
import { dsarRequests, users, organizations, notificationQueue , createRedisClient } from 'db';
import { queueNotification, NotificationType } from '../utils/notifications.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = createRedisClient({ maxRetriesPerRequest: null });

export const dsarJobsQueue = new Queue('dsar-automation', { connection });

async function notifyUser(userId: string, orgId: string, type: NotificationType, subject: string, html: string) {
  try {
    await queueNotification({
      organizationId: orgId,
      userId,
      type,
      title: subject,
      body: html,
      actionUrl: '/dsar'
    });
  } catch (err) {
    console.error('Failed to queue DSAR notification', err);
  }
}

const dsarWorker = createWorker('dsar-automation', async job => {
  
  // 1. Deadline Monitor
  if (job.name === 'dsar-deadline-monitor') {
    console.log('[DSAR Worker] Running daily deadline monitor...');
    const activeRequests = await db.select().from(dsarRequests).where(ne(dsarRequests.status, 'completed'));
    
    for (const req of activeRequests) {
      if (req.status === 'refused') continue;

      const daysRemaining = Math.floor((req.deadlineAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      // If overdue
      if (daysRemaining < 0 && req.status !== 'overdue') {
        await db.update(dsarRequests).set({ status: 'overdue' }).where(eq(dsarRequests.id, req.id));
        
        // Notify owner
        const orgUsers = await db.select().from(users).where(and(eq(users.organizationId, req.organizationId), eq(users.role, 'owner')));
        for (const owner of orgUsers) {
          await notifyUser(owner.id, req.organizationId, 'dsar.overdue', '🚨 LEGAL WARNING: DSAR is Overdue', `
            <p>The Data Subject Access Request <strong>${req.referenceNumber}</strong> is now legally overdue by ${Math.abs(daysRemaining)} days.</p>
            <p>Immediate action is required to avoid regulatory fines.</p>
          `);
        }
        continue;
      }

      // Escalations
      if (!req.assignedTo) continue; // No one to escalate to
      
      if (daysRemaining === 14 || daysRemaining === 8) {
        await notifyUser(req.assignedTo, req.organizationId, 'dsar.deadline_warning_7d', `Reminder: DSAR Due in ${daysRemaining} days`, `DSAR ${req.referenceNumber} needs attention.`);
      } else if (daysRemaining <= 7 && daysRemaining >= 4) {
        // Notify assigned and all admins
        await notifyUser(req.assignedTo, req.organizationId, 'dsar.deadline_warning_7d', `URGENT: DSAR Due in ${daysRemaining} days`, `DSAR ${req.referenceNumber} is approaching its deadline.`);
        const admins = await db.select().from(users).where(and(eq(users.organizationId, req.organizationId), eq(users.role, 'admin')));
        for (const admin of admins) {
          await notifyUser(admin.id, req.organizationId, 'dsar.deadline_warning_7d', `URGENT: DSAR Due in ${daysRemaining} days`, `DSAR ${req.referenceNumber} assigned to your team is approaching its deadline.`);
        }
      } else if (daysRemaining <= 3 && daysRemaining >= 1) {
        const owners = await db.select().from(users).where(and(eq(users.organizationId, req.organizationId), eq(users.role, 'owner')));
        for (const owner of owners) {
          await notifyUser(owner.id, req.organizationId, 'dsar.deadline_warning_3d', `CRITICAL: DSAR Due in ${daysRemaining} days`, `DSAR ${req.referenceNumber} must be completed immediately.`);
        }
      }
    }
  }

  // 2. Verification Reminder
  if (job.name === 'dsar-verification-reminder') {
    console.log('[DSAR Worker] Checking pending verifications...');
    const pendingRequests = await db.select().from(dsarRequests).where(eq(dsarRequests.status, 'new'));
    const now = Date.now();

    for (const req of pendingRequests) {
      if (req.subjectVerified) continue;
      
      const daysSinceReceipt = Math.floor((now - req.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceReceipt === 3) {
        // Send reminder to subject
        const [org] = await db.select().from(organizations).where(eq(organizations.id, req.organizationId));
        if (org) {
          await db.insert(notificationQueue).values({
            organizationId: req.organizationId,
            type: 'dsar.received',
            title: `Reminder: Action Required to process your data request`,
            body: `<p>We are waiting for you to verify your email so we can process your request.</p>`,
            channel: 'email',
            emailTo: req.subjectEmail,
            priority: 'normal',
            status: 'pending'
          });
        }
      } else if (daysSinceReceipt >= 14) {
        // Flag for manual review / hold
        await notifyUser(req.assignedTo || '', req.organizationId, 'dsar.deadline_warning_7d', `DSAR On Hold`, `DSAR ${req.referenceNumber} has been pending verification for 14 days.`);
      }
    }
  }

  // 3. Package Cleanup
  if (job.name === 'dsar-package-cleanup') {
    console.log('[DSAR Worker] Cleaning up expired data packages...');
    const expiredPackages = await db.select().from(dsarRequests).where(and(
      lte(dsarRequests.dataPackageExpiresAt, new Date()),
      ne(dsarRequests.dataPackageUrl, '')
    ));

    for (const req of expiredPackages) {
      // In real life: call S3.deleteObject
      await db.update(dsarRequests).set({ dataPackageUrl: null }).where(eq(dsarRequests.id, req.id));
      console.log(`Cleaned up package for DSAR ${req.referenceNumber}`);
    }
  }

}, { drainDelay: 15 });

dsarWorker.on('error', (err) => {
  console.warn('[DSAR Worker] Error:', err.message);
});

export async function scheduleDsarJobs() {
  try {
    const repeatableJobs = await dsarJobsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await dsarJobsQueue.removeRepeatableByKey(job.key);
    }

    // Daily at 1am UTC
    await dsarJobsQueue.add('dsar-deadline-monitor', {}, { repeat: { pattern: '0 1 * * *' } });
    await dsarJobsQueue.add('dsar-verification-reminder', {}, { repeat: { pattern: '0 1 * * *' } });
    
    // Weekly on Sunday
    await dsarJobsQueue.add('dsar-package-cleanup', {}, { repeat: { pattern: '0 2 * * 0' } });
    
    console.log('✅ DSAR Automation recurring jobs scheduled');
  } catch (err: any) {
    console.warn('⚠️ Could not schedule DSAR jobs. Is Redis running? Error:', err.message);
  }
}
