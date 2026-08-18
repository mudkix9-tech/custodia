import { paginatedQuery } from '../utils/pagination.js';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, legitimateInterestAssessments, processingDataCategories, processingDataSubjects, processingRecipients, processingTransfers, dataElementCatalogue, dataSubjectCategoryCatalogue, auditLogs, vendors, organizationVendors, clientProcessingActivities, reconsentFlags, dpias, users } from 'db';
import { eq, and, desc, inArray, not, count, isNull, asc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { assertOwned, assertParentOwned } from '../lib/tenancy.js';
import DOMPurify from 'isomorphic-dompurify';
import { queueNotification } from '../utils/notifications.js';
import { reconsentQueue } from '../workers/index.js';
import { enforceLimit } from '../lib/billing.js';
import { isAdequateDestination, EU_EEA_COUNTRIES, ADEQUACY_DECISIONS } from '../constants/transferDestinations.js';
import {
  SPECIAL_CATEGORY_TYPES,
  ARTICLE_9_CONDITIONS,
  IDENTIFIABILITY_LEVELS,
  SENSITIVITY_LEVELS,
  RETENTION_TRIGGERS,
  VOLUME_BANDS,
  RECIPIENT_CATEGORIES,
  RECIPIENT_ROLES,
  TRANSFER_MECHANISMS,
  SCC_YEARS,
  SCC_MODULES,
  ARTICLE_49_SUB_REASONS,
  DPF_SCOPES,
} from '../constants/ropaVocabularies.js';
import { humaniseSubjectCategory } from '../constants/ropaCatalogueSeeds.js';
import { ensureCatalogues, listElements, listSubjectCategories } from '../lib/ropaCatalogues.js';
import { scoreActivity, evaluatePublication, type ActivityBundle } from '../lib/ropaCompleteness.js';

const sanitize = (text?: string) => {
  if (!text) return text;
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};

// Helpers
const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Update payloads.
//
// These four mutations took an unconstrained `z.record(z.any())` and spread it into
// `.set()`. Ownership of the *row* was checked; the *contents* were not, so anyone
// holding `ropa:edit` could set `organization_id` and move a record into another
// tenant, or write `created_by`, `deleted_at`, `version`, or a `dpia_id` belonging
// to someone else. The tenancy guard cannot see that class — the filter is correct
// and the payload is the problem.
//
// Unknown keys are *stripped*, not rejected (zod's default). The editor autosaves
// `watch()` wholesale, which includes five form fields that have no column
// (`isLargeScale`, `isAutomatedDecisionMaking`, `retentionSchedule`, `securityNotes`,
// `lawfulBasisNotes`); Drizzle already discarded those silently, so stripping keeps
// the tab working while closing the hole. `.strict()` here would 400 every save.
//
// `lawfulBasis` and `retentionPeriod` are bounded strings rather than enums on
// purpose: the onboarding templates seed values the editor's own selects cannot
// represent ('legitimate_interests', prose retention periods), and those rows are
// autosaved back verbatim. Tightening them belongs with the fix to the templates,
// not here, where it would break editing every seeded activity.
// ---------------------------------------------------------------------------

const activityUpdateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  purpose: z.string().min(1),
  role: z.enum(['controller', 'processor', 'joint_controller']),
  controllerName: z.string().max(255).nullable(),
  lawfulBasis: z.string().max(50),
  lawfulBasisDetail: z.string().nullable(),
  isSystematicMonitoring: z.boolean(),
  retentionPeriod: z.string().max(100).nullable(),
  retentionJustification: z.string().nullable(),
  retentionReviewDate: z.coerce.date().nullable(),
  deletionProcedure: z.string().nullable(),
  securityMeasures: z.array(z.string()),
  securityMeasuresDetail: z.string().nullable(),
  status: z.enum(['draft', 'active', 'under_review', 'archived']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  // Ownership is proved in the mutation — a uuid alone does not say whose DPIA it is.
  dpiaId: z.string().uuid().nullable(),

  // Art. 22. The two flags on their own are the part that was already implicit in
  // riskLevel; the three prose fields are what Art. 22(3) and Art. 13(2)(f) actually
  // require and what no screen could record.
  involvesProfiling: z.boolean(),
  involvesAutomatedDecisionMaking: z.boolean(),
  admLogic: z.string().nullable(),
  admSignificance: z.string().nullable(),
  admHumanIntervention: z.string().nullable(),

  // Both are proved against the caller's own organisation in the mutation, for the
  // same reason dpiaId is: a uuid says nothing about whose user it is, and an
  // owner pointing at a stranger is a quiet cross-tenant disclosure of who works
  // where every time the register is exported.
  businessOwnerId: z.string().uuid().nullable(),
  privacyOwnerId: z.string().uuid().nullable(),
}).partial();

/**
 * B23. Sent alongside a status change to 'active' when the record does not meet the
 * gate. Deliberately not part of `activityUpdateSchema`: it is a decision about this
 * one save, not a field of the activity, and the columns that record it
 * (`publication_exception_by`, `_at`) are written by the server, never by a caller.
 */
const publicationExceptionInput = z.string().min(10).max(2000).optional();

const dataCategoryUpdateSchema = z.object({
  catalogueId: z.string().uuid().nullable(),
  category: z.string().min(1).max(100),
  categoryGroup: z.string().min(1).max(100),
  description: z.string().nullable(),
  source: z.string().max(100).nullable(),
  sourceDetail: z.string().nullable(),
  // Art. 9(2) / Art. 10. Enums rather than free text because "which activities
  // process health data?" is the question a DPO is asked most often, and free text
  // cannot answer it.
  specialCategoryType: z.enum(SPECIAL_CATEGORY_TYPES).nullable(),
  article9Condition: z.enum(ARTICLE_9_CONDITIONS).nullable(),
  article9NationalLawBasis: z.string().nullable(),
  isCriminalData: z.boolean(),
  article10Basis: z.string().nullable(),
  identifiability: z.enum(IDENTIFIABILITY_LEVELS).nullable(),
  necessityJustification: z.string().nullable(),
  // Art. 30(1)(f), per category. Free text for the same reason the activity-level
  // one is: the onboarding templates seed prose that is a better answer than any
  // preset, and a good answer must not be unrepresentable.
  retentionPeriod: z.string().max(100).nullable(),
  retentionTrigger: z.string().max(100).nullable(),
  retentionJustification: z.string().nullable(),
  isSpecialCategory: z.boolean(),
}).partial();

