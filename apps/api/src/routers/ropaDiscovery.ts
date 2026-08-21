/**
 * C34–C37. The discovery queue and AI drafting with a decision per field.
 *
 * Two routers in one file because they are one flow: a signal is discovered, a
 * draft is generated from it, the reviewer accepts the fields they agree with, and
 * an activity exists. Splitting them would put the `discoverySignalId` handoff
 * across a file boundary for no gain.
 *
 * The rule both halves obey: **nothing here writes to the register on its own.**
 * A discovery signal is a suggestion, a draft is a proposal, and the only thing
 * that creates or edits a processing activity is a person with `ropa:edit`
 * accepting a named field.
 */

import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import {
  ropaDiscoverySignals,
  ropaActivityDrafts,
  processingActivities,
  processingDataSubjects,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  users,
} from 'db';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import DOMPurify from 'isomorphic-dompurify';
import { Anthropic } from '@anthropic-ai/sdk';
import { WORKER_MODEL } from '../lib/anthropicModels.js';
import { trackAiUsage } from '../lib/billing.js';
import { ropaDiscoveryQueue } from '../workers/index.js';
import {
  DRAFT_FIELDS,
  DRAFT_FIELD_IDS,
  DRAFT_JSON_SCHEMA,
  DRAFT_SYSTEM_PROMPT,
  validateProposal,
  acceptedValues,
  draftStatus,
  type DraftDecision,
  type Proposal,
} from '../lib/ropaDrafting.js';

const sanitize = (text?: string | null) => (text ? DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }) : text);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key' });

// ---------------------------------------------------------------------------
// C34–C36 — the discovery queue
// ---------------------------------------------------------------------------

