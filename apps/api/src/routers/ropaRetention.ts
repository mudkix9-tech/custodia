/**
 * E47–E52. Retention schedules, the review queue, the disposal log and legal holds.
 *
 * Mounted under `ropa.retention` rather than added to `routers/ropa.ts`, which is
 * already 4,800 lines: a reader looking for "why did this record not get deleted"
 * should land in a file about retention, not scroll past nine tabs' worth of
 * register CRUD to reach it.
 *
 * Tenancy: `retention_schedules`, `legal_holds` and `retention_disposals` all carry
 * `organization_id`, so every read and write here filters on it directly. The one
 * exception is `legal_hold_activities`, which does not — it proves ownership through
 * the hold, via `assertOwned`.
 */

import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import {
  retentionSchedules,
  legalHolds,
  legalHoldActivities,
  retentionDisposals,
  processingActivities,
  processingDataCategories,
  users,
} from 'db';
import { and, eq, desc, asc, inArray, isNull, isNotNull, lt, lte, sql, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { assertOwned } from '../lib/tenancy.js';
import DOMPurify from 'isomorphic-dompurify';
import {
  RETENTION_PERIOD_UNITS,
  RETENTION_TRIGGER_EVENTS,
  DISPOSAL_METHODS,
  RETENTION_SCHEDULE_STATUSES,
  LEGAL_HOLD_TYPES,
} from '../constants/retentionVocabularies.js';
import {
  computeDisposalDate,
  disposalDueKey,
  holdIsActive,
  nextScheduleReview,
  retentionAnswer,
  validateSchedule,
} from '../lib/retention.js';

const sanitize = (text?: string | null) => (text ? DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }) : text);

const scheduleInput = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).nullish(),
  periodValue: z.number().int().min(0).max(1000).nullish(),
  periodUnit: z.enum(RETENTION_PERIOD_UNITS),
  trigger: z.enum(RETENTION_TRIGGER_EVENTS),
  triggerDetail: z.string().max(2000).nullish(),
  statutoryCitation: z.string().max(255).nullish(),
  jurisdiction: z.string().length(2).nullish(),
  justification: z.string().max(4000).nullish(),
  disposalMethod: z.enum(DISPOSAL_METHODS),
  ownerId: z.string().uuid().nullish(),
  reviewIntervalMonths: z.number().int().min(0).max(120).nullish(),
  status: z.enum(RETENTION_SCHEDULE_STATUSES).default('active'),
});

/**
 * An owner id is client-supplied and `users` is not org-scoped by the table, so a
 * schedule could otherwise be pointed at a stranger — the same class as B18's
 * activity owners, and the same NOT_FOUND rather than FORBIDDEN.
 */
async function assertOwnerInOrg(dbc: any, orgId: string, ownerId?: string | null) {
  if (!ownerId) return;
  const [found] = await dbc.select({ id: users.id }).from(users)
    .where(and(eq(users.id, ownerId), eq(users.organizationId, orgId)));
  if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });
}