const recipientUpdateSchema = z.object({
  recipientType: z.string().min(1).max(50),
  // Art. 30(1)(d) asks for the categories; the name is what a DPO wants. Both.
  recipientCategory: z.enum(RECIPIENT_CATEGORIES).nullable(),
  name: z.string().min(1).max(255),
  role: z.enum(RECIPIENT_ROLES).nullable(),
  vendorId: z.string().uuid().nullable(),
  purpose: z.string().nullable(),
}).partial();

const dataSubjectUpdateSchema = z.object({
  catalogueId: z.string().uuid().nullable(),
  category: z.string().min(1).max(120),
  isChild: z.boolean(),
  isVulnerable: z.boolean(),
  volumeBand: z.enum(VOLUME_BANDS).nullable(),
  jurisdictions: z.array(z.string().length(2)),
}).partial();

// tiaCompleted and tiaRiskLevel are deliberately absent: they are Chapter V evidence
// derived from a completed TIA, and nothing a register editor may assert directly.
const transferUpdateSchema = z.object({
  destinationCountry: z.string().length(2),
  destinationEntity: z.string().max(255).nullable(),
  vendorId: z.string().uuid().nullable(),
  // Still a bounded string rather than the enum, because the tab shipped prose
  // ('Standard Contractual Clauses (SCCs)') and the auto-create path a slug
  // ('pending_assessment'); both are in the column today and rejecting either would
  // 400 the first edit of an existing row. New writes come from the enum-backed
  // picker, and normaliseTransferMechanism bridges the two on read — D43.
  transferMechanism: z.string().min(1).max(100),
  mechanismDetail: z.string().nullable(),

  // H76/H77. "SCCs" on its own is not a Chapter V record.
  sccYear: z.enum(SCC_YEARS).nullable(),
  sccModule: z.enum(SCC_MODULES).nullable(),
  annexesComplete: z.boolean(),
  executionDate: z.coerce.date().nullable(),
  expiryDate: z.coerce.date().nullable(),
  signatories: z.string().max(1000).nullable(),
  bcrReference: z.string().max(255).nullable(),
  adequacyDecisionReference: z.string().max(255).nullable(),
  article49SubReason: z.enum(ARTICLE_49_SUB_REASONS).nullable(),
  article49Justification: z.string().nullable(),
  dpfCertificationNumber: z.string().max(100).nullable(),
  dpfScope: z.enum(DPF_SCOPES).nullable(),
  dpfExpiryDate: z.coerce.date().nullable(),

  tiaRequired: z.boolean(),
  supplementaryMeasures: z.array(z.string()),
}).partial();

// tiaCompleted, tiaRiskLevel and documentId stay out of both transfer schemas.
// The first two are Chapter V evidence derived from a completed TIA — D3 was one
// tenant writing them across another's rows, and a register editor asserting them
// directly is the same fabrication by a shorter route. documentId is a foreign key
// into `documents`, which would need its own ownership proof; the transfer document
// is J-series work, not Sprint 1.

/**
 * `processing_activities.data_subject_categories` is a jsonb array of strings, read
 * by the CSV export, both PDF templates, the audit pack, the embeddings worker and
 * the register list. `processing_data_subjects` is the structured record that
 * replaces it. Rather than migrate five readers at once, the array is kept as a
 * derived mirror: authoritative nowhere, rewritten here after every mutation on the
 * child table, so nothing downstream had to change and nothing can drift.
 */
async function syncDataSubjectMirror(dbc: any, activityId: string) {
  const rows = await dbc.select({ category: processingDataSubjects.category })
    .from(processingDataSubjects)
    .where(eq(processingDataSubjects.processingActivityId, activityId))
    .orderBy(asc(processingDataSubjects.category));

  // Deliberately does not touch updatedAt. The register sorts on it, so bumping it
  // would re-order the list by who last edited a child row (D1's lesson), and the
  // editor's optimistic lock compares against it — the open editor's next autosave
  // would come back CONFLICT on a record nobody else had touched (D45's).
  await dbc.update(processingActivities)
    .set({ dataSubjectCategories: rows.map((r: any) => r.category) })
    .where(eq(processingActivities.id, activityId));
}

/**
 * The 32 onboarding templates wrote subject categories into the jsonb array and
 * nothing has ever been able to edit them (D30). The first time an activity's
 * subject categories are opened, whatever is in that array becomes real rows —
 * matched to the catalogue by name where one exists, so `website_visitors` arrives
 * as "Website visitors" carrying the catalogue's child and vulnerable flags.
 *
 * Runs once per activity: after it, the child table is non-empty and the guard at
 * the top returns. An activity whose categories are genuinely all deleted stays
 * empty, because the mirror is emptied at the same time.
 */
async function backfillDataSubjects(dbc: any, orgId: string, activityId: string) {
  const existing = await dbc.select({ id: processingDataSubjects.id })
    .from(processingDataSubjects)
    .where(eq(processingDataSubjects.processingActivityId, activityId))
    .limit(1);
  if (existing.length > 0) return;

  const [activity] = await dbc.select({ categories: processingActivities.dataSubjectCategories })
    .from(processingActivities)
    .where(eq(processingActivities.id, activityId));

  const raw = Array.isArray(activity?.categories) ? (activity!.categories as unknown[]) : [];
  const names = raw
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => humaniseSubjectCategory(v));
  if (names.length === 0) return;

  await ensureCatalogues(dbc, orgId);
  const catalogue = await listSubjectCategories(dbc, orgId);
  const byName = new Map<string, any>(catalogue.map((c: any) => [c.name.toLowerCase(), c]));

  // Deduplicated because two template slugs can humanise to the same category, and
  // the (activity, category) unique constraint would reject the second.
  const seen = new Set<string>();
  const values = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const match = byName.get(key);
    values.push({
      processingActivityId: activityId,
      catalogueId: match?.id ?? null,
      category: match?.name ?? name.slice(0, 120),
      isChild: match?.isChild ?? false,
      isVulnerable: match?.isVulnerable ?? false,
    });
  }

  if (values.length === 0) return;
  await dbc.insert(processingDataSubjects).values(values).onConflictDoNothing();
  await syncDataSubjectMirror(dbc, activityId);
}

