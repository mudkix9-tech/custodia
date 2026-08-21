/**
 * D41–D43, P123, P125 and P130 — everything the register can *say* about itself.
 *
 * The three maps, the completeness trend, the material-change queue and the three
 * register-driven outputs. All of them are views: nothing here holds a fact the
 * Article 30 record does not already hold, which is the property that stops a map
 * or a notice draft becoming a second source of truth the register can disagree
 * with. J93 is what happens when that rule is not kept.
 */

import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import {
  processingActivities,
  processingDataSubjects,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  retentionSchedules,
  ropaCompletenessSnapshots,
  materialChangeEvents,
  privacyPolicies,
  policyVersions,
  breaches,
  dsarRequests,
  users,
} from 'db';
import { and, eq, desc, asc, inArray, isNull, gte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import DOMPurify from 'isomorphic-dompurify';
import { assertOwned } from '../lib/tenancy.js';
import { ADEQUACY_DECISIONS } from '../constants/transferDestinations.js';
import { buildActivityFlow, buildDataMap, buildTransferMap, type DataMapRow } from '../lib/ropaDataMap.js';
import {
  buildNoticeSections,
  diffAgainstPublished,
  buildDsarScope,
  buildBlastRadius,
  type NoticeBundle,
  type BlastBundle,
} from '../lib/registerOutputs.js';
import { CONSEQUENCES } from '../lib/materialChange.js';

const sanitize = (text?: string | null) => (text ? DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }) : text);

/**
 * How many activities an org-wide view will load at once.
 *
 * Every function in this file works over the whole register in memory, which is
 * correct for the register-sized data this product holds and would not be for a
 * warehouse. The cap is here so the failure at ten thousand activities is a stated
 * limit rather than a 512MB box falling over — the same bargain the PDF makes about
 * its sixty detail pages.
 */
const MAP_ACTIVITY_CAP = 2000;

/** The whole register plus its four child tables, in five queries. */
async function loadRegister(dbc: any, orgId: string, activityIds?: string[]) {
  const activityFilters: any[] = [
    eq(processingActivities.organizationId, orgId),
    isNull(processingActivities.deletedAt),
  ];
  if (activityIds?.length) activityFilters.push(inArray(processingActivities.id, activityIds));

  const activities = await dbc.select({
    activity: processingActivities,
    schedule: retentionSchedules,
  })
    .from(processingActivities)
    .leftJoin(retentionSchedules, eq(processingActivities.retentionScheduleId, retentionSchedules.id))
    .where(and(...activityFilters))
    .orderBy(asc(processingActivities.name))
    .limit(MAP_ACTIVITY_CAP);

  const ids = activities.map((a: any) => a.activity.id);
  if (ids.length === 0) return { activities: [], subjects: [], categories: [], recipients: [], transfers: [], truncated: false };

  const [subjects, categories, recipients, transfers] = await Promise.all([
    dbc.select().from(processingDataSubjects).where(inArray(processingDataSubjects.processingActivityId, ids)),
    dbc.select().from(processingDataCategories).where(inArray(processingDataCategories.processingActivityId, ids)),
    dbc.select().from(processingRecipients).where(inArray(processingRecipients.processingActivityId, ids)),
    dbc.select().from(processingTransfers).where(inArray(processingTransfers.processingActivityId, ids)),
  ]);

  return {
    activities,
    subjects,
    categories,
    recipients,
    transfers,
    truncated: activities.length === MAP_ACTIVITY_CAP,
  };
}

function groupBy<T extends { processingActivityId: string }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const list = out.get(row.processingActivityId) ?? [];
    list.push(row);
    out.set(row.processingActivityId, list);
  }
  return out;
}

/** Turns the five loaded collections into the bundles the output builders take. */
function toBundles(loaded: Awaited<ReturnType<typeof loadRegister>>): BlastBundle[] {
  const bySubject = groupBy(loaded.subjects as any[]);
  const byCategory = groupBy(loaded.categories as any[]);
  const byRecipient = groupBy(loaded.recipients as any[]);
  const byTransfer = groupBy(loaded.transfers as any[]);

  return (loaded.activities as any[]).map((row) => ({
    activity: { ...row.activity, retentionSchedule: row.schedule ?? null },
    dataSubjects: bySubject.get(row.activity.id) ?? [],
    dataCategories: byCategory.get(row.activity.id) ?? [],
    recipients: byRecipient.get(row.activity.id) ?? [],
    transfers: byTransfer.get(row.activity.id) ?? [],
  }));
}

