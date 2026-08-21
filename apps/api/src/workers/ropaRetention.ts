/**
 * E50/E51 and P123. The nightly retention scan and the completeness snapshot.
 *
 * Two jobs on one queue rather than two queues, because they are the same nightly
 * pass over the same register and splitting them would double the load for no gain.
 * They branch on `job.name`, which is what `wrapJobPayload` exists to carry — see
 * CLAUDE.md on the envelope.
 *
 * **The scan never deletes anything.** It writes a `due` row into the disposal log
 * and stops. A product that silently executed its customers' retention policy would
 * be destroying evidence on a schedule nobody had confirmed, on the strength of a
 * period somebody typed into a form; and the one time it got a trigger date wrong
 * there would be nothing to recover. The disposal log is a work queue, and the work
 * is done by a person in the system that holds the data.
 */
import { createWorker, createQueue, type Job } from '../lib/queue.js';
import { db } from '../db.js';
import {
  organizations,
  processingActivities,
  processingDataSubjects,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  legitimateInterestAssessments,
  retentionSchedules,
  retentionDisposals,
  legalHolds,
  legalHoldActivities,
  ropaCompletenessSnapshots,
  users,
} from 'db';
import { and, eq, inArray, isNull, ne, desc, lte, sql } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';
import { computeDisposalDate, disposalDueKey, holdIsActive } from '../lib/retention.js';
import { scoreActivity, type ActivityBundle } from '../lib/ropaCompleteness.js';
import { COMPLETENESS_BANDS } from '../lib/ropaLifecycle.js';
import { emitRopaEvent } from '../lib/ropaEvents.js';

export const ropaRetentionQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('ropa-retention');

export const ropaRetentionWorker = createWorker('ropa-retention', async (job: Job) => {
  switch (job.name) {
    case 'ropa-retention-dispatch': {
      const orgs = await db.select({ id: organizations.id }).from(organizations)
        .where(isNull(organizations.deletedAt));
      for (const org of orgs) {
        await ropaRetentionQueue.add('ropa-retention-scan', { orgId: org.id });
        await ropaRetentionQueue.add('ropa-completeness-snapshot', { orgId: org.id });
      }
      return { dispatched: orgs.length };
    }
    case 'ropa-retention-scan':
      return scanRetention(job.data?.orgId);
    case 'ropa-completeness-snapshot':
      return snapshotCompleteness(job.data?.orgId);
    default:
      return { skipped: true, reason: `Unknown job ${job.name}` };
  }
});

// ---------------------------------------------------------------------------
// E51 — what has come due
// ---------------------------------------------------------------------------
async function scanRetention(orgId?: string) {
  if (!orgId) return { skipped: true, reason: 'No organisation' };
  const now = new Date();

  const rows = await db.select({
    activity: processingActivities,
    schedule: retentionSchedules,
  })
    .from(processingActivities)
    .leftJoin(retentionSchedules, eq(processingActivities.retentionScheduleId, retentionSchedules.id))
    .where(and(
      eq(processingActivities.organizationId, orgId),
      isNull(processingActivities.deletedAt),
      // A draft has not asserted anything yet, and an archived activity has stopped.
      // Neither has a retention obligation the register can act on.
      eq(processingActivities.status, 'active'),
    ));

  const held = await heldActivityIds(orgId, now);
  let created = 0;
  let onHold = 0;

  for (const row of rows) {
    const { dueAt, reason } = computeDisposalDate({
      schedule: row.schedule,
      freeText: row.activity.retentionPeriod,
      anchorAt: row.activity.retentionAnchorAt,
      createdAt: row.activity.createdAt,
    });

    // `no_anchor` is the ordinary state of a correctly configured employment
    // schedule until an employment ends, and `no_period` is a gap the scanner
    // already reports (P124's ropa_no_retention). Neither is a disposal.
    if (reason !== 'computed' || !dueAt) continue;
    if (dueAt > now) continue;

    const dueKey = disposalDueKey(row.schedule?.id ?? null, dueAt);
    const isHeld = held.has(row.activity.id);

    const [existing] = await db.select({ id: retentionDisposals.id, status: retentionDisposals.status })
      .from(retentionDisposals)
      .where(and(
        eq(retentionDisposals.processingActivityId, row.activity.id),
        eq(retentionDisposals.dueKey, dueKey),
      ));

    if (existing) {
      // A hold placed after the row was written flips it, and a hold released
      // flips it back — but a completed or deferred row is a decision somebody
      // made and the scan does not revisit it.
      if (existing.status === 'due' && isHeld) {
        await db.update(retentionDisposals)
          .set({ status: 'on_hold', updatedAt: now })
          .where(eq(retentionDisposals.id, existing.id));
        onHold += 1;
      }
      continue;
    }

    await db.insert(retentionDisposals).values({
      organizationId: orgId,
      processingActivityId: row.activity.id,
      retentionScheduleId: row.schedule?.id ?? null,
      dueKey,
      dueAt,
      status: isHeld ? 'on_hold' : 'due',
      method: row.schedule?.disposalMethod ?? null,
      legalHoldId: isHeld ? (held.get(row.activity.id) ?? null) : null,
    }).onConflictDoNothing();

    created += 1;
    if (isHeld) onHold += 1;

    if (!isHeld) {
      await emitRopaEvent(orgId, 'ropa.retention.overdue', row.activity, {
        dueAt: dueAt.toISOString(),
        schedule: row.schedule ? { id: row.schedule.id, name: row.schedule.name } : null,
      });
    }
  }

  if (created > 0) await notifyRetentionQueue(orgId, created);
  return { created, onHold, scanned: rows.length };
}

