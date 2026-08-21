/**
 * C32/C33. Delegated intake — the questionnaire that populates the register from
 * the people who actually know what the processing does.
 *
 * The read path for a respondent is a `publicProcedure` keyed on an unguessable
 * token, exactly as `vendors.submitQuestionnaireAnswers` is: the recipient has no
 * Custodia account and never will, so the token *is* the access control. Both of
 * those procedures are in the tenancy guard's allowlist for that reason.
 *
 * Everything a reviewer does is org-scoped in the ordinary way, and the merge is
 * field by field. Nothing a respondent sends reaches the register without somebody
 * with `ropa:edit` accepting it — a department head who can edit the Article 30
 * record directly is not delegated intake, it is an unreviewed register with more
 * authors.
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure, requirePermission } from '../trpc.js';
import {
  ropaIntakeRequests,
  processingActivities,
  processingDataSubjects,
  processingDataCategories,
  processingRecipients,
  organizations,
  users,
} from 'db';
import { and, eq, desc, inArray, isNull, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import DOMPurify from 'isomorphic-dompurify';
import { queueNotification } from '../utils/notifications.js';
import {
  questionSetFor,
  mapAnswersToFields,
  responseCompleteness,
  type IntakeQuestion,
} from '../lib/ropaIntake.js';

const sanitize = (text?: string | null) => (text ? DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }) : text);

/** Fourteen days, unless the caller says otherwise — long enough to be forwarded once. */
const DEFAULT_DUE_DAYS = 14;
/** A token that never expires is a permanent unauthenticated door into an org's register. */
const DEFAULT_EXPIRY_DAYS = 60;

const INTAKE_STATUSES = ['draft', 'sent', 'opened', 'submitted', 'merged', 'declined', 'cancelled', 'expired'] as const;

