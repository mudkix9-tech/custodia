/**
 * C33. The reminder ladder for delegated data-collection requests.
 *
 * Same shape as B19's review ladder and for the same reason: a questionnaire sent
 * to someone who does not work in this product goes quiet by default, and a request
 * with no overdue rung is one the DPO discovers is unanswered a month later.
 *
 * Three rungs — a week before, two days before, one day after — and at most one
 * email a day whatever the ladder says, because two rungs falling on the same date
 * is how a respondent gets three emails in an afternoon and stops reading any of
 * them. The rung arithmetic lives in `lib/ropaIntake.ts` so it is exercisable
 * without a database.
 *
 * Dormant by default: it emails people outside the organisation, which is the
 * strongest case in the checklist for an explicit opt-in.
 */
import { createWorker, createQueue, type Job } from '../lib/queue.js';
import { db } from '../db.js';
import { ropaIntakeRequests, organizations } from 'db';
import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';
import { intakeReminderDue } from '../lib/ropaIntake.js';

export const ropaIntakeQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('ropa-intake');

export const ropaIntakeWorker = createWorker('ropa-intake', async (job: Job) => {
  if (job.name !== 'ropa-intake-dispatch' && job.name !== 'ropa-intake-reminders') {
    return { skipped: true, reason: `Unknown job ${job.name}` };
  }

  const now = new Date();

  // Expiry first, so an expired request is never reminded about. A token that has
  // stopped working plus an email telling someone to use it is the worst of both.
  await db.update(ropaIntakeRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      inArray(ropaIntakeRequests.status, ['draft', 'sent', 'opened']),
      isNotNull(ropaIntakeRequests.expiresAt),
      lt(ropaIntakeRequests.expiresAt, now),
    ));

  const outstanding = await db.select({
    request: ropaIntakeRequests,
    organizationName: organizations.name,
  })
    .from(ropaIntakeRequests)
    .innerJoin(organizations, eq(ropaIntakeRequests.organizationId, organizations.id))
    .where(and(
      inArray(ropaIntakeRequests.status, ['sent', 'opened']),
      isNotNull(ropaIntakeRequests.dueAt),
    ));

  let sent = 0;

  for (const row of outstanding) {
    const request = row.request;
    if (!intakeReminderDue({
      dueAt: request.dueAt,
      remindersSent: request.remindersSent ?? 0,
      lastReminderAt: request.lastReminderAt,
      now,
    })) continue;

    const overdue = request.dueAt ? request.dueAt.getTime() < now.getTime() : false;

    await queueNotification({
      organizationId: request.organizationId,
      emailTo: request.recipientEmail,
      type: 'ropa.intake.reminder',
      title: overdue
        ? `Overdue: ${row.organizationName} is still waiting on your answers`
        : `Reminder: ${row.organizationName} needs your answers`,
      body: request.message
        || 'Your organisation is putting together its record of how it uses people’s information. It should take about three minutes.',
      actionUrl: `/intake/${request.token}`,
      metadata: { intakeRequestId: request.id, overdue },
    });

    await db.update(ropaIntakeRequests)
      .set({
        remindersSent: sql`${ropaIntakeRequests.remindersSent} + 1`,
        lastReminderAt: now,
        updatedAt: now,
      })
      .where(eq(ropaIntakeRequests.id, request.id));

    sent += 1;
  }

  return { reminded: sent, outstanding: outstanding.length };
});