export const ropaDiscoveryRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      status: z.enum(['open', 'accepted', 'dismissed', 'resolved', 'all']).default('open'),
      source: z.enum(['vendor_register', 'tracker_scan', 'saas_connector', 'all']).default('all'),
      limit: z.number().int().min(1).max(200).default(100),
    }).default({ status: 'open', source: 'all', limit: 100 }))
    .query(async ({ ctx, input }) => {
      const filters: any[] = [eq(ropaDiscoverySignals.organizationId, ctx.user!.orgId)];
      if (input.status !== 'all') filters.push(eq(ropaDiscoverySignals.status, input.status));
      if (input.source !== 'all') filters.push(eq(ropaDiscoverySignals.source, input.source));

      const rows = await ctx.db.select().from(ropaDiscoverySignals)
        .where(and(...filters))
        // Confidence first, then most recently seen. The queue is read top-down and
        // abandoned partway; what is at the top has to be what is most likely real.
        .orderBy(
          sql`CASE ${ropaDiscoverySignals.confidence} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
          desc(ropaDiscoverySignals.lastSeenAt),
        )
        .limit(input.limit);

      return rows;
    }),

  summary: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.select({
        source: ropaDiscoverySignals.source,
        status: ropaDiscoverySignals.status,
        n: sql<number>`count(*)`,
      })
        .from(ropaDiscoverySignals)
        .where(eq(ropaDiscoverySignals.organizationId, ctx.user!.orgId))
        .groupBy(ropaDiscoverySignals.source, ropaDiscoverySignals.status);

      const open = rows.filter((r: any) => r.status === 'open');
      return {
        openTotal: open.reduce((sum: number, r: any) => sum + Number(r.n), 0),
        bySource: Object.fromEntries(open.map((r: any) => [r.source, Number(r.n)])),
        all: rows.map((r: any) => ({ ...r, n: Number(r.n) })),
      };
    }),

  /** Runs the scan now rather than waiting for the nightly job. */
  scan: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .mutation(async ({ ctx }) => {
      await ropaDiscoveryQueue.add('ropa-discovery-scan', { orgId: ctx.user!.orgId });
      return { queued: true };
    }),

  /**
   * C34–C36. Accept a signal into a draft activity.
   *
   * A **draft**, never a published record, and never silently. Everything the
   * signal suggested lands as fields somebody then has to read: a vendor's
   * `typicalDataCategories` are a plausible guess about what an organisation shares
   * with it, not a statement the organisation has made about itself, and an
   * Article 30 record is a statement the organisation makes about itself.
   */
  accept: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      /** Override the suggested name before the activity is created. */
      name: z.string().min(1).max(255).optional(),
      includeRecipients: z.boolean().default(true),
      includeTransfers: z.boolean().default(true),
      includeDataCategories: z.boolean().default(true),
      includeDataSubjects: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const [signal] = await ctx.db.select().from(ropaDiscoverySignals).where(and(
        eq(ropaDiscoverySignals.id, input.id),
        eq(ropaDiscoverySignals.organizationId, orgId),
      ));
      if (!signal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Signal not found' });
      if (signal.status === 'accepted' && signal.acceptedActivityId) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This signal has already been accepted' });
      }

      const [activity] = await ctx.db.insert(processingActivities).values({
        organizationId: orgId,
        name: sanitize(input.name ?? signal.suggestedName ?? signal.title)!.slice(0, 255),
        purpose: sanitize(signal.suggestedPurpose) ?? 'Discovered automatically; the purpose still needs to be described.',
        // The suggestion is used where the rule had a defensible reason for it — a
        // tracker that sets identifiers needs consent under ePrivacy Art. 5(3)
        // whatever else is true — and otherwise falls back to the register's own
        // default rather than to whatever reads best.
        lawfulBasis: signal.suggestedLawfulBasis ?? 'legitimate_interest',
        status: 'draft',
        source: 'discovery',
        createdBy: ctx.user!.id,
      }).returning();
      if (!activity) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not create the activity' });

      const subjects = asStringArray(signal.suggestedDataSubjects);
      if (input.includeDataSubjects && subjects.length > 0) {
        await ctx.db.insert(processingDataSubjects).values(
          subjects.map((category) => ({ processingActivityId: activity.id, category: category.slice(0, 120) })),
        ).onConflictDoNothing();
      }

      const categories = asStringArray(signal.suggestedDataCategories);
      if (input.includeDataCategories && categories.length > 0) {
        await ctx.db.insert(processingDataCategories).values(
          categories.map((category) => ({
            processingActivityId: activity.id,
            category: category.slice(0, 100),
            categoryGroup: 'Uncategorised',
            source: signal.source === 'tracker_scan' ? 'Website' : null,
          })),
        );
      }

      const recipients = asRows(signal.suggestedRecipients);
      if (input.includeRecipients && recipients.length > 0) {
        await ctx.db.insert(processingRecipients).values(
          recipients.map((r: any) => ({
            processingActivityId: activity.id,
            name: String(r.name ?? '').slice(0, 255) || 'Unnamed recipient',
            role: typeof r.role === 'string' ? r.role : null,
            recipientType: 'vendor',
            // The vendor id comes from the signal, which built it from the caller's
            // own organizationVendors row or from a tracker match against the shared
            // catalogue — never from client input.
            vendorId: typeof r.vendorId === 'string' ? r.vendorId : null,
          })),
        );
      }

      const transfers = asRows(signal.suggestedTransfers);
      if (input.includeTransfers && transfers.length > 0) {
        await ctx.db.insert(processingTransfers).values(
          transfers
            .filter((t: any) => typeof t.destinationCountry === 'string' && /^[A-Za-z]{2}$/.test(t.destinationCountry))
            .map((t: any) => ({
              processingActivityId: activity.id,
              destinationCountry: String(t.destinationCountry).toUpperCase(),
              destinationEntity: t.destinationEntity ? String(t.destinationEntity).slice(0, 255) : null,
              // `pending_assessment` rather than the vendor's claimed mechanism.
              // D17's lesson: adequacy and Chapter V positions are served from the
              // register's own list, and inheriting a vendor's marketing copy as a
              // safeguard is how a transfer reads as covered when it is not.
              transferMechanism: 'pending_assessment',
            })),
        );
      }

      await ctx.db.update(ropaDiscoverySignals)
        .set({
          status: 'accepted',
          acceptedActivityId: activity.id,
          acceptedAt: new Date(),
          acceptedBy: ctx.user!.id,
          updatedAt: new Date(),
        })
        .where(and(
          eq(ropaDiscoverySignals.id, input.id),
          eq(ropaDiscoverySignals.organizationId, orgId),
        ));

      return { activityId: activity.id };
    }),

  dismiss: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid(), reason: z.string().min(3).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      // A reason is required, and it is not bureaucracy: dismissal survives every
      // future scan, so "why is this vendor not in the register" has to have an
      // answer a year later that is not "somebody clicked X".
      const [row] = await ctx.db.update(ropaDiscoverySignals)
        .set({
          status: 'dismissed',
          dismissedReason: sanitize(input.reason) ?? null,
          dismissedAt: new Date(),
          dismissedBy: ctx.user!.id,
          updatedAt: new Date(),
        })
        .where(and(
          eq(ropaDiscoverySignals.id, input.id),
          eq(ropaDiscoverySignals.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Signal not found' });
      return row;
    }),

  reopen: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(ropaDiscoverySignals)
        .set({ status: 'open', dismissedAt: null, dismissedBy: null, dismissedReason: null, updatedAt: new Date() })
        .where(and(
          eq(ropaDiscoverySignals.id, input.id),
          eq(ropaDiscoverySignals.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Signal not found' });
      return row;
    }),
});

// ---------------------------------------------------------------------------
// C37 — AI drafting
// ---------------------------------------------------------------------------

export const ropaDraftRouter = router({
  /** The fields a draft can cover, so the panel renders them in a fixed order. */
  fields: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(() => DRAFT_FIELDS),

  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      activityId: z.string().uuid().optional(),
      status: z.enum(['proposed', 'partially_applied', 'applied', 'discarded', 'all']).default('all'),
      limit: z.number().int().min(1).max(100).default(25),
    }).default({ status: 'all', limit: 25 }))
    .query(async ({ ctx, input }) => {
      const filters: any[] = [eq(ropaActivityDrafts.organizationId, ctx.user!.orgId)];
      if (input.activityId) filters.push(eq(ropaActivityDrafts.processingActivityId, input.activityId));
      if (input.status !== 'all') filters.push(eq(ropaActivityDrafts.status, input.status));

      return ctx.db.select({
        draft: ropaActivityDrafts,
        authorName: users.name,
      })
        .from(ropaActivityDrafts)
        .leftJoin(users, eq(ropaActivityDrafts.createdBy, users.id))
        .where(and(...filters))
        .orderBy(desc(ropaActivityDrafts.createdAt))
        .limit(input.limit);
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(ropaActivityDrafts).where(and(
        eq(ropaActivityDrafts.id, input.id),
        eq(ropaActivityDrafts.organizationId, ctx.user!.orgId),
      ));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      return row;
    }),

  /**
   * C37. One line in, a field-by-field proposal out.
   *
   * The model's answer is validated against the register's own vocabularies before
   * it is stored (`validateProposal`), and anything that does not fit is *reported*
   * rather than dropped. A field silently discarded is a field the reviewer
   * believes was considered and found not to apply, which is the same mistake F56
   * spent a sprint fixing about DPIA screening criteria.
   */
  generate: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      prompt: z.string().min(15).max(2000),
      processingActivityId: z.string().uuid().nullish(),
      discoverySignalId: z.string().uuid().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;

      if (input.processingActivityId) {
        const [activity] = await ctx.db.select({ id: processingActivities.id }).from(processingActivities).where(and(
          eq(processingActivities.id, input.processingActivityId),
          eq(processingActivities.organizationId, orgId),
        ));
        if (!activity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
      }
      if (input.discoverySignalId) {
        const [signal] = await ctx.db.select({ id: ropaDiscoverySignals.id }).from(ropaDiscoverySignals).where(and(
          eq(ropaDiscoverySignals.id, input.discoverySignalId),
          eq(ropaDiscoverySignals.organizationId, orgId),
        ));
        if (!signal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Signal not found' });
      }

      await trackAiUsage(orgId, 1);

      let parsed: unknown;
      try {
        const response = await anthropic.messages.create({
          model: WORKER_MODEL,
          max_tokens: 4096,
          system: DRAFT_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Draft an Article 30 record for this processing:\n\n"${input.prompt}"\n\nReturn JSON matching exactly this schema:\n${DRAFT_JSON_SCHEMA}`,
          }],
        });
        const first = response.content[0];
        const text = first?.type === 'text' ? first.text : '';
        parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      } catch (error: any) {
        // A model failure is a failure of this feature, not of the register. The
        // message says which, because "something went wrong" on a panel that just
        // charged an AI credit is the least useful sentence in the product.
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `The draft could not be generated: ${error?.message ?? 'the model returned something unreadable'}`,
        });
      }

      const { proposal, rejected } = validateProposal(parsed);
      if (Object.keys(proposal).length === 0) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The draft came back with no usable fields.' });
      }

      const [row] = await ctx.db.insert(ropaActivityDrafts).values({
        organizationId: orgId,
        processingActivityId: input.processingActivityId ?? null,
        discoverySignalId: input.discoverySignalId ?? null,
        prompt: sanitize(input.prompt)!,
        model: WORKER_MODEL,
        proposal: proposal as any,
        decisions: {},
        status: 'proposed',
        createdBy: ctx.user!.id,
      }).returning();

      return { ...row, rejected };
    }),

  /**
   * Records a decision on one field. Accepting does not write to the register —
   * `apply` does, once, so a reviewer can change their mind about field four after
   * accepting field three without the register having already moved.
   */
  decide: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      field: z.enum(DRAFT_FIELD_IDS as [string, ...string[]]),
      decision: z.enum(['accepted', 'rejected', 'pending']),
      /** The value as edited, where the reviewer changed it before accepting. */
      value: z.unknown().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [draft] = await ctx.db.select().from(ropaActivityDrafts).where(and(
        eq(ropaActivityDrafts.id, input.id),
        eq(ropaActivityDrafts.organizationId, ctx.user!.orgId),
      ));
      if (!draft) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      if (draft.status === 'applied') throw new TRPCError({ code: 'CONFLICT', message: 'This draft has already been applied' });

      const proposal = (draft.proposal ?? {}) as Proposal;
      if (!proposal[input.field]) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This draft did not propose that field' });

      const decisions = { ...(draft.decisions ?? {}) } as Record<string, DraftDecision>;
      decisions[input.field] = {
        decision: input.decision,
        ...(input.value !== undefined ? { value: input.value } : {}),
        decidedAt: new Date().toISOString(),
        decidedBy: ctx.user!.id,
      };

      const [row] = await ctx.db.update(ropaActivityDrafts)
        .set({ decisions: decisions as any, status: draftStatus(proposal, decisions), updatedAt: new Date() })
        .where(and(
          eq(ropaActivityDrafts.id, input.id),
          eq(ropaActivityDrafts.organizationId, ctx.user!.orgId),
        ))
        .returning();

      return row;
    }),

  /** Marks every proposed field accepted in one call, for a draft a reviewer has read through. */
  acceptAll: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [draft] = await ctx.db.select().from(ropaActivityDrafts).where(and(
        eq(ropaActivityDrafts.id, input.id),
        eq(ropaActivityDrafts.organizationId, ctx.user!.orgId),
      ));
      if (!draft) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });

      const proposal = (draft.proposal ?? {}) as Proposal;
      const now = new Date().toISOString();
      const decisions = Object.fromEntries(
        Object.keys(proposal).map((field) => [field, { decision: 'accepted' as const, decidedAt: now, decidedBy: ctx.user!.id }]),
      );

      const [row] = await ctx.db.update(ropaActivityDrafts)
        .set({ decisions: decisions as any, status: draftStatus(proposal, decisions), updatedAt: new Date() })
        .where(and(
          eq(ropaActivityDrafts.id, input.id),
          eq(ropaActivityDrafts.organizationId, ctx.user!.orgId),
        ))
        .returning();
      return row;
    }),

  /**
   * Writes the accepted fields into an activity — new or existing.
   *
   * Rows are *added*, never replaced. A draft applied over an activity that already
   * has six data categories should give it more categories, not silently delete the
   * six somebody entered by hand; and a reviewer who wants them gone can delete
   * them where deleting them is visible.
   */
  applyDraft: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid(), targetActivityId: z.string().uuid().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const [draft] = await ctx.db.select().from(ropaActivityDrafts).where(and(
        eq(ropaActivityDrafts.id, input.id),
        eq(ropaActivityDrafts.organizationId, orgId),
      ));
      if (!draft) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      if (draft.appliedActivityId) throw new TRPCError({ code: 'CONFLICT', message: 'This draft has already been applied' });

      const proposal = (draft.proposal ?? {}) as Proposal;
      const decisions = (draft.decisions ?? {}) as Record<string, DraftDecision>;
      const { scalars, rows } = acceptedValues(proposal, decisions);

      if (Object.keys(scalars).length === 0 && Object.keys(rows).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields have been accepted yet' });
      }

      let activityId = input.targetActivityId ?? draft.processingActivityId ?? null;
      let created = false;

      if (activityId) {
        const [existing] = await ctx.db.select({ id: processingActivities.id }).from(processingActivities).where(and(
          eq(processingActivities.id, activityId),
          eq(processingActivities.organizationId, orgId),
        ));
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });

        await ctx.db.update(processingActivities)
          .set({ ...scalars, updatedAt: new Date() })
          .where(and(
            eq(processingActivities.id, activityId),
            eq(processingActivities.organizationId, orgId),
          ));
      } else {
        const [row] = await ctx.db.insert(processingActivities).values({
          organizationId: orgId,
          name: (scalars.name as string) ?? 'Untitled activity',
          purpose: (scalars.purpose as string) ?? 'Drafted from a description; the purpose still needs review.',
          lawfulBasis: (scalars.lawfulBasis as string) ?? 'legitimate_interest',
          status: 'draft',
          source: 'ai_draft',
          createdBy: ctx.user!.id,
          ...scalars,
        }).returning();
        if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not create the activity' });
        activityId = row.id;
        created = true;
      }

      if (rows.dataSubjects?.length) {
        await ctx.db.insert(processingDataSubjects).values(
          (rows.dataSubjects as any[]).map((r) => ({ ...r, processingActivityId: activityId! })),
        ).onConflictDoNothing();
      }
      if (rows.dataCategories?.length) {
        await ctx.db.insert(processingDataCategories).values(
          (rows.dataCategories as any[]).map((r) => ({ ...r, processingActivityId: activityId! })),
        );
      }
      if (rows.recipients?.length) {
        await ctx.db.insert(processingRecipients).values(
          (rows.recipients as any[]).map((r) => ({ ...r, processingActivityId: activityId! })),
        );
      }
      if (rows.transfers?.length) {
        await ctx.db.insert(processingTransfers).values(
          (rows.transfers as any[]).map((r) => ({ ...r, processingActivityId: activityId! })),
        );
      }

      await ctx.db.update(ropaActivityDrafts)
        .set({
          status: 'applied',
          appliedActivityId: activityId,
          appliedAt: new Date(),
          appliedBy: ctx.user!.id,
          updatedAt: new Date(),
        })
        .where(and(
          eq(ropaActivityDrafts.id, input.id),
          eq(ropaActivityDrafts.organizationId, orgId),
        ));

      return { activityId, created };
    }),

  discard: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(ropaActivityDrafts)
        .set({ status: 'discarded', updatedAt: new Date() })
        .where(and(
          eq(ropaActivityDrafts.id, input.id),
          eq(ropaActivityDrafts.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      return row;
    }),
});

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim());
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v));
}