export const ropaIntakeRouter = router({
  // -------------------------------------------------------------------------
  // Reviewer side
  // -------------------------------------------------------------------------
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      status: z.enum([...INTAKE_STATUSES, 'all', 'outstanding']).default('all'),
      activityId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).default({ status: 'all', limit: 50 }))
    .query(async ({ ctx, input }) => {
      const filters: any[] = [eq(ropaIntakeRequests.organizationId, ctx.user!.orgId)];
      if (input.activityId) filters.push(eq(ropaIntakeRequests.processingActivityId, input.activityId));
      if (input.status === 'outstanding') {
        filters.push(inArray(ropaIntakeRequests.status, ['sent', 'opened']));
      } else if (input.status !== 'all') {
        filters.push(eq(ropaIntakeRequests.status, input.status));
      }

      const rows = await ctx.db.select({
        request: ropaIntakeRequests,
        activityName: processingActivities.name,
        createdByName: users.name,
      })
        .from(ropaIntakeRequests)
        .leftJoin(processingActivities, eq(ropaIntakeRequests.processingActivityId, processingActivities.id))
        .leftJoin(users, eq(ropaIntakeRequests.createdBy, users.id))
        .where(and(...filters))
        .orderBy(desc(ropaIntakeRequests.createdAt))
        .limit(input.limit);

      return rows.map((r: any) => {
        const questions = (r.request.questions ?? []) as IntakeQuestion[];
        const answers = (r.request.answers ?? {}) as Record<string, unknown>;
        return {
          ...r.request,
          // The token is never returned to the reviewer list. Anyone holding it can
          // answer as the recipient, so it travels in the email and nowhere else.
          token: undefined,
          activityName: r.activityName,
          createdByName: r.createdByName,
          progress: responseCompleteness(questions, answers),
        };
      });
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(ropaIntakeRequests).where(and(
        eq(ropaIntakeRequests.id, input.id),
        eq(ropaIntakeRequests.organizationId, ctx.user!.orgId),
      ));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });

      const questions = (row.questions ?? []) as IntakeQuestion[];
      const answers = (row.answers ?? {}) as Record<string, unknown>;

      return {
        ...row,
        token: undefined,
        progress: responseCompleteness(questions, answers),
        // The merge candidates are computed on read rather than stored, so a change
        // to the mapping applies to responses already sitting in the queue.
        candidates: mapAnswersToFields(questions, answers),
      };
    }),

  /**
   * Creates the request and freezes the question set onto it.
   *
   * Frozen rather than resolved at read time because a questionnaire that changes
   * under a half-finished response is a response that answers questions nobody
   * asked — and the merge screen has to be able to show the reviewer what was
   * actually put to the respondent.
   */
  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      kind: z.enum(['interview', 'review', 'update']).default('interview'),
      processingActivityId: z.string().uuid().nullish(),
      recipientEmail: z.string().email().max(255),
      recipientName: z.string().max(160).nullish(),
      department: z.string().max(120).nullish(),
      subject: z.string().max(255).nullish(),
      message: z.string().max(4000).nullish(),
      locale: z.enum(['en', 'de', 'fr']).default('en'),
      dueInDays: z.number().int().min(1).max(120).default(DEFAULT_DUE_DAYS),
      send: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.processingActivityId) {
        const [activity] = await ctx.db.select({ id: processingActivities.id }).from(processingActivities).where(and(
          eq(processingActivities.id, input.processingActivityId),
          eq(processingActivities.organizationId, ctx.user!.orgId),
        ));
        if (!activity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
      }

      const set = questionSetFor(input.kind);
      const now = new Date();
      const dueAt = new Date(now.getTime() + input.dueInDays * 24 * 60 * 60 * 1000);

      const [row] = await ctx.db.insert(ropaIntakeRequests).values({
        organizationId: ctx.user!.orgId,
        processingActivityId: input.processingActivityId ?? null,
        kind: input.kind,
        recipientEmail: input.recipientEmail.toLowerCase(),
        recipientName: sanitize(input.recipientName) ?? null,
        department: sanitize(input.department) ?? null,
        subject: sanitize(input.subject) ?? set.title,
        message: sanitize(input.message) ?? null,
        locale: input.locale,
        questions: set.questions as any,
        answers: {},
        status: input.send ? 'sent' : 'draft',
        dueAt,
        expiresAt: new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        sentAt: input.send ? now : null,
        createdBy: ctx.user!.id,
      }).returning();

      if (row && input.send) await sendIntakeEmail(ctx.db, row);
      return { ...row, token: undefined };
    }),

  send: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(ropaIntakeRequests)
        .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(ropaIntakeRequests.id, input.id),
          eq(ropaIntakeRequests.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      await sendIntakeEmail(ctx.db, row);
      return { ...row, token: undefined };
    }),

  remind: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(ropaIntakeRequests)
        .set({
          remindersSent: sql`${ropaIntakeRequests.remindersSent} + 1`,
          lastReminderAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(ropaIntakeRequests.id, input.id),
          eq(ropaIntakeRequests.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      await sendIntakeEmail(ctx.db, row, true);
      return { success: true };
    }),

  cancel: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(ropaIntakeRequests)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(
          eq(ropaIntakeRequests.id, input.id),
          eq(ropaIntakeRequests.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      return { success: true };
    }),

  /**
   * C33. The merge — field by field, into a new activity or an existing one.
   *
   * `accept` names the question ids the reviewer took, so a response is merged in
   * as many passes as the reviewer wants and the request records which answers
   * ended up in the register and which did not. Rejecting an answer leaves it on
   * the request rather than deleting it: "we asked, they answered, we disagreed" is
   * a different record from "we never asked".
   */
  merge: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      accept: z.array(z.string().max(80)).min(1).max(60),
      /** Where the accepted answers go. Omit to create a new draft activity. */
      targetActivityId: z.string().uuid().nullish(),
      /** Per-question overrides, where the reviewer edited before accepting. */
      overrides: z.record(z.string().max(80), z.unknown()).default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const [request] = await ctx.db.select().from(ropaIntakeRequests).where(and(
        eq(ropaIntakeRequests.id, input.id),
        eq(ropaIntakeRequests.organizationId, orgId),
      ));
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      if (request.status === 'merged') throw new TRPCError({ code: 'CONFLICT', message: 'This response has already been merged' });

      const questions = (request.questions ?? []) as IntakeQuestion[];
      const answers = (request.answers ?? {}) as Record<string, unknown>;
      const candidates = mapAnswersToFields(questions, answers)
        .filter((c) => input.accept.includes(c.questionId))
        .map((c) => (input.overrides[c.questionId] !== undefined
          ? { ...c, proposedValue: input.overrides[c.questionId] }
          : c));

      if (candidates.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'None of the accepted answers maps to a register field' });

      const scalars: Record<string, any> = {};
      for (const c of candidates.filter((c) => c.kind === 'scalar')) scalars[c.field] = c.proposedValue;

      // ---- resolve the target -------------------------------------------
      let activityId = input.targetActivityId ?? request.processingActivityId ?? null;
      let created = false;

      if (activityId) {
        const [existing] = await ctx.db.select({ id: processingActivities.id }).from(processingActivities).where(and(
          eq(processingActivities.id, activityId),
          eq(processingActivities.organizationId, orgId),
        ));
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });

        await ctx.db.update(processingActivities)
          .set({ ...pickActivityColumns(scalars), updatedAt: new Date() })
          .where(and(
            eq(processingActivities.id, activityId),
            eq(processingActivities.organizationId, orgId),
          ));
      } else {
        // A merged interview lands as a **draft**, always. The publication gate is
        // the point at which somebody with the permission asserts the record is
        // complete, and an intake response is evidence towards that rather than the
        // assertion itself.
        const [row] = await ctx.db.insert(processingActivities).values({
          organizationId: orgId,
          name: (scalars.name as string) || request.subject || 'Untitled activity',
          purpose: (scalars.purpose as string) || 'Recorded from a delegated intake response; the purpose still needs review.',
          lawfulBasis: 'legitimate_interest',
          status: 'draft',
          source: 'intake',
          createdBy: ctx.user!.id,
          ...pickActivityColumns(scalars),
        }).returning();
        if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not create the activity' });
        activityId = row.id;
        created = true;
      }

      // ---- child rows ----------------------------------------------------
      for (const candidate of candidates.filter((c) => c.kind === 'list')) {
        const values = Array.isArray(candidate.proposedValue) ? candidate.proposedValue.map(String) : [];
        if (values.length === 0) continue;

        if (candidate.field === 'dataSubjects') {
          await ctx.db.insert(processingDataSubjects).values(
            values.map((category) => ({ processingActivityId: activityId!, category: category.slice(0, 120) })),
          ).onConflictDoNothing();
        } else if (candidate.field === 'dataCategories') {
          await ctx.db.insert(processingDataCategories).values(
            values.map((category) => ({
              processingActivityId: activityId!,
              category: category.slice(0, 100),
              // "Uncategorised" rather than a guess. The element catalogue is where
              // a group comes from, and inventing one here would put a value in the
              // column the catalogue does not recognise.
              categoryGroup: 'Uncategorised',
            })),
          );
        } else if (candidate.field === 'recipients') {
          await ctx.db.insert(processingRecipients).values(
            values.map((name) => ({
              processingActivityId: activityId!,
              name: name.slice(0, 255),
              recipientType: 'other',
            })),
          );
        }
      }

      const mergedFields = {
        ...(request.mergedFields as Record<string, unknown> ?? {}),
        ...Object.fromEntries(candidates.map((c) => [c.questionId, {
          field: c.field,
          value: c.proposedValue,
          mergedAt: new Date().toISOString(),
          mergedBy: ctx.user!.id,
        }])),
      };

      await ctx.db.update(ropaIntakeRequests)
        .set({
          status: 'merged',
          mergedAt: new Date(),
          mergedBy: ctx.user!.id,
          mergedFields: mergedFields as any,
          createdActivityId: created ? activityId : request.createdActivityId,
          processingActivityId: request.processingActivityId ?? activityId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(ropaIntakeRequests.id, input.id),
          eq(ropaIntakeRequests.organizationId, orgId),
        ));

      return { activityId, created, mergedCount: candidates.length };
    }),

  // -------------------------------------------------------------------------
  // Respondent side — token-authenticated, no account
  // -------------------------------------------------------------------------

  /**
   * What the respondent sees.
   *
   * Returns the organisation's name and the questions, and deliberately nothing
   * else about the register: a token that leaked would otherwise disclose an
   * activity's recipients and transfers to whoever holds it. For a review-kind
   * request the activity's own name and purpose are included, because the question
   * being asked is "is this still accurate" and it cannot be asked without them.
   */
  open: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [request] = await ctx.db.select().from(ropaIntakeRequests)
        .where(eq(ropaIntakeRequests.token, input.token));
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'This questionnaire link is not valid' });

      const now = new Date();
      if (request.status === 'cancelled') throw new TRPCError({ code: 'FORBIDDEN', message: 'This questionnaire has been withdrawn' });
      if (request.expiresAt && request.expiresAt < now) throw new TRPCError({ code: 'FORBIDDEN', message: 'This questionnaire link has expired' });

      const [org] = await ctx.db.select({ name: organizations.name }).from(organizations)
        .where(eq(organizations.id, request.organizationId));

      const activity = request.processingActivityId
        ? (await ctx.db.select({
          name: processingActivities.name,
          purpose: processingActivities.purpose,
          retentionPeriod: processingActivities.retentionPeriod,
        }).from(processingActivities).where(eq(processingActivities.id, request.processingActivityId)))[0] ?? null
        : null;

      if (request.status === 'sent') {
        await ctx.db.update(ropaIntakeRequests)
          .set({ status: 'opened', openedAt: request.openedAt ?? now, updatedAt: now })
          .where(eq(ropaIntakeRequests.token, input.token));
      }

      return {
        organizationName: org?.name ?? 'Your organisation',
        recipientName: request.recipientName,
        kind: request.kind,
        subject: request.subject,
        message: request.message,
        locale: request.locale,
        dueAt: request.dueAt,
        status: request.status === 'sent' ? 'opened' : request.status,
        questions: request.questions,
        answers: request.answers,
        activity,
      };
    }),

  /**
   * Saves progress without submitting.
   *
   * Worth having for the reason the reminder ladder is: the questionnaire is
   * answered by someone doing it between other things, and one that loses their
   * answers when they close the tab is one that never comes back.
   */
  saveProgress: publicProcedure
    .input(z.object({
      token: z.string().uuid(),
      answers: z.record(z.string().max(80), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await ctx.db.select().from(ropaIntakeRequests)
        .where(eq(ropaIntakeRequests.token, input.token));
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'This questionnaire link is not valid' });
      if (request.status === 'submitted' || request.status === 'merged') {
        throw new TRPCError({ code: 'CONFLICT', message: 'This questionnaire has already been submitted' });
      }
      if (request.expiresAt && request.expiresAt < new Date()) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This questionnaire link has expired' });
      }

      await ctx.db.update(ropaIntakeRequests)
        .set({ answers: sanitiseAnswers(input.answers) as any, updatedAt: new Date() })
        .where(eq(ropaIntakeRequests.token, input.token));

      return { success: true };
    }),

  submit: publicProcedure
    .input(z.object({
      token: z.string().uuid(),
      answers: z.record(z.string().max(80), z.unknown()),
      submittedByName: z.string().max(160).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await ctx.db.select().from(ropaIntakeRequests)
        .where(eq(ropaIntakeRequests.token, input.token));
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'This questionnaire link is not valid' });
      if (request.status === 'merged') throw new TRPCError({ code: 'CONFLICT', message: 'This questionnaire has already been processed' });
      if (request.expiresAt && request.expiresAt < new Date()) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This questionnaire link has expired' });
      }

      await ctx.db.update(ropaIntakeRequests)
        .set({
          answers: sanitiseAnswers(input.answers) as any,
          status: 'submitted',
          submittedAt: new Date(),
          submittedByName: sanitize(input.submittedByName) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(ropaIntakeRequests.token, input.token));

      // The reviewer hears about it, because a response nobody is told about waits
      // until somebody happens to open the queue.
      if (request.createdBy) {
        await queueNotification({
          organizationId: request.organizationId,
          userId: request.createdBy,
          type: 'ropa.intake.submitted',
          title: 'A data-collection response came back',
          body: `${request.recipientName || request.recipientEmail} answered the questionnaire for "${request.subject ?? 'a processing activity'}".`,
          actionUrl: `/ropa/intake/${request.id}`,
        });
      }

      return { success: true };
    }),

  decline: publicProcedure
    .input(z.object({ token: z.string().uuid(), reason: z.string().max(2000).nullish() }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await ctx.db.select({ id: ropaIntakeRequests.id }).from(ropaIntakeRequests)
        .where(eq(ropaIntakeRequests.token, input.token));
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'This questionnaire link is not valid' });

      await ctx.db.update(ropaIntakeRequests)
        .set({ status: 'declined', declinedReason: sanitize(input.reason) ?? null, updatedAt: new Date() })
        .where(eq(ropaIntakeRequests.token, input.token));
      return { success: true };
    }),
});