export const ropaInsightsRouter = router({
  // -------------------------------------------------------------------------
  // D41 — the per-activity flow
  // -------------------------------------------------------------------------
  flow: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ activityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [activity] = await ctx.db.select().from(processingActivities).where(and(
        eq(processingActivities.id, input.activityId),
        eq(processingActivities.organizationId, ctx.user!.orgId),
      ));
      if (!activity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });

      const [dataSubjects, dataCategories, recipients, transfers] = await Promise.all([
        ctx.db.select().from(processingDataSubjects).where(eq(processingDataSubjects.processingActivityId, input.activityId)),
        ctx.db.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, input.activityId)),
        ctx.db.select().from(processingRecipients).where(eq(processingRecipients.processingActivityId, input.activityId)),
        ctx.db.select().from(processingTransfers).where(eq(processingTransfers.processingActivityId, input.activityId)),
      ]);

      return buildActivityFlow({ activity, dataSubjects, dataCategories, recipients, transfers });
    }),

  // -------------------------------------------------------------------------
  // D42/D44 — the org-level data map and the three reverse lookups
  // -------------------------------------------------------------------------
  dataMap: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      dataCategory: z.string().max(120).nullish(),
      subjectCategory: z.string().max(120).nullish(),
      country: z.string().length(2).nullish(),
      vendorId: z.string().uuid().nullish(),
      recipientName: z.string().max(255).nullish(),
      specialCategoryOnly: z.boolean().default(false),
      includeDrafts: z.boolean().default(true),
    }).default({ specialCategoryOnly: false, includeDrafts: true }))
    .query(async ({ ctx, input }) => {
      const loaded = await loadRegister(ctx.db, ctx.user!.orgId);
      const bundles = toBundles(loaded);

      const rows: DataMapRow[] = bundles
        .filter((b) => input.includeDrafts || b.activity.status === 'active')
        .map((b) => ({
          activityId: b.activity.id,
          activityName: b.activity.name ?? 'Untitled activity',
          status: b.activity.status ?? null,
          role: b.activity.role ?? null,
          lawfulBasis: b.activity.lawfulBasis ?? null,
          subjectCategories: b.dataSubjects.map((s) => s.category ?? '').filter(Boolean),
          dataCategories: b.dataCategories.map((c) => c.category ?? '').filter(Boolean),
          specialCategories: b.dataCategories.filter((c) => c.isSpecialCategory).map((c) => c.category ?? '').filter(Boolean),
          recipients: b.recipients.map((r) => ({ name: r.name ?? '', role: r.role ?? null, vendorId: (r as any).vendorId ?? null })).filter((r) => r.name),
          countries: b.transfers.map((t) => (t.destinationCountry ?? '').toUpperCase()).filter(Boolean),
          thirdCountries: b.transfers
            .map((t) => (t.destinationCountry ?? '').toUpperCase())
            .filter((c) => c && !ADEQUACY_DECISIONS[c]),
        }));

      const map = buildDataMap(rows, {
        dataCategory: input.dataCategory ?? null,
        subjectCategory: input.subjectCategory ?? null,
        country: input.country ?? null,
        vendorId: input.vendorId ?? null,
        recipientName: input.recipientName ?? null,
        specialCategoryOnly: input.specialCategoryOnly,
      });

      return { ...map, truncated: loaded.truncated, total: rows.length };
    }),

  // -------------------------------------------------------------------------
  // D43 — the transfer map
  // -------------------------------------------------------------------------
  transferMap: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      const loaded = await loadRegister(ctx.db, ctx.user!.orgId);
      const bySubject = groupBy(loaded.subjects as any[]);

      const transfers = (loaded.transfers as any[]).map((t) => ({
        ...t,
        // The volume of the transfer is the volume of the subjects whose data
        // reaches it. Read from the activity's subject categories, because a
        // transfer row has no population of its own and never will — Art. 30(1)(e)
        // asks about the destination, not about the headcount.
        volumeBands: (bySubject.get(t.processingActivityId) ?? [])
          .map((s: any) => s.volumeBand)
          .filter(Boolean),
      }));

      const scopes = Object.fromEntries(
        Object.entries(ADEQUACY_DECISIONS).map(([code, decision]) => [code, decision.scope]),
      );

      return {
        destinations: buildTransferMap(transfers, scopes),
        truncated: loaded.truncated,
      };
    }),

  // -------------------------------------------------------------------------
  // P123 — completeness monitoring with a trend
  // -------------------------------------------------------------------------
  trend: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ days: z.number().int().min(7).max(730).default(90) }).default({ days: 90 }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const snapshots = await ctx.db.select().from(ropaCompletenessSnapshots)
        .where(and(
          eq(ropaCompletenessSnapshots.organizationId, ctx.user!.orgId),
          gte(ropaCompletenessSnapshots.capturedOn, since.toISOString().slice(0, 10)),
        ))
        .orderBy(asc(ropaCompletenessSnapshots.capturedOn));

      const first = snapshots[0];
      const latest = snapshots[snapshots.length - 1];

      return {
        snapshots,
        // Stated as a delta rather than a direction word, because "improving" over
        // two points of data on a register that gained forty activities is a story
        // the numbers do not support.
        change: first && latest ? latest.averageScore - first.averageScore : null,
        latest: latest ?? null,
        // A trend with one point is not a trend. Saying so stops the panel drawing
        // a confident flat line on the day the feature ships.
        hasHistory: snapshots.length > 1,
      };
    }),

  // -------------------------------------------------------------------------
  // P125 — the material-change queue
  // -------------------------------------------------------------------------
  materialChanges: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        status: z.enum(['open', 'acknowledged', 'actioned', 'dismissed', 'all']).default('open'),
        consequence: z.enum([...CONSEQUENCES, 'all']).default('all'),
        activityId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }).default({ status: 'open', consequence: 'all', limit: 50 }))
      .query(async ({ ctx, input }) => {
        const filters: any[] = [eq(materialChangeEvents.organizationId, ctx.user!.orgId)];
        if (input.status !== 'all') filters.push(eq(materialChangeEvents.status, input.status));
        if (input.activityId) filters.push(eq(materialChangeEvents.processingActivityId, input.activityId));
        if (input.consequence !== 'all') {
          // jsonb containment, bound as a parameter. The `?|` operator would need
          // a Postgres text[] built with sql.raw, which is user input hand-quoted
          // into a query — the same reasoning the register's tag filter gives.
          filters.push(sql`${materialChangeEvents.consequences} @> ${JSON.stringify([input.consequence])}::jsonb`);
        }

        const rows = await ctx.db.select({
          event: materialChangeEvents,
          activityName: processingActivities.name,
          activityStatus: processingActivities.status,
          reviewerName: users.name,
        })
          .from(materialChangeEvents)
          .innerJoin(processingActivities, eq(materialChangeEvents.processingActivityId, processingActivities.id))
          .leftJoin(users, eq(materialChangeEvents.reviewedBy, users.id))
          .where(and(...filters))
          .orderBy(
            sql`CASE ${materialChangeEvents.materiality} WHEN 'material' THEN 0 WHEN 'advisory' THEN 1 ELSE 2 END`,
            desc(materialChangeEvents.detectedAt),
          )
          .limit(input.limit);

        return rows.map((r: any) => ({
          ...r.event,
          activityName: r.activityName,
          activityStatus: r.activityStatus,
          reviewerName: r.reviewerName,
        }));
      }),

    review: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(['acknowledged', 'actioned', 'dismissed']),
        note: z.string().max(2000).nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Dismissing needs a reason for the same reason a discovery dismissal does:
        // the event is the organisation's record that it considered an Art. 13(3)
        // obligation and decided it did not apply, and that decision has to survive
        // the person who made it.
        if (input.status === 'dismissed' && (input.note ?? '').trim().length < 10) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Say why this change needs no action.' });
        }

        const [row] = await ctx.db.update(materialChangeEvents)
          .set({
            status: input.status,
            reviewedBy: ctx.user!.id,
            reviewedAt: new Date(),
            reviewNote: sanitize(input.note) ?? null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(materialChangeEvents.id, input.id),
            eq(materialChangeEvents.organizationId, ctx.user!.orgId),
          ))
          .returning();
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
        return row;
      }),
  }),

  // -------------------------------------------------------------------------
  // P130 — register-driven outputs
  // -------------------------------------------------------------------------
  outputs: router({
    /**
     * The Art. 13/14 sections a privacy notice needs, drafted from the register,
     * and what the published notice does not currently say.
     */
    notice: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        activityIds: z.array(z.string().uuid()).max(500).optional(),
        /** Compare against this policy's current published version. */
        policyId: z.string().uuid().nullish(),
      }).default({}))
      .query(async ({ ctx, input }) => {
        const loaded = await loadRegister(ctx.db, ctx.user!.orgId, input.activityIds);
        const draft = buildNoticeSections(toBundles(loaded) as NoticeBundle[]);

        let comparison: ReturnType<typeof diffAgainstPublished> | null = null;
        let policyName: string | null = null;

        if (input.policyId) {
          const policy = await assertOwned(ctx.db, {
            table: privacyPolicies,
            id: input.policyId,
            orgId: ctx.user!.orgId,
            label: 'Policy',
          });
          policyName = policy.name ?? null;

          if (policy.currentVersionId) {
            const [version] = await ctx.db.select({ markdown: policyVersions.contentMarkdown })
              .from(policyVersions)
              .where(eq(policyVersions.id, policy.currentVersionId));
            if (version) comparison = diffAgainstPublished(draft, version.markdown ?? '');
          }
        }

        return { ...draft, comparison, policyName, truncated: loaded.truncated };
      }),

    /**
     * P130. Which activities a DSAR has to be searched across.
     *
     * Takes either a DSAR id or a set of subject categories. The id path is the one
     * worth having: a handler working an actual request should not have to decide
     * which of the register's subject categories the requester falls into before
     * the product will help them.
     */
    dsarScope: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        dsarId: z.string().uuid().nullish(),
        subjectCategories: z.array(z.string().max(120)).max(20).default([]),
      }).default({ subjectCategories: [] }))
      .query(async ({ ctx, input }) => {
        const categories = input.subjectCategories;
        let dsarReference: string | null = null;
        const extraNotes: string[] = [];

        if (input.dsarId) {
          const dsar = await assertOwned(ctx.db, {
            table: dsarRequests,
            id: input.dsarId,
            orgId: ctx.user!.orgId,
            label: 'Request',
          });
          dsarReference = dsar.referenceNumber ?? null;

          // `dsar_requests` records who the requester *is* — name, email, an
          // identifier blob — and not which category of data subject they fall
          // into. So the id alone cannot narrow the scope, and the honest thing is
          // to say so rather than return the whole register as though it had been
          // narrowed. Adding that column belongs to the DSAR module.
          if (categories.length === 0) {
            extraNotes.push(
              'This request does not record which category of data subject the requester falls into, '
              + 'so every activity is in scope. Narrow it by naming the category — an employee\'s request '
              + 'does not need the marketing register searched.',
            );
          }
        }

        const loaded = await loadRegister(ctx.db, ctx.user!.orgId);
        const scope = buildDsarScope(toBundles(loaded) as NoticeBundle[], categories);
        return {
          ...scope,
          notes: [...extraNotes, ...scope.notes],
          dsarReference,
          subjectCategories: categories,
          truncated: loaded.truncated,
        };
      }),

    /**
     * P130. The blast radius of a breach, from the activities it affected.
     *
     * The two notification booleans it returns are stated as *likely* rather than
     * as decisions, and that is not hedging: Art. 33(1) turns on a risk assessment
     * the controller makes, and a product that told someone "you do not need to
     * notify" would be making it for them. What it can do is show every factor.
     */
    blastRadius: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        breachId: z.string().uuid().nullish(),
        activityIds: z.array(z.string().uuid()).min(1).max(200),
      }))
      .query(async ({ ctx, input }) => {
        let breach: any = {};
        if (input.breachId) {
          breach = await assertOwned(ctx.db, {
            table: breaches,
            id: input.breachId,
            orgId: ctx.user!.orgId,
            label: 'Breach',
          });
        }

        const loaded = await loadRegister(ctx.db, ctx.user!.orgId, input.activityIds);
        if (loaded.activities.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'None of those activities is in this register' });
        }

        return buildBlastRadius(toBundles(loaded), {
          breachType: breach.breachType ?? null,
          description: breach.description ?? null,
          estimatedIndividualsAffected: breach.estimatedIndividualsAffected ?? null,
        });
      }),
  }),
});