/** Everything `scoreActivity` needs for one activity, in four child queries. */
async function loadBundle(dbc: any, activity: any): Promise<ActivityBundle> {
  const [dataSubjects, dataCategories, recipients, transfers] = await Promise.all([
    dbc.select().from(processingDataSubjects).where(eq(processingDataSubjects.processingActivityId, activity.id)),
    dbc.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, activity.id)),
    dbc.select().from(processingRecipients).where(eq(processingRecipients.processingActivityId, activity.id)),
    dbc.select().from(processingTransfers).where(eq(processingTransfers.processingActivityId, activity.id)),
  ]);
  return { activity, dataSubjects, dataCategories, recipients, transfers };
}

/**
 * B18. An owner id is client-supplied, and `users` is not org-scoped by the table —
 * pointing an activity's owner at a stranger would leak who works where into every
 * export of the register. Same class as the dpiaId check above it, which is the one
 * the first tenancy audit missed.
 */
async function assertOwnersInOrg(dbc: any, orgId: string, data: { businessOwnerId?: string | null; privacyOwnerId?: string | null }) {
  const ids = [data.businessOwnerId, data.privacyOwnerId].filter((v): v is string => !!v);
  if (ids.length === 0) return;

  const found = await dbc.select({ id: users.id }).from(users)
    .where(and(inArray(users.id, ids), eq(users.organizationId, orgId)));

  if (found.length !== new Set(ids).size) {
    // NOT_FOUND rather than FORBIDDEN, for the reason tenancy.ts states: "this
    // exists but is not yours" confirms the id is real.
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });
  }
}

