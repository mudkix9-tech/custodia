import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db.js';
import { breaches, breachRemediationTasks, users, organizations } from 'db';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { queueNotification, NotificationType } from '../utils/notifications.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const breachDeadlineMonitor = new Worker(
  'breach-deadline-monitor',
  async (job: Job) => {
    // 1. Fetch active breaches that haven't notified authority
    const activeBreaches = await db.query.breaches.findMany({
      where: and(
        eq(breaches.status, 'assessing'), // or 'detected'
        isNull(breaches.authorityNotifiedAt),
        isNull(breaches.resolvedAt)
      ),
      with: {
        organization: true,
      }
    });

    const now = new Date();

    for (const breach of activeBreaches) {
      if (!breach.organization) continue;
      
      const deadline = new Date(breach.notificationDeadline);
      const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      // We only alert if it hasn't been assessed as 'unlikely'
      if (breach.riskToIndividuals === 'unlikely') continue;

      const dpoEmail = breach.organization.dpoEmail || 'support@privaro.io';

      let alertLevel = null;

      // Identify thresholds: 60h, 48h, 36h, 24h, 12h, 6h, 0h
      if (diffHours <= 0 && diffHours > -1) alertLevel = 'overdue';
      else if (diffHours <= 6 && diffHours > 5) alertLevel = '6h';
      else if (diffHours <= 12 && diffHours > 11) alertLevel = '12h';
      else if (diffHours <= 24 && diffHours > 23) alertLevel = '24h';
      else if (diffHours <= 36 && diffHours > 35) alertLevel = '36h';
      else if (diffHours <= 48 && diffHours > 47) alertLevel = '48h';
      else if (diffHours <= 60 && diffHours > 59) alertLevel = '60h';

      if (!alertLevel) continue;

      const baseSubject = `[URGENT] GDPR Breach Deadline Alert: ${breach.referenceNumber}`;
      let html = `<p>Breach <b>${breach.referenceNumber}</b> requires attention.</p>`;
      
        let type: NotificationType = 'breach.deadline_48h';
        if (alertLevel === '24h') type = 'breach.deadline_24h';
        if (alertLevel === '12h' || alertLevel === '6h') type = 'breach.deadline_12h';
        if (alertLevel === 'overdue') type = 'breach.overdue';

        await queueNotification({
          organizationId: breach.organizationId,
          type,
          title: baseSubject,
          body: html,
          actionUrl: `/breaches/${breach.id}`
        });
    }
  },
  { connection }
);

export const breachTaskTracker = new Worker(
  'breach-task-tracker',
  async (job: Job) => {
    const now = new Date();
    const overdueTasks = await db.query.breachRemediationTasks.findMany({
      where: and(
        lt(breachRemediationTasks.dueAt, now),
        eq(breachRemediationTasks.status, 'pending') // or in_progress
      ),
      with: {
        breach: {
          with: { organization: true }
        }
      }
    });

    for (const task of overdueTasks) {
      if (task.assignedTo && task.breach?.organization) {
        const [assignedUser] = await db.select().from(users).where(eq(users.id, task.assignedTo));
        if (assignedUser) {
          const dpoEmail = task.breach.organization.dpoEmail || 'support@privaro.io';
          await queueNotification({
            organizationId: task.breach.organizationId,
            userId: assignedUser.id,
            type: 'breach.overdue', // fallback type since we don't have task.overdue
            title: `Overdue Breach Task: ${task.title}`,
            body: `The task ${task.title} for breach ${task.breach.referenceNumber} is overdue.`,
            actionUrl: `/breaches/${task.breach.id}`
          });
        }
      }
    }
  },
  { connection }
);

import { Queue } from 'bullmq';

const breachMonitorQueue = new Queue('breach-deadline-monitor', { connection });
const breachTaskQueue = new Queue('breach-task-tracker', { connection });

export async function scheduleBreachesJobs() {
  await breachMonitorQueue.add('check-deadlines', {}, {
    repeat: { pattern: '*/30 * * * *' } // Every 30 minutes
  });

  await breachTaskQueue.add('check-tasks', {}, {
    repeat: { pattern: '0 8 * * *' } // Daily at 8am
  });
}
