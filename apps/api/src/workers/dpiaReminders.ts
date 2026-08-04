import { createWorker } from '../lib/queue.js';
import { Job, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { dpias, organizations, users } from 'db';
import { eq, sql, inArray } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';

export const dpiaRemindersQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('dpia-reminders');

// Helper to calculate days until a date (positive if in the future, negative if in the past)
const daysUntil = (date: Date) => {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const isUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export const dpiaRemindersWorker = createWorker('dpia-reminders', async (job: Job) => {
  console.log(`[DPIA Reminders Worker] Processing job ${job.name} (ID: ${job.id})`);

  if (job.name === 'dpia-mitigation-reminder-checker') {
    const orgId = job.data.organizationId;
    if (!orgId) {
      console.error('[DPIA Reminders Worker] Job missing organizationId');
      return;
    }

    console.log(`Checking DPIA mitigation reminders for org ${orgId}...`);

    const orgDpias = await db.select().from(dpias).where(eq(dpias.organizationId, orgId));

    const allOwnerIds = Array.from(new Set(
      orgDpias.flatMap(dpia => ((dpia.residualRisks || []) as any[])
        .map(r => r.mitigationOwner)
        .filter(id => id && isUUID(id))
      )
    )) as string[];

    const orgUsers = allOwnerIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, allOwnerIds))
      : [];
    const usersMap = new Map(orgUsers.filter(u => u.organizationId === orgId).map(u => [u.id, u]));

    for (const dpia of orgDpias) {
      const residualRisks = (dpia.residualRisks || []) as any[];
      const lastReminderSentAt = (dpia.lastMitigationReminderSentAt || {}) as Record<string, string>;
      const newTimestamps: Record<string, string> = {};
      let hasUpdates = false;

      for (const risk of residualRisks) {
        if (risk.mitigationStatus === 'completed' || !risk.mitigationDueDate) {
          continue;
        }

        const dueDate = new Date(risk.mitigationDueDate);
        const days = daysUntil(dueDate);

        let currentTier: '14d_before' | 'due_today' | 'overdue' | null = null;
        
        if (days === 0) {
          currentTier = 'due_today';
        } else if (days < 0) {
          currentTier = 'overdue';
        } else if (days > 0 && days <= 14 && days >= 13) {
          // Trigger the 14 day reminder when we cross the 14 day threshold
          currentTier = '14d_before';
        }

        if (!currentTier) {
          continue; // No notification needed
        }

        const lastSentStr = lastReminderSentAt[risk.id];
        const lastSentDate = lastSentStr ? new Date(lastSentStr) : null;
        const daysSinceLastSent = lastSentDate ? (Date.now() - lastSentDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

        // Dedup check based on tier
        if (currentTier === '14d_before' && daysSinceLastSent < 14) {
          continue; // One-shot
        } else if (currentTier === 'due_today' && daysSinceLastSent < 1) {
          continue; // One-shot
        } else if (currentTier === 'overdue' && daysSinceLastSent < 7) {
          continue; // Weekly recurrence
        }

        // Determine recipient
        let userId: string | null = null;
        if (risk.mitigationOwner && isUUID(risk.mitigationOwner)) {
          const user = usersMap.get(risk.mitigationOwner);
          if (user) {
            userId = user.id;
          }
        }

        let notifType: any = null;
        let notifTitle = '';
        let notifBody = '';
        const actionUrl = `/audit?source=dpia`; // Deep link to the audit page

        if (currentTier === '14d_before') {
          notifType = 'dpia.mitigation_due_14d';
          notifTitle = 'DPIA Mitigation Due Soon';
          notifBody = `A DPIA risk mitigation is due in 14 days: ${risk.description}`;
        } else if (currentTier === 'due_today') {
          notifType = 'dpia.mitigation_due_today';
          notifTitle = 'DPIA Mitigation Due Today';
          notifBody = `A DPIA risk mitigation is due today: ${risk.description}`;
        } else if (currentTier === 'overdue') {
          notifType = 'dpia.mitigation_overdue';
          notifTitle = 'DPIA Mitigation Overdue';
          notifBody = `A DPIA risk mitigation is overdue by ${Math.abs(days)} days: ${risk.description}`;
        }

        await queueNotification({
          organizationId: orgId,
          userId: userId,
          type: notifType,
          title: notifTitle,
          body: notifBody,
          actionUrl: actionUrl,
          metadata: {
            dpiaId: dpia.id,
            riskId: risk.id
          }
        });

        newTimestamps[risk.id] = new Date().toISOString();
        hasUpdates = true;
      }

      if (hasUpdates) {
        // Merge new timestamps with existing ones directly in the database
        await db.update(dpias)
          .set({
            lastMitigationReminderSentAt: sql`${dpias.lastMitigationReminderSentAt} || ${JSON.stringify(newTimestamps)}::jsonb`
          })
          .where(eq(dpias.id, dpia.id));
      }
    }
  }
}, { drainDelay: 60 });

// Helper to queue org jobs


// Another worker for the dispatcher
export const dpiaDispatcherWorker = createWorker('dpia-reminders', async (job: Job) => {
  if (job.name === 'dpia-dispatcher') {
    console.log('[DPIA Reminders] Dispatching per-org jobs...');
    const allOrgs = await db.select({ id: organizations.id }).from(organizations);
    
    for (const org of allOrgs) {
      await dpiaRemindersQueue.add('dpia-mitigation-reminder-checker', { organizationId: org.id });
    }
  }
}, { drainDelay: 60 });