/** Client-supplied activity ids, proved to belong to the caller's organisation. */
async function assertActivitiesInOrg(dbc: any, orgId: string, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const found = await dbc.select({ id: processingActivities.id }).from(processingActivities)
    .where(and(inArray(processingActivities.id, unique), eq(processingActivities.organizationId, orgId)));
  if (found.length !== unique.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
}

export const ropaRetentionRouter = router({
  // -------------------------------------------------------------------------
  // E47 — schedules
  // -------------------------------------------------------------------------
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      status: z.enum([...RETENTION_SCHEDULE_STATUSES, 'all']).default('all'),
      includeArchived: z.boolean().default(false),
      reviewOverdue: z.boolean().default(false),
    }).default({ status: 'all', includeArchived: false, reviewOverdue: false }))
    .query(async ({ ctx, input }) => {
      const filters: any[] = [eq(retentionSchedules.organizationId, ctx.user!.orgId)];
      if (!input.includeArchived) filters.push(isNull(retentionSchedules.archivedAt));
      if (input.status !== 'all') filters.push(eq(retentionSchedules.status, input.status));
      if (input.reviewOverdue) {
        filters.push(isNotNull(retentionSchedules.nextReviewAt));
        filters.push(lt(retentionSchedules.nextReviewAt, new Date()));
      }

      const rows = await ctx.db.select().from(retentionSchedules)
        .where(and(...filters))
        .orderBy(asc(retentionSchedules.name));

      // How many activities and categories each schedule governs. Counted in two
      // grouped queries rather than per row: a register with sixty schedules would
      // otherwise open the page with a hundred and twenty round trips.
      const ids = rows.map((r: any) => r.id);
      const [activityCounts, categoryCounts] = ids.length === 0
        ? [[], []]
        : await Promise.all([
          ctx.db.select({ id: processingActivities.retentionScheduleId, n: count() })
            .from(processingActivities)
            .where(and(
              eq(processingActivities.organizationId, ctx.user!.orgId),
              inArray(processingActivities.retentionScheduleId, ids),
              isNull(processingActivities.deletedAt),
            ))
            .groupBy(processingActivities.retentionScheduleId),
          ctx.db.select({ id: processingDataCategories.retentionScheduleId, n: count() })
            .from(processingDataCategories)
            .innerJoin(processingActivities, eq(processingDataCategories.processingActivityId, processingActivities.id))
            .where(and(
              eq(processingActivities.organizationId, ctx.user!.orgId),
              inArray(processingDataCategories.retentionScheduleId, ids),
            ))
            .groupBy(processingDataCategories.retentionScheduleId),
        ]);

      const byActivity = new Map(activityCounts.map((r: any) => [r.id, Number(r.n)]));
      const byCategory = new Map(categoryCounts.map((r: any) => [r.id, Number(r.n)]));

      return rows.map((row: any) => ({
        ...row,
        activityCount: byActivity.get(row.id) ?? 0,
        categoryCount: byCategory.get(row.id) ?? 0,
        issues: validateSchedule(row),
        answer: retentionAnswer({ schedule: row }),
      }));
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(retentionSchedules).where(and(
        eq(retentionSchedules.id, input.id),
        eq(retentionSchedules.organizationId, ctx.user!.orgId),
      ));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      const activities = await ctx.db.select({
        id: processingActivities.id,
        name: processingActivities.name,
        status: processingActivities.status,
        retentionAnchorAt: processingActivities.retentionAnchorAt,
      }).from(processingActivities).where(and(
        eq(processingActivities.organizationId, ctx.user!.orgId),
        eq(processingActivities.retentionScheduleId, input.id),
        isNull(processingActivities.deletedAt),
      )).orderBy(asc(processingActivities.name));

      return {
        ...row,
        activities,
        issues: validateSchedule(row),
        answer: retentionAnswer({ schedule: row }),
      };
    }),

  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(scheduleInput)
    .mutation(async ({ ctx, input }) => {
      await assertOwnerInOrg(ctx.db, ctx.user!.orgId, input.ownerId);

      const now = new Date();
      const [row] = await ctx.db.insert(retentionSchedules).values({
        organizationId: ctx.user!.orgId,
        name: sanitize(input.name)!,
        description: sanitize(input.description) ?? null,
        // An uncounted unit carries no number, whatever the form sent. Storing
        // "indefinite, 7" would be a contradiction the report has to re-litigate
        // every time it reads the row.
        periodValue: input.periodUnit === 'indefinite' || input.periodUnit === 'until_event' ? null : input.periodValue ?? null,
        periodUnit: input.periodUnit,
        trigger: input.trigger,
        triggerDetail: sanitize(input.triggerDetail) ?? null,
        statutoryCitation: sanitize(input.statutoryCitation) ?? null,
        jurisdiction: input.jurisdiction?.toUpperCase() ?? null,
        justification: sanitize(input.justification) ?? null,
        disposalMethod: input.disposalMethod,
        ownerId: input.ownerId ?? null,
        reviewIntervalMonths: input.reviewIntervalMonths ?? null,
        nextReviewAt: nextScheduleReview(now, input.reviewIntervalMonths),
        status: input.status,
        createdBy: ctx.user!.id,
      }).returning();

      return row;
    }),

  update: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid(), data: scheduleInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(retentionSchedules).where(and(
        eq(retentionSchedules.id, input.id),
        eq(retentionSchedules.organizationId, ctx.user!.orgId),
      ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      await assertOwnerInOrg(ctx.db, ctx.user!.orgId, input.data.ownerId);

      const unit = input.data.periodUnit ?? existing.periodUnit;
      const patch: Record<string, any> = { ...input.data, updatedAt: new Date() };
      if (patch.name) patch.name = sanitize(patch.name);
      if (patch.jurisdiction) patch.jurisdiction = String(patch.jurisdiction).toUpperCase();
      if (unit === 'indefinite' || unit === 'until_event') patch.periodValue = null;
      if (input.data.reviewIntervalMonths !== undefined) {
        patch.nextReviewAt = nextScheduleReview(existing.lastReviewedAt ?? new Date(), input.data.reviewIntervalMonths);
      }

      const [row] = await ctx.db.update(retentionSchedules)
        .set(patch)
        .where(and(
          eq(retentionSchedules.id, input.id),
          eq(retentionSchedules.organizationId, ctx.user!.orgId),
        ))
        .returning();

      return row;
    }),

  /** E50. Confirming a schedule is still right is the act the review date exists for. */
  attest: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid(), note: z.string().max(2000).nullish() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(retentionSchedules).where(and(
        eq(retentionSchedules.id, input.id),
        eq(retentionSchedules.organizationId, ctx.user!.orgId),
      ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      const now = new Date();
      const [row] = await ctx.db.update(retentionSchedules)
        .set({
          lastReviewedAt: now,
          nextReviewAt: nextScheduleReview(now, existing.reviewIntervalMonths),
          updatedAt: now,
        })
        .where(and(
          eq(retentionSchedules.id, input.id),
          eq(retentionSchedules.organizationId, ctx.user!.orgId),
        ))
        .returning();
      return row;
    }),

  archive: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Archived, never deleted, and the activities keep pointing at it. A schedule
      // is the evidence for a retention decision that has already been acted on;
      // removing it would make every disposal already logged under it unexplainable.
      const [row] = await ctx.db.update(retentionSchedules)
        .set({ archivedAt: new Date(), status: 'retired', updatedAt: new Date() })
        .where(and(
          eq(retentionSchedules.id, input.id),
          eq(retentionSchedules.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      return row;
    }),

  /** E47. Attach a schedule to an activity, or to one of its data categories. */
  attach: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      scheduleId: z.string().uuid().nullable(),
      activityId: z.string().uuid().optional(),
      dataCategoryId: z.string().uuid().optional(),
      /** E48. When the trigger event happened, where the caller knows. */
      anchorAt: z.coerce.date().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.activityId && !input.dataCategoryId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name an activity or a data category' });
      }

      if (input.scheduleId) {
        const [schedule] = await ctx.db.select({ id: retentionSchedules.id }).from(retentionSchedules).where(and(
          eq(retentionSchedules.id, input.scheduleId),
          eq(retentionSchedules.organizationId, ctx.user!.orgId),
        ));
        if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      }

      if (input.activityId) {
        await assertActivitiesInOrg(ctx.db, ctx.user!.orgId, [input.activityId]);
        await ctx.db.update(processingActivities)
          .set({
            retentionScheduleId: input.scheduleId,
            ...(input.anchorAt !== undefined ? { retentionAnchorAt: input.anchorAt } : {}),
            updatedAt: new Date(),
          })
          .where(and(
            eq(processingActivities.id, input.activityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));
      }

      if (input.dataCategoryId) {
        // The child table carries no organization_id, so ownership walks up to the
        // activity — the case `src/lib/tenancy.ts` exists for.
        await assertOwned(ctx.db, {
          table: processingDataCategories,
          id: input.dataCategoryId,
          orgId: ctx.user!.orgId,
          label: 'Data category',
          via: [{ table: processingActivities, on: eq(processingDataCategories.processingActivityId, processingActivities.id) }],
        });
        await ctx.db.update(processingDataCategories)
          .set({ retentionScheduleId: input.scheduleId, updatedAt: new Date() })
          .where(eq(processingDataCategories.id, input.dataCategoryId));
      }

      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // E50/E51 — the queues
  // -------------------------------------------------------------------------

  /**
   * E50. Everything whose retention needs looking at, in one answer.
   *
   * Three separate queues would be three screens nobody checks. An overdue
   * schedule, an activity whose retention review date has passed and a disposal
   * that has come due are all "retention needs a decision today", and the person
   * making it is the same person.
   */
  queue: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      const now = new Date();
      const orgId = ctx.user!.orgId;

      const [schedulesDue, activitiesDue, disposalsDue, holds] = await Promise.all([
        ctx.db.select().from(retentionSchedules).where(and(
          eq(retentionSchedules.organizationId, orgId),
          eq(retentionSchedules.status, 'active'),
          isNull(retentionSchedules.archivedAt),
          isNotNull(retentionSchedules.nextReviewAt),
          lte(retentionSchedules.nextReviewAt, now),
        )).orderBy(asc(retentionSchedules.nextReviewAt)),

        // D20. `retention_review_date` has had zero readers since it was added —
        // no reminder, no overdue list, no notification. This is the reader.
        ctx.db.select({
          id: processingActivities.id,
          name: processingActivities.name,
          status: processingActivities.status,
          retentionReviewDate: processingActivities.retentionReviewDate,
          retentionPeriod: processingActivities.retentionPeriod,
        }).from(processingActivities).where(and(
          eq(processingActivities.organizationId, orgId),
          isNull(processingActivities.deletedAt),
          isNotNull(processingActivities.retentionReviewDate),
          lte(processingActivities.retentionReviewDate, now),
        )).orderBy(asc(processingActivities.retentionReviewDate)),

        ctx.db.select({
          disposal: retentionDisposals,
          activityName: processingActivities.name,
          scheduleName: retentionSchedules.name,
        })
          .from(retentionDisposals)
          .innerJoin(processingActivities, eq(retentionDisposals.processingActivityId, processingActivities.id))
          .leftJoin(retentionSchedules, eq(retentionDisposals.retentionScheduleId, retentionSchedules.id))
          .where(and(
            eq(retentionDisposals.organizationId, orgId),
            inArray(retentionDisposals.status, ['due', 'on_hold']),
            lte(retentionDisposals.dueAt, now),
          ))
          .orderBy(asc(retentionDisposals.dueAt))
          .limit(200),

        ctx.db.select().from(legalHolds).where(and(
          eq(legalHolds.organizationId, orgId),
          eq(legalHolds.status, 'active'),
        )),
      ]);

      const activeHolds = holds.filter((h: any) => holdIsActive(h, now));

      return {
        schedulesDue,
        activitiesDue,
        disposalsDue: disposalsDue.map((r: any) => ({
          ...r.disposal,
          activityName: r.activityName,
          scheduleName: r.scheduleName,
        })),
        activeHolds,
        counts: {
          schedules: schedulesDue.length,
          activities: activitiesDue.length,
          disposals: disposalsDue.length,
          holds: activeHolds.length,
        },
      };
    }),

  /**
   * E51. The records-due-for-deletion report, computed live.
   *
   * Live rather than read from `retention_disposals`, because the report answers
   * "what would be due if we ran this today" and the table answers "what has been
   * logged". They differ the moment somebody changes a schedule, and the difference
   * is the point — the report is what the nightly scan is *about* to write.
   */
  dueReport: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ horizonDays: z.number().int().min(0).max(3650).default(90) }).default({ horizonDays: 90 }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const now = new Date();
      const horizon = new Date(now.getTime() + input.horizonDays * 24 * 60 * 60 * 1000);

      const [rows, heldActivityIds] = await Promise.all([
        ctx.db.select({
          activity: processingActivities,
          schedule: retentionSchedules,
        })
          .from(processingActivities)
          .leftJoin(retentionSchedules, eq(processingActivities.retentionScheduleId, retentionSchedules.id))
          .where(and(
            eq(processingActivities.organizationId, orgId),
            isNull(processingActivities.deletedAt),
            eq(processingActivities.status, 'active'),
          )),
        activeHoldActivityIds(ctx.db, orgId, now),
      ]);

      const due: any[] = [];
      const blocked: any[] = [];
      const unresolvable: any[] = [];

      for (const row of rows) {
        const { dueAt, reason, period } = computeDisposalDate({
          schedule: row.schedule,
          freeText: row.activity.retentionPeriod,
          anchorAt: row.activity.retentionAnchorAt,
          createdAt: row.activity.createdAt,
        });

        const entry = {
          activityId: row.activity.id,
          activityName: row.activity.name,
          scheduleId: row.schedule?.id ?? null,
          scheduleName: row.schedule?.name ?? null,
          period: period.label,
          periodSource: period.source,
          trigger: row.schedule?.trigger ?? null,
          disposalMethod: row.schedule?.disposalMethod ?? null,
          dueAt,
          reason,
        };

        if (reason !== 'computed' || !dueAt) { unresolvable.push(entry); continue; }
        if (dueAt > horizon) continue;
        if (heldActivityIds.has(row.activity.id)) { blocked.push(entry); continue; }
        due.push(entry);
      }

      due.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
      return { due, blocked, unresolvable, horizonDays: input.horizonDays };
    }),

  // -------------------------------------------------------------------------
  // E51 — the disposal log
  // -------------------------------------------------------------------------
  disposals: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        activityId: z.string().uuid().optional(),
        status: z.enum(['due', 'completed', 'deferred', 'on_hold', 'not_required', 'all']).default('all'),
        limit: z.number().int().min(1).max(200).default(50),
      }).default({ status: 'all', limit: 50 }))
      .query(async ({ ctx, input }) => {
        const filters: any[] = [eq(retentionDisposals.organizationId, ctx.user!.orgId)];
        if (input.activityId) filters.push(eq(retentionDisposals.processingActivityId, input.activityId));
        if (input.status !== 'all') filters.push(eq(retentionDisposals.status, input.status));

        const rows = await ctx.db.select({
          disposal: retentionDisposals,
          activityName: processingActivities.name,
          scheduleName: retentionSchedules.name,
          performedByName: users.name,
        })
          .from(retentionDisposals)
          .innerJoin(processingActivities, eq(retentionDisposals.processingActivityId, processingActivities.id))
          .leftJoin(retentionSchedules, eq(retentionDisposals.retentionScheduleId, retentionSchedules.id))
          .leftJoin(users, eq(retentionDisposals.performedBy, users.id))
          .where(and(...filters))
          .orderBy(desc(retentionDisposals.dueAt))
          .limit(input.limit);

        return rows.map((r: any) => ({
          ...r.disposal,
          activityName: r.activityName,
          scheduleName: r.scheduleName,
          performedByName: r.performedByName,
        }));
      }),

    /**
     * E51. Recording that a disposal actually happened, with the evidence.
     *
     * The evidence is the whole point. "We delete after seven years" is a policy;
     * "the deletion ran on 3 March across these four systems over 12,400 records,
     * and here is the ticket" is the thing a supervisory authority asks for and no
     * spreadsheet can hold.
     */
    complete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        method: z.enum(DISPOSAL_METHODS),
        recordCount: z.number().int().min(0).max(1_000_000_000).nullish(),
        systems: z.array(z.string().min(1).max(160)).max(30).default([]),
        evidence: z.array(z.object({
          id: z.string().max(60),
          name: z.string().max(255),
          url: z.string().max(1000).nullish(),
          note: z.string().max(1000).nullish(),
        })).max(20).default([]),
        note: z.string().max(4000).nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [row] = await ctx.db.update(retentionDisposals)
          .set({
            status: 'completed',
            method: input.method,
            recordCount: input.recordCount ?? null,
            systems: input.systems,
            evidence: input.evidence,
            note: sanitize(input.note) ?? null,
            performedAt: new Date(),
            performedBy: ctx.user!.id,
            updatedAt: new Date(),
          })
          .where(and(
            eq(retentionDisposals.id, input.id),
            eq(retentionDisposals.organizationId, ctx.user!.orgId),
          ))
          .returning();
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Disposal not found' });
        return row;
      }),

    /** A disposal put off, with a reason and a date. Not the same thing as ignored. */
    defer: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        deferredUntil: z.coerce.date(),
        reason: z.string().min(10).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const [row] = await ctx.db.update(retentionDisposals)
          .set({
            status: 'deferred',
            deferredUntil: input.deferredUntil,
            deferralReason: sanitize(input.reason) ?? null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(retentionDisposals.id, input.id),
            eq(retentionDisposals.organizationId, ctx.user!.orgId),
          ))
          .returning();
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Disposal not found' });
        return row;
      }),

    /** A disposal recorded by hand, outside the schedule's clock. */
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        activityId: z.string().uuid(),
        dueAt: z.coerce.date(),
        method: z.enum(DISPOSAL_METHODS).nullish(),
        note: z.string().max(4000).nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertActivitiesInOrg(ctx.db, ctx.user!.orgId, [input.activityId]);
        const [row] = await ctx.db.insert(retentionDisposals).values({
          organizationId: ctx.user!.orgId,
          processingActivityId: input.activityId,
          dueAt: input.dueAt,
          // Hand-created rows key off the id rather than a schedule clock, so the
          // nightly scan's upsert can never collide with one.
          dueKey: `manual:${Date.now()}`,
          status: 'due',
          method: input.method ?? null,
          note: sanitize(input.note) ?? null,
        }).returning();
        return row;
      }),
  }),

  // -------------------------------------------------------------------------
  // E52 — legal holds
  // -------------------------------------------------------------------------
  holds: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ status: z.enum(['active', 'released', 'expired', 'all']).default('active') }).default({ status: 'active' }))
      .query(async ({ ctx, input }) => {
        const filters: any[] = [eq(legalHolds.organizationId, ctx.user!.orgId)];
        if (input.status !== 'all') filters.push(eq(legalHolds.status, input.status));

        const rows = await ctx.db.select().from(legalHolds)
          .where(and(...filters))
          .orderBy(desc(legalHolds.issuedAt));

        const ids = rows.map((r: any) => r.id);
        const scopes = ids.length === 0 ? [] : await ctx.db.select({
          legalHoldId: legalHoldActivities.legalHoldId,
          activityId: legalHoldActivities.processingActivityId,
          activityName: processingActivities.name,
        })
          .from(legalHoldActivities)
          .innerJoin(processingActivities, eq(legalHoldActivities.processingActivityId, processingActivities.id))
          .where(inArray(legalHoldActivities.legalHoldId, ids));

        const now = new Date();
        return rows.map((row: any) => ({
          ...row,
          // Evaluated rather than trusted: a hold whose expiry has passed and which
          // nobody released is not suspending anything, and showing it as active is
          // how a register stops deleting altogether without anyone deciding to.
          effectivelyActive: holdIsActive(row, now),
          activities: scopes.filter((s: any) => s.legalHoldId === row.id).map((s: any) => ({ id: s.activityId, name: s.activityName })),
        }));
      }),

    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        reference: z.string().min(1).max(120),
        reason: z.string().min(10).max(4000),
        holdType: z.enum(LEGAL_HOLD_TYPES).default('litigation'),
        ownerId: z.string().uuid().nullish(),
        expiresAt: z.coerce.date().nullish(),
        nextReviewAt: z.coerce.date().nullish(),
        activityIds: z.array(z.string().uuid()).max(500).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnerInOrg(ctx.db, ctx.user!.orgId, input.ownerId);
        await assertActivitiesInOrg(ctx.db, ctx.user!.orgId, input.activityIds);

        const [hold] = await ctx.db.insert(legalHolds).values({
          organizationId: ctx.user!.orgId,
          reference: sanitize(input.reference)!,
          reason: sanitize(input.reason)!,
          holdType: input.holdType,
          ownerId: input.ownerId ?? null,
          expiresAt: input.expiresAt ?? null,
          nextReviewAt: input.nextReviewAt ?? null,
          status: 'active',
          createdBy: ctx.user!.id,
        }).returning();

        if (hold && input.activityIds.length > 0) {
          await ctx.db.insert(legalHoldActivities).values(
            input.activityIds.map((processingActivityId) => ({ legalHoldId: hold.id, processingActivityId })),
          ).onConflictDoNothing();

          // Anything already due under this activity stops being due. Leaving the
          // row at 'due' would leave someone a work item they must not action,
          // which is the failure mode a hold exists to prevent.
          await ctx.db.update(retentionDisposals)
            .set({ status: 'on_hold', legalHoldId: hold.id, updatedAt: new Date() })
            .where(and(
              eq(retentionDisposals.organizationId, ctx.user!.orgId),
              eq(retentionDisposals.status, 'due'),
              inArray(retentionDisposals.processingActivityId, input.activityIds),
            ));
        }

        return hold;
      }),

    addActivities: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ holdId: z.string().uuid(), activityIds: z.array(z.string().uuid()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const [hold] = await ctx.db.select({ id: legalHolds.id }).from(legalHolds).where(and(
          eq(legalHolds.id, input.holdId),
          eq(legalHolds.organizationId, ctx.user!.orgId),
        ));
        if (!hold) throw new TRPCError({ code: 'NOT_FOUND', message: 'Hold not found' });
        await assertActivitiesInOrg(ctx.db, ctx.user!.orgId, input.activityIds);

        await ctx.db.insert(legalHoldActivities).values(
          input.activityIds.map((processingActivityId) => ({ legalHoldId: input.holdId, processingActivityId })),
        ).onConflictDoNothing();

        await ctx.db.update(retentionDisposals)
          .set({ status: 'on_hold', legalHoldId: input.holdId, updatedAt: new Date() })
          .where(and(
            eq(retentionDisposals.organizationId, ctx.user!.orgId),
            eq(retentionDisposals.status, 'due'),
            inArray(retentionDisposals.processingActivityId, input.activityIds),
          ));

        return { success: true };
      }),

    removeActivity: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ holdId: z.string().uuid(), activityId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // Two proofs, and they answer different questions. `assertOwned` is what
        // turns "not yours" into a NOT_FOUND rather than a silent no-op; the
        // subquery is what makes the *statement* carry its own scope, which is the
        // property pass 2 of the tenancy guard checks and the one `tia.save` did
        // not have when it rewrote every tenant's transfer rows.
        await assertOwned(ctx.db, {
          table: legalHolds,
          id: input.holdId,
          orgId: ctx.user!.orgId,
          label: 'Hold',
        });
        await ctx.db.delete(legalHoldActivities).where(and(
          eq(legalHoldActivities.legalHoldId, input.holdId),
          eq(legalHoldActivities.processingActivityId, input.activityId),
          inArray(
            legalHoldActivities.legalHoldId,
            ctx.db.select({ id: legalHolds.id }).from(legalHolds)
              .where(eq(legalHolds.organizationId, ctx.user!.orgId)),
          ),
        ));
        return { success: true };
      }),

    release: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid(), note: z.string().max(2000).nullish() }))
      .mutation(async ({ ctx, input }) => {
        const [hold] = await ctx.db.update(legalHolds)
          .set({
            status: 'released',
            releasedAt: new Date(),
            releasedBy: ctx.user!.id,
            releaseNote: sanitize(input.note) ?? null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(legalHolds.id, input.id),
            eq(legalHolds.organizationId, ctx.user!.orgId),
          ))
          .returning();
        if (!hold) throw new TRPCError({ code: 'NOT_FOUND', message: 'Hold not found' });

        // Releasing does not silently delete anything. The suspended disposals go
        // back to 'due' and reappear in the queue, where a person decides.
        await ctx.db.update(retentionDisposals)
          .set({ status: 'due', legalHoldId: null, updatedAt: new Date() })
          .where(and(
            eq(retentionDisposals.organizationId, ctx.user!.orgId),
            eq(retentionDisposals.legalHoldId, input.id),
            eq(retentionDisposals.status, 'on_hold'),
          ));

        return hold;
      }),
  }),
});

/** Activity ids covered by a hold that is genuinely in force right now. */
async function activeHoldActivityIds(dbc: any, orgId: string, now: Date): Promise<Set<string>> {
  const rows = await dbc.select({
    activityId: legalHoldActivities.processingActivityId,
    status: legalHolds.status,
    expiresAt: legalHolds.expiresAt,
    releasedAt: legalHolds.releasedAt,
  })
    .from(legalHoldActivities)
    .innerJoin(legalHolds, eq(legalHoldActivities.legalHoldId, legalHolds.id))
    .where(and(eq(legalHolds.organizationId, orgId), eq(legalHolds.status, 'active')));

  return new Set(rows.filter((r: any) => holdIsActive(r, now)).map((r: any) => r.activityId));
}