/** Activity id -> the hold covering it, for holds genuinely in force right now. */
async function heldActivityIds(orgId: string, now: Date): Promise<Map<string, string>> {
  const rows = await db.select({
    activityId: legalHoldActivities.processingActivityId,
    holdId: legalHolds.id,
    status: legalHolds.status,
    expiresAt: legalHolds.expiresAt,
    releasedAt: legalHolds.releasedAt,
  })
    .from(legalHoldActivities)
    .innerJoin(legalHolds, eq(legalHoldActivities.legalHoldId, legalHolds.id))
    .where(and(eq(legalHolds.organizationId, orgId), eq(legalHolds.status, 'active')));

  const out = new Map<string, string>();
  for (const row of rows) {
    if (holdIsActive(row, now)) out.set(row.activityId, row.holdId);
  }
  return out;
}

async function notifyRetentionQueue(orgId: string, created: number) {
  const [owner] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, orgId), inArray(users.role, ['admin', 'owner'])))
    .limit(1);
  if (!owner) return;

  await queueNotification({
    organizationId: orgId,
    userId: owner.id,
    type: 'ropa.retention.due',
    title: `${created} record${created === 1 ? '' : 's'} due for disposal`,
    body: 'The retention period has elapsed on activities in your register. Nothing has been deleted — record what was disposed of, and how.',
    actionUrl: '/ropa/retention',
  });
}

// ---------------------------------------------------------------------------
// P123 — the daily completeness snapshot
// ---------------------------------------------------------------------------

/**
 * One row per organisation per day.
 *
 * Recomputed from `scoreActivity` rather than read off `completeness_score`, and
 * that is deliberate even though the stored column exists: the snapshot's value is
 * `by_requirement` — *which* requirements are unmet across the register — and the
 * denormalised integer cannot answer that. It is one nightly pass over a register,
 * not a per-request cost.
 *
 * Idempotent through the UNIQUE on (org, day): a re-run on the same date updates
 * rather than inserting a second point on the graph.
 */
async function snapshotCompleteness(orgId?: string) {
  if (!orgId) return { skipped: true, reason: 'No organisation' };

  const activities = await db.select().from(processingActivities).where(and(
    eq(processingActivities.organizationId, orgId),
    isNull(processingActivities.deletedAt),
  ));

  if (activities.length === 0) return { skipped: true, reason: 'Empty register' };

  const ids = activities.map((a: any) => a.id);
  const [subjects, categories, recipients, transfers, lias] = await Promise.all([
    db.select().from(processingDataSubjects).where(inArray(processingDataSubjects.processingActivityId, ids)),
    db.select().from(processingDataCategories).where(inArray(processingDataCategories.processingActivityId, ids)),
    db.select().from(processingRecipients).where(inArray(processingRecipients.processingActivityId, ids)),
    db.select().from(processingTransfers).where(inArray(processingTransfers.processingActivityId, ids)),
    db.select().from(legitimateInterestAssessments).where(and(
      inArray(legitimateInterestAssessments.processingActivityId, ids),
      ne(legitimateInterestAssessments.status, 'superseded'),
    )),
  ]);

  const group = <T extends { processingActivityId: string }>(rows: T[]) => {
    const out = new Map<string, T[]>();
    for (const row of rows) {
      const list = out.get(row.processingActivityId) ?? [];
      list.push(row);
      out.set(row.processingActivityId, list);
    }
    return out;
  };

  const bySubject = group(subjects as any[]);
  const byCategory = group(categories as any[]);
  const byRecipient = group(recipients as any[]);
  const byTransfer = group(transfers as any[]);
  const byLia = group(lias as any[]);

  let scoreTotal = 0;
  let blocked = 0;
  let activeCount = 0;
  const bands = { low: 0, medium: 0, high: 0 };
  const byRequirement: Record<string, number> = {};

  for (const activity of activities as any[]) {
    const lia = (byLia.get(activity.id) ?? [])[0];
    const bundle: ActivityBundle = {
      activity,
      dataSubjects: bySubject.get(activity.id) ?? [],
      dataCategories: byCategory.get(activity.id) ?? [],
      recipients: byRecipient.get(activity.id) ?? [],
      transfers: byTransfer.get(activity.id) ?? [],
      lia: lia ? { status: lia.status, outcome: lia.outcome } : null,
    };

    const { score, missing, blockers } = scoreActivity(bundle);
    scoreTotal += score;
    if (activity.status === 'active') activeCount += 1;
    if (blockers.length > 0) blocked += 1;

    const band = score < COMPLETENESS_BANDS.medium.min ? 'low'
      : score < COMPLETENESS_BANDS.high.min ? 'medium' : 'high';
    bands[band] += 1;

    for (const requirement of missing) {
      byRequirement[requirement.id] = (byRequirement[requirement.id] ?? 0) + 1;
    }
  }

  const capturedOn = new Date().toISOString().slice(0, 10);
  const values = {
    organizationId: orgId,
    capturedOn,
    activityCount: activities.length,
    activeCount,
    averageScore: Math.round(scoreTotal / activities.length),
    blockedCount: blocked,
    bands: bands as any,
    byRequirement: byRequirement as any,
  };

  await db.insert(ropaCompletenessSnapshots).values(values)
    .onConflictDoUpdate({
      target: [ropaCompletenessSnapshots.organizationId, ropaCompletenessSnapshots.capturedOn],
      set: {
        activityCount: values.activityCount,
        activeCount: values.activeCount,
        averageScore: values.averageScore,
        blockedCount: values.blockedCount,
        bands: values.bands,
        byRequirement: values.byRequirement,
      },
    });

  return { capturedOn, averageScore: values.averageScore, activities: activities.length };
}
