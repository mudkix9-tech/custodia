/**
 * B19/M112. The register's reminder ladder, and the task due-date nudge.
 *
 * The columns for a review cycle have existed since the schema was written and
 * nothing ever read them, so a register could go two years past its own review date
 * in perfect silence. This is what makes the cycle a cycle.
 *
 * Structured the way `dpiaReminders` is — a dispatcher on its own queue fanning out
 * one job per organisation — for the reason its comment gives: two workers
 * registered on one queue makes pg-boss round-robin between them, so half of each
 * job type goes to the handler that ignores it.
 *
 * Both jobs email customers, so both are in `DORMANT_JOBS`. That is the checklist in
 * CLAUDE.md, and it is the right default: the ladder is only useful once an
 * organisation has actually set review dates, and until then it is a nightly mail
 * about records nobody has decided anything about.
 */
import { createWorker, createQueue, type Job } from '../lib/queue.js';
import { db } from '../db.js';
import { processingActivities, processingActivityTasks, organizations, users } from 'db';
import { and, eq, inArray, isNull, isNotNull, lt, lte, gte, ne, or } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';
import { reminderRungFor, REVIEW_REMINDER_LADDER } from '../lib/ropaLifecycle.js';

export const ropaReviewsQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('ropa-reviews');

/** Copy for each rung of the ladder, keyed by days-until-review. */
const RUNG_COPY: Record<number, { type: 'ropa.review_due' | 'ropa.review_overdue'; title: (name: string) => string; body: (name: string, days: number) => string }> = {
  30: {
    type: 'ropa.review_due',
    title: (name) => `Review due in 30 days: "${name}"`,
    body: (name) => `The Article 30 record for "${name}" is scheduled for review in 30 days.`,
  },
  7: {
    type: 'ropa.review_due',
    title: (name) => `Review due next week: "${name}"`,
    body: (name) => `The Article 30 record for "${name}" is scheduled for review in 7 days.`,
  },
  0: {
    type: 'ropa.review_due',
    title: (name) => `Review due today: "${name}"`,
    body: (name) => `The Article 30 record for "${name}" is due for review today. Attest that it is accurate, or record what has changed.`,
  },
  [-14]: {
    type: 'ropa.review_overdue',
    title: (name) => `Review overdue: "${name}"`,
    body: (name, days) => `The Article 30 record for "${name}" has been overdue for ${Math.abs(days)} days. An unreviewed register is the first thing a supervisory authority asks about.`,
  },
};

/**
 * Who hears about a record's review.
 *
 * Owners first; the DPO or an admin only when nobody owns it, because an unowned
 * overdue activity is precisely the case B18 exists for and it has to land
 * somewhere. Falling back to *every* admin would turn a hundred unowned records
 * into a hundred emails each, so the fallback is one person: the first
 * owner-or-admin the organisation has.
 */
async function recipientsFor(orgId: string, activity: any, fallbackUserId: string | null): Promise<string[]> {
  const owners = [activity.businessOwnerId, activity.privacyOwnerId].filter((id): id is string => !!id);
  if (owners.length > 0) return [...new Set(owners)];
  return fallbackUserId ? [fallbackUserId] : [];
}

export const ropaReviewsWorker = createWorker('ropa-reviews', async (job: Job) => {
  if (job.name !== 'ropa-review-reminder-checker') return;

  const orgId = job.data?.organizationId;
  if (!orgId) {
    console.error('[ROPA Reviews] Job missing organizationId');
    return;
  }

  const now = new Date();

  // Only records that are live and scheduled. An archived or deleted activity has
  // no review cycle, and reminding somebody about one is how the queue becomes
  // noise they stop reading.
  const [due, [fallback]] = await Promise.all([
    db.select().from(processingActivities).where(and(
      eq(processingActivities.organizationId, orgId),
      isNull(processingActivities.deletedAt),
      ne(processingActivities.status, 'archived'),
      isNotNull(processingActivities.nextReviewAt),
    )),
    db.select({ id: users.id }).from(users).where(and(
      eq(users.organizationId, orgId),
      inArray(users.role, ['owner', 'admin']),
    )),
  ]);

  for (const activity of due) {
    // Exactly one rung per record per run. "Anything in the past" would email the
    // owner of an overdue activity every night until they either fixed it or
    // filtered the sender, and the second is more likely than the first.
    const rung = reminderRungFor(activity.nextReviewAt!, now);
    if (rung === null) continue;

    const copy = RUNG_COPY[rung];
    if (!copy) continue;

    for (const userId of await recipientsFor(orgId, activity, fallback?.id ?? null)) {
      await queueNotification({
        organizationId: orgId,
        userId,
        type: copy.type,
        title: copy.title(activity.name),
        body: copy.body(activity.name, rung),
        actionUrl: `/ropa/${activity.id}`,
        metadata: { activityId: activity.id, rung, nextReviewAt: activity.nextReviewAt },
      });
    }
  }

  // M110. Tasks with a due date inside the next three days, reminded once. The
  // `reminderSentAt` column is what makes it once — a nightly job over open tasks
  // otherwise mails the same assignee about the same task every night until they
  // close it.
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const tasks = await db.select({
    id: processingActivityTasks.id,
    title: processingActivityTasks.title,
    dueDate: processingActivityTasks.dueDate,
    assigneeId: processingActivityTasks.assigneeId,
    processingActivityId: processingActivityTasks.processingActivityId,
    activityName: processingActivities.name,
  })
    .from(processingActivityTasks)
    .leftJoin(processingActivities, eq(processingActivityTasks.processingActivityId, processingActivities.id))
    .where(and(
      eq(processingActivityTasks.organizationId, orgId),
      inArray(processingActivityTasks.status, ['open', 'in_progress']),
      isNotNull(processingActivityTasks.assigneeId),
      isNotNull(processingActivityTasks.dueDate),
      lte(processingActivityTasks.dueDate, soon),
      isNull(processingActivityTasks.reminderSentAt),
    ));

  for (const task of tasks) {
    await queueNotification({
      organizationId: orgId,
      userId: task.assigneeId,
      type: 'ropa.task_due',
      title: `Task due: ${task.title}`,
      body: `A task on "${task.activityName ?? 'a processing activity'}" is due on ${task.dueDate?.toISOString().slice(0, 10)}.`,
      actionUrl: `/ropa/${task.processingActivityId}`,
      metadata: { taskId: task.id, activityId: task.processingActivityId },
    });

    await db.update(processingActivityTasks)
      .set({ reminderSentAt: now })
      .where(eq(processingActivityTasks.id, task.id));
  }
}, { drainDelay: 60 });

/** Fans one job out per organisation. Its own queue, for the reason above. */
export const ropaReviewsDispatcherWorker = createWorker('ropa-reviews-dispatcher', async (job: Job) => {
  if (job.name !== 'ropa-reviews-dispatcher') return;

  const allOrgs = await db.select({ id: organizations.id }).from(organizations)
    .where(isNull(organizations.deletedAt));

  for (const org of allOrgs) {
    await ropaReviewsQueue.add('ropa-review-reminder-checker', { organizationId: org.id });
  }
}, { drainDelay: 60 });

export { REVIEW_REMINDER_LADDER };