/**
 * Only the activity's own columns, and only the ones intake may write.
 *
 * An allowlist rather than a spread, for the reason the four update schemas in
 * `routers/ropa.ts` give: the candidate map is derived from a question set, and a
 * question set is data — a future entry with `field: 'organizationId'` would
 * otherwise be a cross-tenant write with no code change behind it.
 */
function pickActivityColumns(scalars: Record<string, any>): Record<string, any> {
  const allowed = ['name', 'purpose', 'retentionPeriod', 'status', 'involvesSpecialCategories', 'involvesAutomatedDecisionMaking'];
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (scalars[key] === undefined) continue;
    // The transfers question produces a boolean prompt, not a column. It is shown
    // to the reviewer as a note and never written.
    if (key === 'status' && scalars[key] !== 'archived') continue;
    out[key] = typeof scalars[key] === 'string' ? sanitize(scalars[key]) : scalars[key];
  }
  return out;
}

/** Every string a respondent sends, stripped of markup before it is stored. */
function sanitiseAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === 'string') out[key] = sanitize(value.slice(0, 8000));
    else if (Array.isArray(value)) out[key] = value.slice(0, 60).map((v) => (typeof v === 'string' ? sanitize(v.slice(0, 400)) : v));
    else if (typeof value === 'boolean' || typeof value === 'number' || value === null) out[key] = value;
  }
  return out;
}

/**
 * Queues the email carrying the token.
 *
 * Through `notificationQueue` rather than a direct send, so it goes out on the same
 * path as everything else the product emails and is subject to the same worker.
 * The token is in the payload and nowhere else — not in the list response, not in
 * `get`, not in an audit log.
 */
async function sendIntakeEmail(dbc: any, request: any, isReminder = false): Promise<void> {
  const [org] = await dbc.select({ name: organizations.name }).from(organizations)
    .where(eq(organizations.id, request.organizationId));

  await queueNotification({
    organizationId: request.organizationId,
    emailTo: request.recipientEmail,
    type: isReminder ? 'ropa.intake.reminder' : 'ropa.intake.request',
    title: isReminder
      ? `Reminder: ${org?.name ?? 'Your organisation'} needs your answers`
      : `${org?.name ?? 'Your organisation'} needs your help with a data record`,
    body: request.message
      || 'Your organisation is putting together its record of how it uses people’s information. It should take about three minutes.',
    actionUrl: `/intake/${request.token}`,
    metadata: { intakeRequestId: request.id, dueAt: request.dueAt ?? null },
  });
}