export const ropaRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(paginationInput.extend({
      // B18. Server-side, not a filter over the loaded page: "show me the activities
      // nobody owns" has to mean the register, not the twenty-five rows that happen
      // to be on screen. The general case — arbitrary filters and saved views — is
      // K102–K104; these two are the ones the owner field exists to answer.
      ownership: z.enum(['all', 'mine', 'unowned']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const filters: any[] = [
        // auditExport and scoring already filter on this. The register did not, so a
        // deleted activity stayed on screen, in the CSV and in the PDF while the audit
        // pack and the compliance score behaved as though it were gone.
        isNull(processingActivities.deletedAt),
      ];

      if (input.ownership === 'mine') {
        // Either hat. Someone who holds one of the two roles on a record has work to
        // do on it, and splitting the view in two would just mean checking both.
        filters.push(sql`(${processingActivities.businessOwnerId} = ${ctx.user!.id} OR ${processingActivities.privacyOwnerId} = ${ctx.user!.id})`);
      } else if (input.ownership === 'unowned') {
        filters.push(and(
          isNull(processingActivities.businessOwnerId),
          isNull(processingActivities.privacyOwnerId),
        ));
      }

      return paginatedQuery(
        processingActivities,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'updatedAt',
        'desc',
        filters,
      );
    }),

  // The dashboard tile wants an org-wide total. list is cursor-paginated, so
  // counting its rows would silently cap at the page size.
  countActive: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      const [row] = await ctx.db.select({ value: count() })
        .from(processingActivities)
        .where(and(
          eq(processingActivities.organizationId, ctx.user!.orgId),
          eq(processingActivities.status, 'active'),
        ));
      return row?.value ?? 0;
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await ctx.db.query.processingActivities.findFirst({
        where: and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        ),
        with: {
          clients: {
            with: { client: true }
          }
        }
      });

      if (!activity) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return activity;
    }),

  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      name: z.string().min(1),
      purpose: z.string().min(1),
      description: z.string().optional(),
      // The CSV importer refuses to guess a basis and cites Art. 30(1)(c) when it
      // rejects a row. The primary create path accepted '' and satisfied a NOT NULL
      // column with it, so the register rendered 'Unspecified' for anything made in
      // the UI. The form now collects it.
      lawfulBasis: z.string().min(1),
      // Art. 30(1) vs 30(2): the two records answer different questions.
      role: z.enum(['controller', 'processor', 'joint_controller']).default('controller'),
      controllerName: z.string().optional(),
      // Rendered on the create form and silently dropped: a user who chose
      // Active/Critical got Draft/Low back.
      // 'active' is absent on purpose. B23 makes 'active' mean "this record answers
      // Art. 30", and a brand-new activity has no data subjects, no data categories
      // and no recipients — it cannot answer it yet, so offering the option here
      // could only ever produce a refusal or, worse, a silent downgrade of the kind
      // that made D10 a defect. Publication happens in the editor, through the gate.
      status: z.enum(['draft', 'under_review']).default('draft'),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
      isSystematicMonitoring: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await enforceLimit(ctx.db, ctx.user!.orgId, 'ropa', 1);
      
      const [newActivity] = await ctx.db.insert(processingActivities).values({
        organizationId: ctx.user!.orgId,
        name: sanitize(input.name)!,
        purpose: sanitize(input.purpose)!,
        description: sanitize(input.description),
        lawfulBasis: input.lawfulBasis,
        role: input.role,
        controllerName: sanitize(input.controllerName),
        status: input.status,
        riskLevel: input.riskLevel,
        isSystematicMonitoring: input.isSystematicMonitoring,
        createdBy: ctx.user!.id,
      }).returning();

      if (!newActivity) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: newActivity.id,
        action: 'upsert'
      });

      return newActivity;
    }),

  bulkCreate: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.array(z.object({
      name: z.string().min(1),
      purpose: z.string().min(1),
      description: z.string().optional(),
      lawfulBasis: z.string(),
      // Same reason as `create`. An imported row arrives with no children at all, so
      // an 'active' status on it would be a published Art. 30 record asserting
      // nothing. Rejected rather than quietly downgraded — the CSV importer names
      // the row and the reason, which is the same thing it already does when it
      // refuses to guess a lawful basis.
      status: z.enum(['draft', 'under_review', 'archived']).default('draft'),
      riskLevel: z.string().default('low'),
      role: z.enum(['controller', 'processor', 'joint_controller']).default('controller'),
      controllerName: z.string().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      if (input.length === 0) return [];
      await enforceLimit(ctx.db, ctx.user!.orgId, 'ropa', input.length);

      const values = input.map((item: any) => ({
        ...item,
        name: sanitize(item.name)!,
        purpose: sanitize(item.purpose)!,
        description: sanitize(item.description),
        controllerName: sanitize(item.controllerName),
        organizationId: ctx.user!.orgId,
        createdBy: ctx.user!.id,
      }));

      const newActivities = await ctx.db.insert(processingActivities).values(values).returning();

      for (const act of newActivities) {
        await orgEmbeddingsQueue.add('embed-ropa', {
          orgId: ctx.user!.orgId,
          entityType: 'processing_activity',
          entityId: act.id,
          action: 'upsert'
        });
      }

      return newActivities;
    }),

  update: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      updatedAt: z.string().datetime().optional(), // for optimistic locking
      data: activityUpdateSchema,
      publicationExceptionReason: publicationExceptionInput,
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const activity = await ctx.db.query.processingActivities.findFirst({
        where: and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        )
      });

      if (!activity) throw new TRPCError({ code: 'NOT_FOUND' });
      
      // Optimistic Locking check
      if (input.updatedAt && new Date(input.updatedAt).getTime() !== activity.updatedAt?.getTime()) {
        throw new TRPCError({ 
          code: 'CONFLICT', 
          message: 'The record was updated by someone else. Please reload.' 
        });
      }

      // A client-supplied foreign key is exactly the case the first tenancy audit missed:
      // the row being edited is ours, the DPIA it points at need not be.
      if (input.data.dpiaId) {
        await assertParentOwned(ctx.db, dpias, input.data.dpiaId, ctx.user!.orgId, 'DPIA');
      }
      await assertOwnersInOrg(ctx.db, ctx.user!.orgId, input.data);

      const sanitizedData: Record<string, any> = { ...input.data };
      if (sanitizedData.name) sanitizedData.name = sanitize(sanitizedData.name);
      if (sanitizedData.purpose) sanitizedData.purpose = sanitize(sanitizedData.purpose);
      if (sanitizedData.description) sanitizedData.description = sanitize(sanitizedData.description);

      // ---- B23, the publication gate -------------------------------------
      // Only on the transition *into* 'active'. Re-saving a record that is already
      // active does not re-run the gate: an activity published before the gate
      // existed, or under a recorded exception, must stay editable — otherwise the
      // gate locks people out of fixing the very fields it is complaining about.
      const becomingActive = sanitizedData.status === 'active' && activity.status !== 'active';
      if (becomingActive) {
        const bundle = await loadBundle(ctx.db, { ...activity, ...sanitizedData });
        const verdict = evaluatePublication(bundle, { exceptionReason: input.publicationExceptionReason });

        if (!verdict.canPublish) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `This activity cannot be published: ${verdict.blockers.map((b) => `${b.label} (${b.article})`).join(', ')}.`,
            cause: { blockers: verdict.blockers },
          });
        }

        sanitizedData.publishedAt = new Date();
        sanitizedData.publishedBy = ctx.user!.id;
        if (verdict.viaException) {
          // Named, dated and attributed. An exception that is not recorded is a
          // gate that does not exist.
          sanitizedData.publicationExceptionReason = sanitize(input.publicationExceptionReason)!;
          sanitizedData.publicationExceptionBy = ctx.user!.id;
          sanitizedData.publicationExceptionAt = new Date();
        } else {
          // Publishing cleanly clears a previous exception rather than leaving the
          // register asserting an override that no longer applies.
          sanitizedData.publicationExceptionReason = null;
          sanitizedData.publicationExceptionBy = null;
          sanitizedData.publicationExceptionAt = null;
        }
      }

      const [updated] = await ctx.db.update(processingActivities)
        .set({ ...sanitizedData, updatedAt: new Date() })
        .where(eq(processingActivities.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: updated.id,
        action: 'upsert'
      });

      if (activity.lawfulBasis === 'consent' && activity.purpose !== updated.purpose) {
        // Fetch context for Claude
        const dataCats = await ctx.db.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, activity.id));
        const recipients = await ctx.db.select({ vendorName: vendors.name, purpose: processingRecipients.purpose })
          .from(processingRecipients)
          .leftJoin(vendors, eq(processingRecipients.vendorId, vendors.id))
          .where(eq(processingRecipients.processingActivityId, activity.id));

        // Use a Redis-based debounce trick: setting the jobId to include a time-block (e.g. per 5-minute window) 
        // to prevent rapid back-to-back checks for the same activity in a single edit session.
        const timeBlock = Math.floor(Date.now() / (5 * 60 * 1000)); 
        await reconsentQueue.add('evaluate-material-change', {
          activityId: updated.id,
          organizationId: ctx.user!.orgId,
          oldPurpose: activity.purpose,
          newPurpose: updated.purpose,
          lawfulBasis: activity.lawfulBasis,
          dataCategories: dataCats.map((d: any) => d.category),
          vendorList: recipients.map((r: any) => ({ name: r.vendorName || 'Unknown', purpose: r.purpose }))
        }, {
          jobId: `reconsent-${updated.id}-${timeBlock}`,
          delay: 5000 // wait 5 seconds before processing, allows final edit to settle
        });
      }

      return updated;
    }),

  delete: protectedProcedure
    .use(requirePermission('ropa', 'delete'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [deleted] = await ctx.db.update(processingActivities)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId)
        ))
        .returning();

      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND' });

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: deleted.id,
        action: 'delete'
      });

      return deleted;
    }),

  // Advanced features and nested routers to be expanded...
  history: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ activityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        
        // We can just use standard filtering on resourceId
        const logs = await ctx.db.select().from(auditLogs)
          .where(and(
            eq(auditLogs.organizationId, ctx.user!.orgId),
            eq(auditLogs.resourceId, input.activityId)
          ))
          .orderBy(desc(auditLogs.createdAt));
          
        return logs;
      }),
  }),

  /**
   * B25/B26. One activity's score and its unmet requirements, for the ring in the
   * editor header and the "what's missing" panel beside it.
   */
  completeness: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await ctx.db.query.processingActivities.findFirst({
        where: and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId),
        ),
      });
      if (!activity) throw new TRPCError({ code: 'NOT_FOUND' });

      return scoreActivity(await loadBundle(ctx.db, activity));
    }),

  /**
   * The same score for a page of the register, in five queries rather than five per
   * row. The list renders 25 activities; scoring them one at a time would be 125
   * round trips on a 512MB box that also runs Chromium.
   */
  completenessBatch: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ ids: z.array(z.string().uuid()).max(100) }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const empty: Record<string, number> = {};
      if (input.ids.length === 0) return empty;

      // Ownership is proved by the filter, not by the input: ids belonging to another
      // tenant simply do not come back, and score nothing.
      const activities = await ctx.db.select().from(processingActivities)
        .where(and(
          inArray(processingActivities.id, input.ids),
          eq(processingActivities.organizationId, ctx.user!.orgId),
          isNull(processingActivities.deletedAt),
        ));
      if (activities.length === 0) return empty;

      const ids = activities.map((a: any) => a.id);
      const [subjects, categories, recipients, transfers] = await Promise.all([
        ctx.db.select().from(processingDataSubjects).where(inArray(processingDataSubjects.processingActivityId, ids)),
        ctx.db.select().from(processingDataCategories).where(inArray(processingDataCategories.processingActivityId, ids)),
        ctx.db.select().from(processingRecipients).where(inArray(processingRecipients.processingActivityId, ids)),
        ctx.db.select().from(processingTransfers).where(inArray(processingTransfers.processingActivityId, ids)),
      ]);

      const bucket = (rows: any[]) => {
        const map = new Map<string, any[]>();
        for (const row of rows) {
          const list = map.get(row.processingActivityId);
          if (list) list.push(row); else map.set(row.processingActivityId, [row]);
        }
        return map;
      };
      const bySubject = bucket(subjects as any[]);
      const byCategory = bucket(categories as any[]);
      const byRecipient = bucket(recipients as any[]);
      const byTransfer = bucket(transfers as any[]);

      for (const activity of activities as any[]) {
        empty[activity.id] = scoreActivity({
          activity,
          dataSubjects: bySubject.get(activity.id) ?? [],
          dataCategories: byCategory.get(activity.id) ?? [],
          recipients: byRecipient.get(activity.id) ?? [],
          transfers: byTransfer.get(activity.id) ?? [],
        }).score;
      }
      return empty;
    }),

  /**
   * H75. Adequacy, computed rather than hardcoded a second time.
   *
   * `apps/web/utils/countries.ts` deliberately does not encode adequacy — it changes
   * by Commission decision and it carries scope caveats — and says so in its header.
   * A second copy in the web workspace is exactly the duplication that produced D17,
   * where the ROPA router's private EU-27 array fabricated a Chapter V transfer for
   * every vendor in Norway, the UK, Switzerland, Japan and thirteen other adequate
   * destinations. One list, served.
   */
  transferDestinations: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(() => ({
      euEea: EU_EEA_COUNTRIES,
      adequacy: ADEQUACY_DECISIONS,
    })),

  /**
   * A2/A3. The org-level catalogues the child rows point at. Seeded on first read —
   * see lib/ropaCatalogues.ts for why that is lazy rather than a migration.
   */
  catalogue: router({
    elements: router({
      list: protectedProcedure
        .use(requirePermission('ropa', 'view'))
        .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
        .query(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          return listElements(ctx.db, ctx.user!.orgId, input?.includeArchived ?? false);
        }),
      create: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({
          name: z.string().min(1).max(120),
          elementGroup: z.string().min(1).max(100),
          description: z.string().max(2000).optional(),
          sensitivity: z.enum(SENSITIVITY_LEVELS).default('standard'),
          isSpecialCategory: z.boolean().default(false),
          specialCategoryType: z.enum(SPECIAL_CATEGORY_TYPES).nullish(),
          isCriminalData: z.boolean().default(false),
          identifiability: z.enum(IDENTIFIABILITY_LEVELS).default('direct'),
          format: z.string().max(50).optional(),
          example: z.string().max(500).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          await ensureCatalogues(ctx.db, ctx.user!.orgId);
          try {
            const [inserted] = await ctx.db.insert(dataElementCatalogue).values({
              ...input,
              name: sanitize(input.name)!,
              elementGroup: sanitize(input.elementGroup)!,
              description: sanitize(input.description),
              example: sanitize(input.example),
              organizationId: ctx.user!.orgId,
            }).returning();
            return inserted;
          } catch (err: any) {
            // The (organization_id, name) unique constraint. Surfaced as a named
            // conflict rather than a 500, because "you already have one of those"
            // is the answer the user needs.
            if (err?.code === '23505') {
              throw new TRPCError({ code: 'CONFLICT', message: `"${input.name}" is already in your data element catalogue.` });
            }
            throw err;
          }
        }),
      update: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({
          id: z.string().uuid(),
          data: z.object({
            name: z.string().min(1).max(120),
            elementGroup: z.string().min(1).max(100),
            description: z.string().max(2000).nullable(),
            sensitivity: z.enum(SENSITIVITY_LEVELS),
            isSpecialCategory: z.boolean(),
            specialCategoryType: z.enum(SPECIAL_CATEGORY_TYPES).nullable(),
            isCriminalData: z.boolean(),
            identifiability: z.enum(IDENTIFIABILITY_LEVELS),
            format: z.string().max(50).nullable(),
            example: z.string().max(500).nullable(),
          }).partial(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          const [updated] = await ctx.db.update(dataElementCatalogue)
            .set({ ...input.data, updatedAt: new Date() })
            .where(and(
              eq(dataElementCatalogue.id, input.id),
              eq(dataElementCatalogue.organizationId, ctx.user!.orgId),
            ))
            .returning();
          if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
          return updated;
        }),
      /**
       * Archive, not delete. Child rows carry a denormalised copy of the name, so a
       * hard delete would not corrupt a published register — but it would break the
       * `catalogue_id` link that answers "which activities process health data?",
       * and that link is the entire reason the catalogue exists.
       */
      archive: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({ id: z.string().uuid(), archived: z.boolean().default(true) }))
        .mutation(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          const [updated] = await ctx.db.update(dataElementCatalogue)
            .set({ archivedAt: input.archived ? new Date() : null, updatedAt: new Date() })
            .where(and(
              eq(dataElementCatalogue.id, input.id),
              eq(dataElementCatalogue.organizationId, ctx.user!.orgId),
            ))
            .returning();
          if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
          return updated;
        }),
    }),

    subjects: router({
      list: protectedProcedure
        .use(requirePermission('ropa', 'view'))
        .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
        .query(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          return listSubjectCategories(ctx.db, ctx.user!.orgId, input?.includeArchived ?? false);
        }),
      create: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({
          name: z.string().min(1).max(120),
          description: z.string().max(2000).optional(),
          isChild: z.boolean().default(false),
          isVulnerable: z.boolean().default(false),
        }))
        .mutation(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          await ensureCatalogues(ctx.db, ctx.user!.orgId);
          try {
            const [inserted] = await ctx.db.insert(dataSubjectCategoryCatalogue).values({
              ...input,
              name: sanitize(input.name)!,
              description: sanitize(input.description),
              organizationId: ctx.user!.orgId,
            }).returning();
            return inserted;
          } catch (err: any) {
            if (err?.code === '23505') {
              throw new TRPCError({ code: 'CONFLICT', message: `"${input.name}" is already in your data subject catalogue.` });
            }
            throw err;
          }
        }),
      update: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({
          id: z.string().uuid(),
          data: z.object({
            name: z.string().min(1).max(120),
            description: z.string().max(2000).nullable(),
            isChild: z.boolean(),
            isVulnerable: z.boolean(),
          }).partial(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          const [updated] = await ctx.db.update(dataSubjectCategoryCatalogue)
            .set({ ...input.data, updatedAt: new Date() })
            .where(and(
              eq(dataSubjectCategoryCatalogue.id, input.id),
              eq(dataSubjectCategoryCatalogue.organizationId, ctx.user!.orgId),
            ))
            .returning();
          if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
          return updated;
        }),
      archive: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({ id: z.string().uuid(), archived: z.boolean().default(true) }))
        .mutation(async ({ ctx, input }) => {
          checkOrgContext(ctx.user);
          const [updated] = await ctx.db.update(dataSubjectCategoryCatalogue)
            .set({ archivedAt: input.archived ? new Date() : null, updatedAt: new Date() })
            .where(and(
              eq(dataSubjectCategoryCatalogue.id, input.id),
              eq(dataSubjectCategoryCatalogue.organizationId, ctx.user!.orgId),
            ))
            .returning();
          if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
          return updated;
        }),
    }),
  }),

  /**
   * D30/A3. Art. 30(1)(c), first limb — displayed in the register, warned about when
   * empty, and editable nowhere until now.
   */
  dataSubjects: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        // Whatever the onboarding templates left in the jsonb array becomes real
        // rows the first time anyone looks. Runs once per activity.
        await backfillDataSubjects(ctx.db, ctx.user!.orgId, input.processingActivityId);
        return ctx.db.select().from(processingDataSubjects)
          .where(eq(processingDataSubjects.processingActivityId, input.processingActivityId))
          .orderBy(asc(processingDataSubjects.category));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        catalogueId: z.string().uuid().nullish(),
        category: z.string().min(1).max(120),
        isChild: z.boolean().default(false),
        isVulnerable: z.boolean().default(false),
        volumeBand: z.enum(VOLUME_BANDS).nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        // A catalogue id is client-supplied and the catalogue is org-scoped, so it
        // has to be proved the same way dpiaId is. The flags are then taken from the
        // catalogue entry rather than the caller: whether a category is a child or a
        // vulnerable category is a property of the category, and letting a caller
        // assert otherwise is how "Children" ends up in a register with isChild false.
        let category = sanitize(input.category)!.slice(0, 120);
        let isChild = input.isChild;
        let isVulnerable = input.isVulnerable;
        if (input.catalogueId) {
          const entry: any = await assertParentOwned(ctx.db, dataSubjectCategoryCatalogue, input.catalogueId, ctx.user!.orgId, 'Data subject category');
          category = entry.name;
          isChild = entry.isChild;
          isVulnerable = entry.isVulnerable;
        }

        try {
          const [inserted] = await ctx.db.insert(processingDataSubjects).values({
            processingActivityId: input.processingActivityId,
            catalogueId: input.catalogueId ?? null,
            category,
            isChild,
            isVulnerable,
            volumeBand: input.volumeBand ?? null,
          }).returning();

          await syncDataSubjectMirror(ctx.db, input.processingActivityId);

          // Art. 8 / Recital 38: children's data is an Art. 35(3) screening trigger,
          // and the escalation already exists for special categories. Same rule.
          if (inserted?.isChild) {
            await ctx.db.update(processingActivities)
              .set({ involvesChildren: true, requiresDpia: true })
              .where(eq(processingActivities.id, input.processingActivityId));
          }

          return inserted;
        } catch (err: any) {
          if (err?.code === '23505') {
            throw new TRPCError({ code: 'CONFLICT', message: `"${category}" is already recorded for this activity.` });
          }
          throw err;
        }
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid(), data: dataSubjectUpdateSchema }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingDataSubjects,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Data subject category',
          via: [{ table: processingActivities, on: eq(processingDataSubjects.processingActivityId, processingActivities.id) }],
        });

        if (input.data.catalogueId) {
          await assertParentOwned(ctx.db, dataSubjectCategoryCatalogue, input.data.catalogueId, ctx.user!.orgId, 'Data subject category');
        }

        const [updated] = await ctx.db.update(processingDataSubjects)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingDataSubjects.id, input.id))
          .returning();
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

        if (input.data.category !== undefined) {
          await syncDataSubjectMirror(ctx.db, updated.processingActivityId);
        }
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: processingDataSubjects,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Data subject category',
          via: [{ table: processingActivities, on: eq(processingDataSubjects.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingDataSubjects)
          .where(eq(processingDataSubjects.id, input.id))
          .returning();

        await syncDataSubjectMirror(ctx.db, existing.processingActivityId);

        // Mirrors the special-category de-escalation below: once the last child
        // category has gone, the flag that says children are involved has to go too,
        // or the register keeps asserting an Art. 8 concern that no longer exists.
        if (existing.isChild) {
          const remainingChild = await ctx.db.select({ id: processingDataSubjects.id })
            .from(processingDataSubjects)
            .where(and(
              eq(processingDataSubjects.processingActivityId, existing.processingActivityId),
              eq(processingDataSubjects.isChild, true),
            ));
          if (remainingChild.length === 0) {
            await ctx.db.update(processingActivities)
              .set({ involvesChildren: false })
              .where(eq(processingActivities.id, existing.processingActivityId));
          }
        }

        return deleted;
      }),
  }),

  dataCategories: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        return ctx.db.select().from(processingDataCategories)
          .where(eq(processingDataCategories.processingActivityId, input.processingActivityId));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        catalogueId: z.string().uuid().nullish(),
        category: z.string().max(100),
        categoryGroup: z.string().max(100),
        isSpecialCategory: z.boolean().default(false),
        source: z.string().max(100).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        // Picking from the catalogue carries its classification across, so a row
        // added as "Health and medical information" arrives already knowing it is
        // Art. 9(1) health data. A hand-typed category still works and simply
        // carries whatever the caller said.
        const entry: any = input.catalogueId
          ? await assertParentOwned(ctx.db, dataElementCatalogue, input.catalogueId, ctx.user!.orgId, 'Data element')
          : null;

        const [inserted] = await ctx.db.insert(processingDataCategories).values({
          processingActivityId: input.processingActivityId,
          catalogueId: input.catalogueId ?? null,
          source: input.source,
          description: input.description,
          category: entry ? String(entry.name).slice(0, 100) : input.category,
          categoryGroup: entry ? entry.elementGroup : input.categoryGroup,
          isSpecialCategory: entry ? entry.isSpecialCategory : input.isSpecialCategory,
          specialCategoryType: entry ? entry.specialCategoryType : null,
          isCriminalData: entry ? entry.isCriminalData : false,
          identifiability: entry ? entry.identifiability : null,
        }).returning();

        if (inserted?.isSpecialCategory) {
          const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, input.processingActivityId));

          await ctx.db.update(processingActivities)
            .set({
              requiresDpia: true,
              involvesSpecialCategories: true,
              riskLevel: 'high', // escalate if currently low/medium
            })
            .where(eq(processingActivities.id, input.processingActivityId));

          if (ctx.user?.orgId && activity) {
            // Queue notification
            await queueNotification({
              organizationId: ctx.user.orgId,
              type: 'compliance.gap_detected' as any,
              title: 'DPIA required',
              body: `Adding special category data to "${activity.name}" requires a Data Protection Impact Assessment.`,
              actionUrl: `/ropa/${input.processingActivityId}?tab=dpia`,
            });
          }
        }
        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: dataCategoryUpdateSchema
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: processingDataCategories,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Data category',
          via: [{ table: processingActivities, on: eq(processingDataCategories.processingActivityId, processingActivities.id) }],
        });

        const [updated] = await ctx.db.update(processingDataCategories)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingDataCategories.id, input.id))
          .returning();

        if (updated?.isSpecialCategory && !existing.isSpecialCategory) {
          const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, updated.processingActivityId));
          await ctx.db.update(processingActivities)
            .set({
              requiresDpia: true,
              involvesSpecialCategories: true,
              riskLevel: 'high',
            })
            .where(eq(processingActivities.id, updated.processingActivityId));

          if (ctx.user?.orgId && activity) {
            // Queue notification
            await queueNotification({
              organizationId: ctx.user.orgId,
              type: 'compliance.gap_detected' as any,
              title: 'DPIA required',
              body: `Adding special category data to "${activity.name}" requires a Data Protection Impact Assessment.`,
              actionUrl: `/ropa/${updated.processingActivityId}?tab=dpia`,
            });
          }
        } else if (!updated?.isSpecialCategory && existing.isSpecialCategory && updated) {
          // Check if there are any other special categories remaining
          const remainingSpecial = await ctx.db.select().from(processingDataCategories)
            .where(and(
              eq(processingDataCategories.processingActivityId, updated.processingActivityId),
              eq(processingDataCategories.isSpecialCategory, true),
              not(eq(processingDataCategories.id, input.id))
            ));

          if (remainingSpecial.length === 0) {
            await ctx.db.update(processingActivities)
              .set({
                requiresDpia: false,
                involvesSpecialCategories: false,
                riskLevel: 'medium', // Reset to default/medium
              })
              .where(eq(processingActivities.id, updated.processingActivityId));
          }
        }

        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: processingDataCategories,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Data category',
          via: [{ table: processingActivities, on: eq(processingDataCategories.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingDataCategories)
          .where(eq(processingDataCategories.id, input.id))
          .returning();

        if (existing.isSpecialCategory) {
          const remainingSpecial = await ctx.db.select().from(processingDataCategories)
            .where(and(
              eq(processingDataCategories.processingActivityId, existing.processingActivityId),
              eq(processingDataCategories.isSpecialCategory, true),
              not(eq(processingDataCategories.id, input.id)) // Exclude the deleted one
            ));

          if (remainingSpecial.length === 0) {
            await ctx.db.update(processingActivities)
              .set({
                requiresDpia: false,
                involvesSpecialCategories: false,
                riskLevel: 'medium',
              })
              .where(eq(processingActivities.id, existing.processingActivityId));
          }
        }

        return deleted;
      })
  }),

  recipients: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // processing_recipients carries no organization_id, so the activity is
        // what has to be proved — otherwise this reads any tenant's recipients.
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const records = await ctx.db.select({
          recipient: processingRecipients,
          vendor: {
            id: vendors.id,
            name: vendors.name,
            headquartersCountry: vendors.headquartersCountry,
            category: vendors.category,
          },
          orgVendor: {
            dpaStatus: organizationVendors.dpaStatus,
            usingEuHosting: organizationVendors.usingEuHosting,
            riskScore: organizationVendors.riskScore,
            riskLevel: organizationVendors.riskLevel,
            dpaClauseCoverage: organizationVendors.dpaClauseCoverage,
          }
        })
        .from(processingRecipients)
        .leftJoin(vendors, eq(processingRecipients.vendorId, vendors.id))
        .leftJoin(organizationVendors, and(
          eq(vendors.id, organizationVendors.vendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ))
        .where(eq(processingRecipients.processingActivityId, input.processingActivityId));
        
        return records.map((r: any) => ({
          ...r.recipient,
          vendorData: r.vendor ? { ...r.vendor, ...r.orgVendor } : null
        }));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        recipientType: z.string().default('vendor'),
        // Art. 30(1)(d) and the Art. 28 chain. Optional at creation because the
        // Recipients tab adds a vendor in one click and asking for both up front
        // would turn that into a form; the completeness panel then asks for them.
        recipientCategory: z.enum(RECIPIENT_CATEGORIES).nullish(),
        role: z.enum(RECIPIENT_ROLES).nullish(),
        name: z.string(),
        purpose: z.string().optional(),
        vendorId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Unchecked, this wrote a recipient — and below, a transfer record and a
        // re-consent flag — into another tenant's processing activity.
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const [inserted] = await ctx.db.insert(processingRecipients).values({
          ...input,
        }).returning();

        // Auto-create transfer if vendor is outside EU and no EU hosting
        if (input.vendorId) {
          const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
          const [orgVendor] = await ctx.db.select().from(organizationVendors).where(and(eq(organizationVendors.vendorId, input.vendorId), eq(organizationVendors.organizationId, ctx.user!.orgId)));
          
          // The EU-27 array this used to hardcode treated Norway, Iceland,
          // Liechtenstein, the UK, Switzerland, Japan, Korea, Canada and the rest of
          // the adequacy list as third countries, and fabricated a Chapter V transfer
          // requiring SCCs for each. isAdequateDestination covers the EEA plus every
          // adequacy decision, and onboarding.ts was already using it.
          const hq = vendor?.headquartersCountry;
          const isAdequateHq = !!hq && isAdequateDestination(hq);
          const hasEuHosting = orgVendor?.usingEuHosting;

          if (!isAdequateHq && !hasEuHosting && hq) {
            // It's a non-EU transfer, create draft transfer
            const [existingTransfer] = await ctx.db.select().from(processingTransfers).where(and(
              eq(processingTransfers.processingActivityId, input.processingActivityId),
              eq(processingTransfers.vendorId, input.vendorId)
            ));

            if (!existingTransfer) {
              await ctx.db.insert(processingTransfers).values({
                processingActivityId: input.processingActivityId,
                destinationCountry: hq.substring(0, 2),
                destinationEntity: vendor.name,
                vendorId: input.vendorId,
                transferMechanism: 'pending_assessment',
              });
            }
          }
        }

        // Check if activity is consent-based to flag for re-consent on vendor addition
        const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, input.processingActivityId));
        if (activity && activity.lawfulBasis === 'consent') {
          await ctx.db.insert(reconsentFlags).values({
            organizationId: ctx.user!.orgId,
            processingActivityId: input.processingActivityId,
            reason: `Vendor '${input.name}' was added to this consent-based processing activity.`,
            confidence: 'high',
            status: 'flagged'
          });
        }

        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: recipientUpdateSchema
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingRecipients,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Recipient',
          via: [{ table: processingActivities, on: eq(processingRecipients.processingActivityId, processingActivities.id) }],
        });

        const [updated] = await ctx.db.update(processingRecipients)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingRecipients.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingRecipients,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Recipient',
          via: [{ table: processingActivities, on: eq(processingRecipients.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingRecipients)
          .where(eq(processingRecipients.id, input.id))
          .returning();

        if (deleted) {
          const [activity] = await ctx.db.select().from(processingActivities).where(eq(processingActivities.id, deleted.processingActivityId));
          if (activity && activity.lawfulBasis === 'consent') {
            await ctx.db.insert(reconsentFlags).values({
              organizationId: ctx.user!.orgId,
              processingActivityId: deleted.processingActivityId,
              reason: `A vendor was removed from this consent-based processing activity.`,
              confidence: 'high',
              status: 'flagged'
            });
          }
        }

        return deleted;
      })
  }),

  transfers: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        return ctx.db.select().from(processingTransfers)
          .where(eq(processingTransfers.processingActivityId, input.processingActivityId));
      }),
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        // char(2). Unbounded, this surfaced as a Postgres 22001 from deep inside the
        // insert rather than as a validation error naming the field.
        destinationCountry: z.string().length(2),
        // Bounded string rather than the enum for the same reason the update schema
        // is — see the note there. The tab writes enum keys.
        transferMechanism: z.string().max(100),
        mechanismDetail: z.string().optional(),
        destinationEntity: z.string().max(255).optional(),
        vendorId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        const [inserted] = await ctx.db.insert(processingTransfers).values({
          ...input,
        }).returning();
        return inserted;
      }),
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: transferUpdateSchema
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingTransfers,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Transfer',
          via: [{ table: processingActivities, on: eq(processingTransfers.processingActivityId, processingActivities.id) }],
        });

        const [updated] = await ctx.db.update(processingTransfers)
          .set({ ...input.data, updatedAt: new Date() })
          .where(eq(processingTransfers.id, input.id))
          .returning();
        return updated;
      }),
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: processingTransfers,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Transfer',
          via: [{ table: processingActivities, on: eq(processingTransfers.processingActivityId, processingActivities.id) }],
        });

        const [deleted] = await ctx.db.delete(processingTransfers)
          .where(eq(processingTransfers.id, input.id))
          .returning();
        return deleted;
      })
  }),
});
