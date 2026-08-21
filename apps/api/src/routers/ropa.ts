import { paginatedQuery } from '../utils/pagination.js';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { processingActivities, legitimateInterestAssessments, processingDataCategories, processingDataSubjects, processingRecipients, processingTransfers, dataElementCatalogue, dataSubjectCategoryCatalogue, auditLogs, vendors, organizationVendors, clientProcessingActivities, reconsentFlags, dpias, dpiaScreenings, users, organizations, transferImpactAssessments, processingActivityAttestations, processingActivityApprovals, processingActivityVersions, processingActivityTasks, processingActivityComments, ropaSavedViews, complianceGaps } from 'db';
import { eq, and, or, desc, inArray, not, count, isNull, isNotNull, asc, sql, lt, gte, lte, ne, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
import {
  REVIEW_CADENCES,
  DEFAULT_REVIEW_CADENCE_MONTHS,
  effectiveCadenceMonths,
  nextReviewFrom,
  APPROVAL_STATES,
  canTransition,
  editInvalidatesApproval,
  buildSnapshot,
  diffSnapshots,
  COMPLETENESS_BANDS,
  escapeLikePattern,
  normaliseTags,
  extractMentions,
  restorableActivityFields,
  reconcileChildren,
  reviveSnapshotDates,
  type VersionSnapshot,
} from '../lib/ropaLifecycle.js';
import {
  ARTICLE_35_3_CRITERIA,
  WP248_CRITERIA,
  SCREENING_CRITERIA,
  NATIONAL_BLACKLISTS,
  LIA_OUTCOMES,
  LIA_BENEFICIARIES,
  LIA_IMPORTANCE,
  TIA_STATUSES,
  TIA_CONCLUSIONS,
  TIA_LEGAL_CONCLUSIONS,
  TIA_TRANSFER_FREQUENCIES,
  TIA_TECHNICAL_MEASURES,
  TIA_ORGANISATIONAL_MEASURES,
  TIA_CONTRACTUAL_MEASURES,
  TIA_EFFECTIVE_ALONE_MEASURES,
} from '../constants/assessmentVocabularies.js';
import { evaluateLia, evaluateTia, screenForDpia, prefillScreening, contentHash } from '../lib/assessments.js';
import {
  describeChanges,
  changeTypeOf,
  flattenAuditRow,
  AUDIT_CHANGE_TYPES,
  CHANGE_TYPE_SUFFIXES,
} from '../lib/auditTrail.js';
import { buildArticle30Record } from '../lib/ropaArticle30.js';
import {
  article30Xlsx,
  article30Csv,
  article30Json,
  regulatorXlsx,
  REGULATOR_TEMPLATES,
} from '../lib/ropaExportFormats.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { renderPdf } from '../lib/pdfClient.js';

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

/**
 * L107/L108. The most rows one bulk operation may touch.
 *
 * A ceiling rather than a page size: "select all matching" has to mean the filter,
 * not the loaded page, and it also has to stop somewhere. Five hundred is roughly a
 * mid-sized register in full, so the cap is reached by an unfiltered select-all —
 * which is the case that should be refused with "narrow the filter" rather than
 * quietly rewriting every record an organisation has.
 */
const BULK_SELECTION_CAP = 500;

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

  // B19. Null means "inherit the organisation default"; a number is this activity
  // deciding for itself, including 0 for a record deliberately exempt from review.
  reviewCadenceMonths: z.number().int().min(0).max(120).nullable(),

  // K103/L108. Normalised on write — the filter is only useful if "Payroll" and
  // "payroll" are the same tag, and the place to settle that is the write, once,
  // rather than every read.
  tags: z.array(z.string().min(1).max(60)).max(25),
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
  const [dataSubjects, dataCategories, recipients, transfers, lias] = await Promise.all([
    dbc.select().from(processingDataSubjects).where(eq(processingDataSubjects.processingActivityId, activity.id)),
    dbc.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, activity.id)),
    dbc.select().from(processingRecipients).where(eq(processingRecipients.processingActivityId, activity.id)),
    dbc.select().from(processingTransfers).where(eq(processingTransfers.processingActivityId, activity.id)),
    // F55. A fifth query on every score, and it earns it: the LIA is the one
    // requirement whose answer lives outside the four child tables, and without
    // it the scorer cannot tell an activity claiming legitimate interests with an
    // assessment behind it from one claiming it with nothing.
    dbc.select().from(legitimateInterestAssessments)
      .where(and(
        eq(legitimateInterestAssessments.processingActivityId, activity.id),
        ne(legitimateInterestAssessments.status, 'superseded'),
      ))
      .orderBy(desc(legitimateInterestAssessments.createdAt))
      .limit(1),
  ]);
  const lia = (lias as any[])[0];
  return {
    activity,
    dataSubjects,
    dataCategories,
    recipients,
    transfers,
    lia: lia ? { status: lia.status, outcome: lia.outcome } : null,
  };
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

/**
 * K103. Recomputes and stores `completeness_score` for one activity.
 *
 * The score is a pure function of the activity and its four child tables, so it
 * could be computed on read — and is, for the editor's ring. The stored copy exists
 * only so the register can *filter and sort* on it: answering "show me everything
 * under 50%" without it means loading every activity's children on every list
 * request, which on a 512MB box that also runs Chromium is not a filter, it is an
 * outage.
 *
 * Returns the old and new score so callers can notice a drop (M112). Deliberately
 * does not touch `updated_at`, for the same two reasons syncDataSubjectMirror does
 * not: the register sorts on it and the editor's optimistic lock compares against
 * it, so a background recompute would re-order the list and CONFLICT the next
 * autosave of a record nobody else had touched.
 */
async function refreshCompleteness(dbc: any, activityId: string): Promise<{ before: number; after: number } | null> {
  const [activity] = await dbc.select().from(processingActivities)
    .where(eq(processingActivities.id, activityId));
  if (!activity) return null;

  const { score } = scoreActivity(await loadBundle(dbc, activity));
  const before = activity.completenessScore ?? 0;

  if (score !== before) {
    await dbc.update(processingActivities)
      .set({ completenessScore: score })
      .where(eq(processingActivities.id, activityId));
  }
  return { before, after: score };
}

/**
 * M112. Everyone who should hear that something happened to an activity, minus
 * whoever did it.
 *
 * Both owners plus the assigned reviewer. Excluding the actor is not politeness —
 * an editor that emails you about your own save is an editor whose notifications
 * get filtered to a folder within the week, and every later alert goes with them.
 */
function stakeholderIds(activity: any, exclude?: string | null): string[] {
  const ids = [activity.businessOwnerId, activity.privacyOwnerId, activity.currentReviewerId]
    .filter((id): id is string => !!id && id !== exclude);
  return [...new Set(ids)];
}

/**
 * B21. Freezes the activity and its four child tables as one document.
 *
 * The version number is allocated from what is already stored rather than from
 * `processing_activities.version`, which predates this table and is unreliable on
 * older rows. The unique constraint on (activity, version) is the backstop: two
 * concurrent snapshots produce a conflict rather than two different documents both
 * calling themselves v4.
 */
async function snapshotActivity(
  dbc: any,
  activity: any,
  opts: { reason: string; userId: string; note?: string | null },
): Promise<any> {
  const bundle = await loadBundle(dbc, activity);
  const [{ value: highest } = { value: 0 }] = await dbc
    .select({ value: sql<number>`coalesce(max(${processingActivityVersions.version}), 0)` })
    .from(processingActivityVersions)
    .where(eq(processingActivityVersions.processingActivityId, activity.id));

  const version = Number(highest ?? 0) + 1;
  const [row] = await dbc.insert(processingActivityVersions).values({
    organizationId: activity.organizationId,
    processingActivityId: activity.id,
    version,
    reason: opts.reason,
    note: opts.note ?? null,
    snapshot: buildSnapshot(bundle, new Date()) as any,
    score: scoreActivity(bundle).score,
    status: activity.status,
    createdBy: opts.userId,
  }).returning();

  // Keeps the counter on the activity in step with the table, so the column the
  // schema has carried since the beginning finally means something.
  await dbc.update(processingActivities)
    .set({ version, previousVersionId: row?.id ?? null })
    .where(eq(processingActivities.id, activity.id));

  return row;
}

/**
 * A client-supplied user id, proved to be a member of the caller's organisation.
 *
 * Same class as `assertOwnersInOrg` above and the same reason: `users` is not
 * org-scoped by the table, so assigning a reviewer, an assignee or a mention by
 * raw uuid would let one tenant address another's staff — and, through the
 * notification queue, tell them about it.
 */
async function assertMembersInOrg(dbc: any, orgId: string, ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  const found = await dbc.select({ id: users.id }).from(users)
    .where(and(inArray(users.id, unique), eq(users.organizationId, orgId)));
  if (found.length !== unique.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }
}

/** The organisation's default review cadence, from `organizations.settings`. */
async function orgReviewCadence(dbc: any, orgId: string): Promise<number> {
  const [org] = await dbc.select({ settings: organizations.settings }).from(organizations)
    .where(eq(organizations.id, orgId));
  const configured = (org?.settings as Record<string, any> | null)?.ropaReviewCadenceMonths;
  return typeof configured === 'number' && configured > 0 ? configured : DEFAULT_REVIEW_CADENCE_MONTHS;
}

/**
 * B20, org-level. Whether an activity must be approved before it may be published.
 *
 * **Off unless explicitly turned on**, and that default is the whole reason this is a
 * setting rather than a rule. Making approval mandatory changes what `ropa.update`
 * does for every existing customer on the day it ships: a register that published
 * fine yesterday starts refusing, and the refusal names a workflow nobody has been
 * trained on. Opting in is a decision an organisation makes with a release note in
 * front of them.
 */
async function orgApprovalRequired(dbc: any, orgId: string): Promise<boolean> {
  const [org] = await dbc.select({ settings: organizations.settings }).from(organizations)
    .where(eq(organizations.id, orgId));
  return (org?.settings as Record<string, any> | null)?.ropaApprovalRequired === true;
}

/**
 * K102/K103. Everything the register can be narrowed by, in one schema.
 *
 * Kept out of `list` itself because three things validate against it: the list, the
 * "select everything matching" endpoint behind bulk operations (L107), and a saved
 * view's stored `filters` blob (K104). A view saved through one and replayed
 * through another is the whole point of saved views, and a second copy of this
 * shape is how the two would drift.
 */
const registerFilterSchema = z.object({
  /** K102. Matched against name, purpose, description, and the activity's data
   *  categories, recipients and transfer destinations. */
  q: z.string().trim().max(200).optional(),

  ownership: z.enum(['all', 'mine', 'unowned']).default('all'),
  ownerId: z.string().uuid().optional(),
  status: z.array(z.enum(['draft', 'active', 'under_review', 'archived'])).optional(),
  approvalState: z.array(z.enum(APPROVAL_STATES)).optional(),
  role: z.array(z.enum(['controller', 'processor', 'joint_controller'])).optional(),
  lawfulBasis: z.array(z.string().max(50)).optional(),
  riskLevel: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
  clientId: z.string().uuid().optional(),
  tags: z.array(z.string().max(60)).optional(),

  hasSpecialCategory: z.boolean().optional(),
  hasTransfer: z.boolean().optional(),
  transferCountry: z.string().length(2).optional(),
  /** Art. 30(1)(f). `false` is the single most common register finding. */
  retentionSet: z.boolean().optional(),
  requiresDpia: z.boolean().optional(),
  dpiaLinked: z.boolean().optional(),
  reviewOverdue: z.boolean().optional(),
  completenessBand: z.enum(['low', 'medium', 'high']).optional(),

  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  updatedFrom: z.coerce.date().optional(),
  updatedTo: z.coerce.date().optional(),

  /** Archived activities are hidden by default — B22's archive view flips this. */
  includeArchived: z.boolean().default(false),
  sort: z.enum(['updatedAt', 'createdAt', 'name', 'completenessScore', 'nextReviewAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type RegisterFilters = z.infer<typeof registerFilterSchema>;

/**
 * Turns the filter schema into drizzle predicates.
 *
 * Everything that reaches beyond `processing_activities` is an EXISTS subquery
 * rather than a join. A join against the four child tables multiplies rows — an
 * activity with six data categories would appear six times in a cursor-paginated
 * list, and the page size would silently stop meaning twenty-five activities.
 *
 * The organisation predicate is *not* added here: it belongs to the caller, comes
 * from the session, and burying it in a filter helper is how it comes to be
 * forgotten by whoever writes the next endpoint. Both callers pass it themselves.
 */
function buildRegisterFilters(input: RegisterFilters, userId: string): any[] {
  const filters: any[] = [
    // auditExport and scoring already filter on this. The register did not, so a
    // deleted activity stayed on screen, in the CSV and in the PDF while the audit
    // pack and the compliance score behaved as though it were gone.
    isNull(processingActivities.deletedAt),
  ];

  if (!input.includeArchived && !input.status?.includes('archived')) {
    // `status` is nullable, and `<> 'archived'` is false against NULL — so a bare
    // `ne` would drop a row with no status out of the register entirely, which is
    // worse than the problem it solves. Before this filter existed there was no
    // status predicate at all, and no row could disappear this way.
    filters.push(or(
      isNull(processingActivities.status),
      ne(processingActivities.status, 'archived'),
    ));
  }

  if (input.ownership === 'mine') {
    // Either hat. Someone who holds one of the two roles on a record has work to
    // do on it, and splitting the view in two would just mean checking both.
    filters.push(or(
      eq(processingActivities.businessOwnerId, userId),
      eq(processingActivities.privacyOwnerId, userId),
    ));
  } else if (input.ownership === 'unowned') {
    filters.push(and(
      isNull(processingActivities.businessOwnerId),
      isNull(processingActivities.privacyOwnerId),
    ));
  }

  if (input.ownerId) {
    filters.push(or(
      eq(processingActivities.businessOwnerId, input.ownerId),
      eq(processingActivities.privacyOwnerId, input.ownerId),
    ));
  }

  if (input.status?.length) filters.push(inArray(processingActivities.status, input.status));
  if (input.approvalState?.length) filters.push(inArray(processingActivities.approvalState, input.approvalState));
  if (input.role?.length) filters.push(inArray(processingActivities.role, input.role));
  if (input.lawfulBasis?.length) filters.push(inArray(processingActivities.lawfulBasis, input.lawfulBasis));
  if (input.riskLevel?.length) filters.push(inArray(processingActivities.riskLevel, input.riskLevel));

  if (input.tags?.length) {
    // "Carries any of these tags", as an OR of jsonb containment tests.
    //
    // The tempting form is `tags ?| ARRAY[...]::text[]`, and it is the one to avoid:
    // `?|` takes a Postgres array, drizzle has no binding for one here, and building
    // it with sql.raw means hand-quoting user input into a query — which is a
    // SQL-injection hole wearing a performance argument as a hat. Containment binds
    // as a parameter and uses the same GIN index `?|` would.
    const tags = normaliseTags(input.tags);
    if (tags.length > 0) {
      filters.push(or(
        ...tags.map((tag) => sql`${processingActivities.tags} @> ${JSON.stringify([tag])}::jsonb`),
      ));
    }
  }

  if (input.hasSpecialCategory !== undefined) {
    const exists = sql`EXISTS (SELECT 1 FROM processing_data_categories pdc
      WHERE pdc.processing_activity_id = ${processingActivities.id}
        AND (pdc.is_special_category = true OR pdc.is_criminal_data = true))`;
    filters.push(input.hasSpecialCategory ? exists : sql`NOT ${exists}`);
  }

  if (input.hasTransfer !== undefined) {
    const exists = sql`EXISTS (SELECT 1 FROM processing_transfers pt
      WHERE pt.processing_activity_id = ${processingActivities.id})`;
    filters.push(input.hasTransfer ? exists : sql`NOT ${exists}`);
  }

  if (input.transferCountry) {
    filters.push(sql`EXISTS (SELECT 1 FROM processing_transfers pt
      WHERE pt.processing_activity_id = ${processingActivities.id}
        AND pt.destination_country = ${input.transferCountry})`);
  }

  if (input.retentionSet !== undefined) {
    // The literal 'custom' counts as unset. The old Custom option wrote it and gave
    // nowhere to type a period, so a register full of it answers Art. 30(1)(f) with
    // the word "custom" — which is exactly the finding this filter is meant to find.
    const set = sql`(${processingActivities.retentionPeriod} IS NOT NULL
      AND ${processingActivities.retentionPeriod} <> ''
      AND ${processingActivities.retentionPeriod} <> 'custom')`;
    filters.push(input.retentionSet ? set : sql`NOT ${set}`);
  }

  if (input.requiresDpia !== undefined) filters.push(eq(processingActivities.requiresDpia, input.requiresDpia));
  if (input.dpiaLinked !== undefined) {
    filters.push(input.dpiaLinked ? isNotNull(processingActivities.dpiaId) : isNull(processingActivities.dpiaId));
  }

  if (input.reviewOverdue) {
    filters.push(and(
      isNotNull(processingActivities.nextReviewAt),
      lt(processingActivities.nextReviewAt, new Date()),
    ));
  }

  if (input.completenessBand) {
    const band = COMPLETENESS_BANDS[input.completenessBand];
    filters.push(and(
      gte(processingActivities.completenessScore, band.min),
      lt(processingActivities.completenessScore, band.max),
    ));
  }

  if (input.clientId) {
    filters.push(sql`EXISTS (SELECT 1 FROM client_processing_activities cpa
      WHERE cpa.processing_activity_id = ${processingActivities.id}
        AND cpa.client_id = ${input.clientId})`);
  }

  if (input.createdFrom) filters.push(gte(processingActivities.createdAt, input.createdFrom));
  if (input.createdTo) filters.push(lte(processingActivities.createdAt, input.createdTo));
  if (input.updatedFrom) filters.push(gte(processingActivities.updatedAt, input.updatedFrom));
  if (input.updatedTo) filters.push(lte(processingActivities.updatedAt, input.updatedTo));

  if (input.sort === 'nextReviewAt') {
    // Cursor pagination compares the sort column against the cursor's value, and a
    // NULL compares false against everything — so a page of never-scheduled
    // activities produces a cursor that matches no further rows and the list stops
    // early, looking like the register ends there. Sorting by review date means the
    // review queue, and the review queue is the rows that have one.
    filters.push(isNotNull(processingActivities.nextReviewAt));
  }

  if (input.q) {
    // Escaped, because a purpose containing "100%" typed into the search box
    // otherwise matches every row in the register and reads as "search is broken".
    const pattern = `%${escapeLikePattern(input.q)}%`;
    filters.push(or(
      ilike(processingActivities.name, pattern),
      ilike(processingActivities.purpose, pattern),
      ilike(processingActivities.description, pattern),
      ilike(processingActivities.controllerName, pattern),
      sql`EXISTS (SELECT 1 FROM processing_data_categories pdc
        WHERE pdc.processing_activity_id = ${processingActivities.id}
          AND pdc.category ILIKE ${pattern} ESCAPE '\\')`,
      sql`EXISTS (SELECT 1 FROM processing_recipients pr
        WHERE pr.processing_activity_id = ${processingActivities.id}
          AND pr.name ILIKE ${pattern} ESCAPE '\\')`,
      sql`EXISTS (SELECT 1 FROM processing_transfers pt
        WHERE pt.processing_activity_id = ${processingActivities.id}
          AND (pt.destination_country ILIKE ${pattern} ESCAPE '\\'
            OR pt.destination_entity ILIKE ${pattern} ESCAPE '\\'))`,
    ));
  }

  return filters;
}

// ---------------------------------------------------------------------------
// Sprint 3 payloads.
//
// Same bargain as the four update schemas above: ownership of the row is checked
// separately, and these bound what may be written into it. Unknown keys are
// stripped rather than rejected, because both forms autosave `watch()` wholesale.
// ---------------------------------------------------------------------------

/** F55. Everything an LIA form may write. `status` is not here on purpose — it moves through `complete` and `supersede`, which check something first. */
const liaUpdateSchema = z.object({
  title: z.string().max(255).nullish(),

  purposeTestLegitimateInterest: z.string().max(8000).nullish(),
  purposeTestIsLawful: z.boolean().nullish(),
  purposeTestEvidence: z.string().max(4000).nullish(),
  purposeTestBeneficiary: z.enum(LIA_BENEFICIARIES).nullish(),
  purposeTestImportance: z.enum(LIA_IMPORTANCE).nullish(),

  necessityTestIsNecessary: z.string().max(8000).nullish(),
  necessityTestAlternatives: z.string().max(8000).nullish(),
  necessityTestConclusion: z.string().max(8000).nullish(),
  necessityTestProportionate: z.boolean().nullish(),

  balancingTestImpact: z.string().max(8000).nullish(),
  balancingTestExpectation: z.string().max(8000).nullish(),
  balancingTestSafeguards: z.string().max(8000).nullish(),
  balancingTestOverrides: z.string().max(8000).nullish(),
  balancingTestInvolvesChildren: z.boolean().nullish(),
  balancingTestInvolvesSpecialCategory: z.boolean().nullish(),
  balancingTestRelationship: z.string().max(4000).nullish(),

  objectionMechanism: z.string().max(4000).nullish(),
  optOutOffered: z.boolean().nullish(),

  outcome: z.enum(LIA_OUTCOMES).nullish(),
  outcomeRationale: z.string().max(4000).nullish(),

  evidence: z.array(z.object({
    id: z.string().max(60),
    name: z.string().max(255),
    url: z.string().max(1000).nullish(),
    note: z.string().max(1000).nullish(),
  })).max(30).optional(),

  nextReviewAt: z.coerce.date().nullish(),
});

/** F58. The six EDPB steps as one payload. */
const tiaUpdateSchema = z.object({
  title: z.string().max(255).nullish(),

  // Step 1 — know your transfer.
  dataExporter: z.string().max(255).nullish(),
  dataImporter: z.string().max(255).nullish(),
  transferPurpose: z.string().max(4000).nullish(),
  dataCategories: z.array(z.string().max(120)).max(60).optional(),
  dataSubjectCategories: z.array(z.string().max(120)).max(60).optional(),
  transferFrequency: z.enum(TIA_TRANSFER_FREQUENCIES).nullish(),
  onwardTransfers: z.string().max(4000).nullish(),

  // Step 2 is the mechanism, which is the transfer's own and is not writable here:
  // a TIA that disagrees with the transfer it assesses is not a state the register
  // should be able to reach. `mechanismDetail` is the assessor's own note about it.
  mechanismDetail: z.string().max(4000).nullish(),

  // Step 3 — the destination's law.
  surveillanceLawsExist: z.boolean().nullish(),
  surveillanceLawsDetail: z.string().max(8000).nullish(),
  independentDpaExists: z.boolean().nullish(),
  effectiveRemediesExist: z.boolean().nullish(),
  relevantCaseLaw: z.string().max(4000).nullish(),
  legalAssessmentConclusion: z.enum(TIA_LEGAL_CONCLUSIONS).nullish(),
  legalAssessmentDetail: z.string().max(8000).nullish(),

  // Step 4 — supplementary measures, from the catalogue rather than free text, so
  // that "is this measure one that can work alone?" has an answer.
  technicalMeasures: z.array(z.enum(TIA_TECHNICAL_MEASURES)).max(20).optional(),
  organizationalMeasures: z.array(z.enum(TIA_ORGANISATIONAL_MEASURES)).max(20).optional(),
  contractualMeasures: z.array(z.enum(TIA_CONTRACTUAL_MEASURES)).max(20).optional(),
  measuresDetail: z.string().max(8000).nullish(),

  // Step 5 — residual risk and the conclusion.
  residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).nullish(),
  residualRiskJustification: z.string().max(8000).nullish(),
  conclusion: z.enum(TIA_CONCLUSIONS).nullish(),
  conditions: z.string().max(4000).nullish(),

  // Step 6 — re-evaluation.
  reevaluationIntervalMonths: z.number().int().min(1).max(60).nullish(),
  reevaluationTriggers: z.string().max(4000).nullish(),
});

/**
 * J96. What an export was narrowed by, in a sentence the document can print.
 *
 * An Article 30 record covering half the register and not saying so is worse than
 * one covering all of it: a supervisory authority reading it has no way to know
 * the omissions are deliberate, and the controller has no way to prove later that
 * they were. Every filtered export carries this line on its face.
 */
function summariseFilters(input: RegisterFilters): string | null {
  const parts: string[] = [];
  if (input.q) parts.push(`matching "${input.q}"`);
  if (input.status?.length) parts.push(`status: ${input.status.join(', ')}`);
  if (input.approvalState?.length) parts.push(`approval: ${input.approvalState.join(', ')}`);
  if (input.role?.length) parts.push(`role: ${input.role.join(', ')}`);
  if (input.lawfulBasis?.length) parts.push(`lawful basis: ${input.lawfulBasis.join(', ')}`);
  if (input.riskLevel?.length) parts.push(`risk: ${input.riskLevel.join(', ')}`);
  if (input.tags?.length) parts.push(`tags: ${input.tags.join(', ')}`);
  if (input.ownership === 'mine') parts.push('owned by the exporter');
  if (input.ownership === 'unowned') parts.push('with no owner');
  if (input.ownerId) parts.push('for one owner');
  if (input.clientId) parts.push('for one client');
  if (input.hasSpecialCategory !== undefined) parts.push(input.hasSpecialCategory ? 'with special category data' : 'without special category data');
  if (input.hasTransfer !== undefined) parts.push(input.hasTransfer ? 'with third-country transfers' : 'without third-country transfers');
  if (input.transferCountry) parts.push(`transferring to ${input.transferCountry}`);
  if (input.retentionSet !== undefined) parts.push(input.retentionSet ? 'with a retention period' : 'with no retention period');
  if (input.requiresDpia !== undefined) parts.push(input.requiresDpia ? 'requiring a DPIA' : 'not requiring a DPIA');
  if (input.dpiaLinked !== undefined) parts.push(input.dpiaLinked ? 'with a DPIA linked' : 'with no DPIA linked');
  if (input.reviewOverdue) parts.push('overdue for review');
  if (input.completenessBand) parts.push(`completeness: ${input.completenessBand}`);
  if (input.createdFrom || input.createdTo) parts.push('created within a date range');
  if (input.updatedFrom || input.updatedTo) parts.push('updated within a date range');
  if (input.includeArchived) parts.push('including archived records');

  if (parts.length === 0) return null;
  return `Activities ${parts.join('; ')}.`;
}

/**
 * The Article 30 record as the PDF template consumes it.
 *
 * A JSON round trip, and that is the point rather than laziness: `renderPdf` POSTs
 * the payload to the Next.js app, so every Date on the wire arrives as a string
 * anyway. Doing the conversion here means the template's props say what actually
 * reaches it, instead of declaring `Date` and receiving `string` — which is how a
 * template ends up calling `.toISOString()` on a string in production and nowhere
 * else.
 */
function serialiseArticle30(record: Awaited<ReturnType<typeof buildArticle30Record>>): unknown {
  return JSON.parse(JSON.stringify(record));
}


export const ropaRouter = router({
  /**
   * K102–K104. The register, filtered on the server.
   *
   * B18's three ownership options were the only server-side filter that existed;
   * everything else was a client-side search over whichever twenty-five rows
   * happened to be loaded, which meant "show me every unowned high-risk activity
   * with a transfer to the US" was a question the product could not answer about
   * itself.
   */
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(paginationInput.merge(registerFilterSchema))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      return paginatedQuery(
        processingActivities,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        input.sort,
        input.order,
        buildRegisterFilters(input, ctx.user!.id),
      );
    }),

  /**
   * L107. Every id matching the current filters, not the loaded page.
   *
   * This is the whole of "select all matching filter". Bulk operations that act on
   * what is on screen are the reason the old select-all checkbox was removed rather
   * than wired: a user who filters to 340 overdue activities, ticks the header box
   * and presses "assign owner" means all 340, and a control that quietly meant 25
   * is worse than no control.
   *
   * Capped, because the cap is the honest part: past it the answer is "narrow the
   * filter", not a bulk write of unknown size against a 512MB box.
   */
  listIds: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(registerFilterSchema)
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const rows = await ctx.db.select({ id: processingActivities.id })
        .from(processingActivities)
        .where(and(
          eq(processingActivities.organizationId, ctx.user!.orgId),
          ...buildRegisterFilters(input, ctx.user!.id),
        ))
        .limit(BULK_SELECTION_CAP + 1);

      return {
        ids: rows.slice(0, BULK_SELECTION_CAP).map((r: any) => r.id),
        truncated: rows.length > BULK_SELECTION_CAP,
        cap: BULK_SELECTION_CAP,
      };
    }),

  /**
   * K103. The tag vocabulary actually in use, for the filter bar's picker.
   *
   * Derived rather than stored: a tag exists because an activity carries it, and a
   * separate tag table would need garbage collection nobody would write.
   */
  tags: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      const rows = await ctx.db.execute(sql`
        SELECT tag, COUNT(*)::int AS count
        FROM processing_activities pa, jsonb_array_elements_text(pa.tags) AS tag
        WHERE pa.organization_id = ${ctx.user!.orgId} AND pa.deleted_at IS NULL
        GROUP BY tag ORDER BY count DESC, tag ASC LIMIT 200`);
      return (rows as any).rows ?? rows;
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
      if (sanitizedData.tags) sanitizedData.tags = normaliseTags(sanitizedData.tags);

      // ---- B19, the review cycle -----------------------------------------
      // Changing the cadence has to move the date it implies, or the setting is a
      // number in a box: a record switched from annual to quarterly review keeps a
      // review date eleven months out and nothing ever says so.
      if (sanitizedData.reviewCadenceMonths !== undefined) {
        const cadence = effectiveCadenceMonths(sanitizedData.reviewCadenceMonths, await orgReviewCadence(ctx.db, ctx.user!.orgId));
        const from = activity.lastReviewedAt ?? activity.createdAt ?? new Date();
        sanitizedData.nextReviewAt = sanitizedData.reviewCadenceMonths === 0 ? null : nextReviewFrom(from, cadence);
      }

      // ---- B20, approval ---------------------------------------------------
      // An approved record that has its purpose rewritten is no longer the record
      // anybody approved. Only substantive fields count: re-opening approval on an
      // owner change would mean nothing ever stays approved, which is how approval
      // workflows come to be switched off. See APPROVAL_INVALIDATING_FIELDS.
      const changedKeys = Object.keys(input.data).filter((key) => {
        const next = (input.data as Record<string, any>)[key];
        return JSON.stringify(next ?? null) !== JSON.stringify((activity as Record<string, any>)[key] ?? null);
      });
      if (activity.approvalState === 'approved' && editInvalidatesApproval(changedKeys)) {
        sanitizedData.approvalState = 'draft';
        sanitizedData.approvedAt = null;
        sanitizedData.approvedBy = null;
      }

      // ---- B23, the publication gate -------------------------------------
      // Only on the transition *into* 'active'. Re-saving a record that is already
      // active does not re-run the gate: an activity published before the gate
      // existed, or under a recorded exception, must stay editable — otherwise the
      // gate locks people out of fixing the very fields it is complaining about.
      const becomingActive = sanitizedData.status === 'active' && activity.status !== 'active';
      if (becomingActive) {
        const bundle = await loadBundle(ctx.db, { ...activity, ...sanitizedData });
        const verdict = evaluatePublication(bundle, {
          exceptionReason: input.publicationExceptionReason,
          // B20. Read from the row rather than from `sanitizedData`: approval is not
          // a field a caller may set on the way past, and the same save that asks to
          // publish must not also be able to claim the approval that permits it.
          approvalRequired: await orgApprovalRequired(ctx.db, ctx.user!.orgId),
          approvalState: activity.approvalState,
        });

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

        // B21. Publication is the moment the record starts asserting something to a
        // regulator, so it is the moment worth being able to return to. Taken before
        // the write, because what is being preserved is the state that met the gate.
        await snapshotActivity(ctx.db, { ...activity, ...sanitizedData }, {
          reason: 'published',
          userId: ctx.user!.id,
          note: verdict.viaException ? 'Published under a recorded exception' : null,
        });
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

      // K103. The stored score has to move with the record, or the register's
      // completeness filter reports yesterday's state.
      //
      // Skipped when nothing changed, because rescoring is five child queries and
      // this procedure is what the editor's debounced autosave calls: a save that
      // wrote nothing should not cost the same as one that rewrote the record.
      const scoreMove = changedKeys.length > 0 ? await refreshCompleteness(ctx.db, updated.id) : null;

      // M112. Two events, both scoped to people who actually hold the record:
      // "someone else changed this" and "this got less complete". A drop is the one
      // worth an email — it is usually a field being cleared by accident, and it is
      // invisible until somebody exports the register for a regulator.
      if (changedKeys.length > 0) {
        for (const userId of stakeholderIds(updated, ctx.user!.id)) {
          await queueNotification({
            organizationId: ctx.user!.orgId,
            userId,
            type: 'ropa.activity_changed',
            title: `"${updated.name}" was updated`,
            body: `${changedKeys.length} field${changedKeys.length === 1 ? '' : 's'} changed on a processing activity you are responsible for.`,
            actionUrl: `/ropa/${updated.id}`,
            metadata: { activityId: updated.id, fields: changedKeys },
          });
        }
        if (scoreMove && scoreMove.after < scoreMove.before) {
          for (const userId of stakeholderIds(updated, ctx.user!.id)) {
            await queueNotification({
              organizationId: ctx.user!.orgId,
              userId,
              type: 'ropa.completeness_dropped',
              title: `"${updated.name}" is less complete than it was`,
              body: `Completeness fell from ${scoreMove.before}% to ${scoreMove.after}%.`,
              actionUrl: `/ropa/${updated.id}`,
              metadata: { activityId: updated.id, before: scoreMove.before, after: scoreMove.after },
            });
          }
        }
      }

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

  // -------------------------------------------------------------------------
  // B22 — archive, restore, delete with its dependencies named, and duplicate.
  // -------------------------------------------------------------------------

  /**
   * B22. What else points at this activity, counted, before anything is destroyed.
   *
   * "Are you sure?" is not a confirmation, it is a speed bump. A confirmation names
   * what goes with the record — the DPIA it evidences, the client assignments that
   * make it an Art. 30(2) record for somebody, the gaps that cite it — because in a
   * compliance tool the thing being deleted is usually load-bearing for something
   * the person deleting it has not thought about.
   */
  dependencies: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await assertParentOwned(ctx.db, processingActivities, input.id, ctx.user!.orgId, 'Activity');

      const countOf = async (table: any, column: any) => {
        const [row] = await ctx.db.select({ value: count() }).from(table).where(eq(column, input.id));
        return Number(row?.value ?? 0);
      };

      const [dataSubjects, dataCategories, recipients, transfers, clients, flags, tasks, comments, versions] = await Promise.all([
        countOf(processingDataSubjects, processingDataSubjects.processingActivityId),
        countOf(processingDataCategories, processingDataCategories.processingActivityId),
        countOf(processingRecipients, processingRecipients.processingActivityId),
        countOf(processingTransfers, processingTransfers.processingActivityId),
        countOf(clientProcessingActivities, clientProcessingActivities.processingActivityId),
        countOf(reconsentFlags, reconsentFlags.processingActivityId),
        countOf(processingActivityTasks, processingActivityTasks.processingActivityId),
        countOf(processingActivityComments, processingActivityComments.processingActivityId),
        countOf(processingActivityVersions, processingActivityVersions.processingActivityId),
      ]);

      // Gaps are keyed by (entityType, entityId) rather than a foreign key, so they
      // need the org predicate of their own that the others get through the parent.
      const [gapRow] = await ctx.db.select({ value: count() }).from(complianceGaps)
        .where(and(
          eq(complianceGaps.organizationId, ctx.user!.orgId),
          eq(complianceGaps.entityType, 'processing_activity'),
          eq(complianceGaps.entityId, input.id),
        ));

      const [liaRow] = await ctx.db.select({ value: count() }).from(legitimateInterestAssessments)
        .where(eq(legitimateInterestAssessments.processingActivityId, input.id));

      return {
        status: activity.status,
        dataSubjects, dataCategories, recipients, transfers,
        clients, reconsentFlags: flags, tasks, comments, versions,
        gaps: Number(gapRow?.value ?? 0),
        assessments: Number(liaRow?.value ?? 0),
        // The one dependency that is not a child row: deleting an activity that
        // evidences a DPIA leaves the DPIA asserting processing nothing describes.
        dpiaLinked: !!activity.dpiaId,
      };
    }),

  /**
   * B22. Archive — reversible, dated, attributed.
   *
   * Not `update({ status: 'archived' })`, which is what the Status dropdown does and
   * which loses the only two facts that make an archive an archive: when, and by
   * whom. `statusBeforeArchive` is what lets restore put a published record back as
   * published rather than silently unpublishing it.
   */
  archive: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid(), reason: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await assertParentOwned(ctx.db, processingActivities, input.id, ctx.user!.orgId, 'Activity');
      if (activity.status === 'archived') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This activity is already archived.' });
      }

      // Taken before the state changes: an archived record is one somebody may need
      // to produce years later, and "what did it say when we retired it" is the
      // question that gets asked.
      await snapshotActivity(ctx.db, activity, {
        reason: 'manual',
        userId: ctx.user!.id,
        note: input.reason ? sanitize(input.reason) : 'Archived',
      });

      const [updated] = await ctx.db.update(processingActivities)
        .set({
          status: 'archived',
          statusBeforeArchive: activity.status,
          archivedAt: new Date(),
          archivedBy: ctx.user!.id,
          updatedAt: new Date(),
        })
        .where(and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId),
        ))
        .returning();

      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: input.id,
        action: 'upsert',
      });

      return updated;
    }),

  /** B22. The other half of archive. Restores the status the record actually had. */
  restore: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const activity = await assertParentOwned(ctx.db, processingActivities, input.id, ctx.user!.orgId, 'Activity');
      if (activity.status !== 'archived') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This activity is not archived.' });
      }

      // Falls back to draft rather than active. A record archived before this column
      // existed has no recorded prior status, and guessing "active" would republish
      // an Art. 30 record on nothing more than a shrug.
      const [updated] = await ctx.db.update(processingActivities)
        .set({
          status: activity.statusBeforeArchive || 'draft',
          statusBeforeArchive: null,
          archivedAt: null,
          archivedBy: null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(processingActivities.id, input.id),
          eq(processingActivities.organizationId, ctx.user!.orgId),
        ))
        .returning();

      return updated;
    }),

  /**
   * B24. Duplicate — "the single most-requested feature in every ROPA rollout".
   *
   * Copies the record and all four child collections. What it deliberately does not
   * copy is everything that was *said about* the original: it comes back as a draft,
   * unapproved, unpublished, never reviewed, with no attestations, tasks, comments
   * or versions. A copy that inherits an approval is a copy that lets an unreviewed
   * record wear somebody else's sign-off.
   */
  duplicate: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      includeChildren: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const source = await assertParentOwned(ctx.db, processingActivities, input.id, ctx.user!.orgId, 'Activity');
      await enforceLimit(ctx.db, ctx.user!.orgId, 'ropa', 1);

      const {
        id: _id, createdAt: _createdAt, updatedAt: _updatedAt, deletedAt: _deletedAt,
        publishedAt: _pa, publishedBy: _pb,
        publicationExceptionReason: _per, publicationExceptionBy: _peb, publicationExceptionAt: _pea,
        approvalState: _as, approvalRequestedAt: _ara, approvalRequestedBy: _arb,
        currentReviewerId: _cri, approvedAt: _aa, approvedBy: _ab,
        lastReviewedAt: _lra, nextReviewAt: _nra, reviewedBy: _rb,
        archivedAt: _arca, archivedBy: _arcb, statusBeforeArchive: _sba,
        version: _v, previousVersionId: _pvi, completenessScore: _cs,
        ...carried
      } = source as Record<string, any>;

      const [copy] = await ctx.db.insert(processingActivities).values({
        ...(carried as typeof processingActivities.$inferInsert),
        name: sanitize(input.name)?.slice(0, 255) || `${source.name} (copy)`.slice(0, 255),
        status: 'draft',
        approvalState: 'draft',
        duplicatedFromId: source.id,
        createdBy: ctx.user!.id,
      }).returning();
      if (!copy) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      if (input.includeChildren) {
        // Read through the activity id, which was proved above; each insert is a
        // fresh row under the new activity, so nothing here can reach another tenant.
        const [subjects, categories, recipients, transfers] = await Promise.all([
          ctx.db.select().from(processingDataSubjects).where(eq(processingDataSubjects.processingActivityId, source.id)),
          ctx.db.select().from(processingDataCategories).where(eq(processingDataCategories.processingActivityId, source.id)),
          ctx.db.select().from(processingRecipients).where(eq(processingRecipients.processingActivityId, source.id)),
          ctx.db.select().from(processingTransfers).where(eq(processingTransfers.processingActivityId, source.id)),
        ]);

        const reparent = (rows: any[]) => rows.map(({ id, createdAt, updatedAt, ...rest }: any) => ({
          ...rest,
          processingActivityId: copy.id,
        }));

        if (subjects.length) await ctx.db.insert(processingDataSubjects).values(reparent(subjects as any[]));
        if (categories.length) await ctx.db.insert(processingDataCategories).values(reparent(categories as any[]));
        if (recipients.length) await ctx.db.insert(processingRecipients).values(reparent(recipients as any[]));
        if (transfers.length) {
          // tiaCompleted and tiaRiskLevel are evidence about *that* transfer, produced
          // by a TIA that was performed once. Carrying them into a copy is the same
          // fabrication D3 was, by a shorter route.
          await ctx.db.insert(processingTransfers).values(
            reparent(transfers as any[]).map((t: any) => ({ ...t, tiaCompleted: false, tiaRiskLevel: null })),
          );
        }
      }

      // Unconditionally, not inside the branch above: the jsonb mirror came across
      // with the rest of the row, so a copy made without children would otherwise
      // assert subject categories it has no child rows for. The register list and
      // both PDFs read the array, so the copy would show four categories and the
      // editor none.
      await syncDataSubjectMirror(ctx.db, copy.id);
      await refreshCompleteness(ctx.db, copy.id);
      await orgEmbeddingsQueue.add('embed-ropa', {
        orgId: ctx.user!.orgId,
        entityType: 'processing_activity',
        entityId: copy.id,
        action: 'upsert',
      });

      return copy;
    }),

  // -------------------------------------------------------------------------
  // B19 — review cycle and attestation.
  // -------------------------------------------------------------------------

  review: router({
    /**
     * B19. "I have read this record and it is accurate as at today."
     *
     * Writes the three columns the schema has carried since the beginning and never
     * populated, appends an attestation, and moves the review date on by the
     * cadence. The attestation copies in the score and version rather than joining
     * to them: what matters later is what the record looked like when somebody
     * signed it, not what it looks like now.
     */
    attest: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        statement: z.string().max(2000).optional(),
        /** Overrides the cadence for this cycle only — "look at it again in March". */
        nextReviewAt: z.coerce.date().nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const now = new Date();
        const cadence = effectiveCadenceMonths(activity.reviewCadenceMonths, await orgReviewCadence(ctx.db, ctx.user!.orgId));
        const nextReviewAt = input.nextReviewAt !== undefined
          ? input.nextReviewAt ?? null
          : nextReviewFrom(now, cadence);

        const { score } = scoreActivity(await loadBundle(ctx.db, activity));

        const [attestation] = await ctx.db.insert(processingActivityAttestations).values({
          organizationId: ctx.user!.orgId,
          processingActivityId: input.processingActivityId,
          attestedBy: ctx.user!.id,
          attestedAt: now,
          statement: sanitize(input.statement) ?? null,
          scoreAtAttestation: score,
          versionAtAttestation: activity.version ?? 1,
          nextReviewAt,
        }).returning();

        await ctx.db.update(processingActivities)
          .set({ lastReviewedAt: now, reviewedBy: ctx.user!.id, nextReviewAt })
          .where(and(
            eq(processingActivities.id, input.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));

        return attestation;
      }),

    /** B19. The attestation history — who signed off on what, and when. */
    attestations: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        return ctx.db.select({
          id: processingActivityAttestations.id,
          attestedAt: processingActivityAttestations.attestedAt,
          statement: processingActivityAttestations.statement,
          scoreAtAttestation: processingActivityAttestations.scoreAtAttestation,
          versionAtAttestation: processingActivityAttestations.versionAtAttestation,
          nextReviewAt: processingActivityAttestations.nextReviewAt,
          attestedBy: processingActivityAttestations.attestedBy,
          attestorName: users.name,
          attestorEmail: users.email,
        })
          .from(processingActivityAttestations)
          .leftJoin(users, eq(processingActivityAttestations.attestedBy, users.id))
          .where(eq(processingActivityAttestations.processingActivityId, input.processingActivityId))
          .orderBy(desc(processingActivityAttestations.attestedAt));
      }),

    /**
     * B19. The overdue queue, as counts rather than rows.
     *
     * The rows are `list({ reviewOverdue: true })` — this is the badge that tells
     * somebody to go and look, which is a different question and one that should not
     * cost a page of records to answer.
     */
    summary: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .query(async ({ ctx }) => {
        checkOrgContext(ctx.user);
        const now = new Date();
        const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const live = and(
          eq(processingActivities.organizationId, ctx.user!.orgId),
          isNull(processingActivities.deletedAt),
          ne(processingActivities.status, 'archived'),
        );

        const [[overdue], [dueSoon], [unscheduled], [mine]] = await Promise.all([
          ctx.db.select({ value: count() }).from(processingActivities)
            .where(and(live, isNotNull(processingActivities.nextReviewAt), lt(processingActivities.nextReviewAt, now))),
          ctx.db.select({ value: count() }).from(processingActivities)
            .where(and(live, gte(processingActivities.nextReviewAt, now), lte(processingActivities.nextReviewAt, soon))),
          ctx.db.select({ value: count() }).from(processingActivities)
            .where(and(live, isNull(processingActivities.nextReviewAt))),
          ctx.db.select({ value: count() }).from(processingActivities)
            .where(and(
              live,
              isNotNull(processingActivities.nextReviewAt),
              lt(processingActivities.nextReviewAt, now),
              or(
                eq(processingActivities.businessOwnerId, ctx.user!.id),
                eq(processingActivities.privacyOwnerId, ctx.user!.id),
              ),
            )),
        ]);

        return {
          overdue: Number(overdue?.value ?? 0),
          dueSoon: Number(dueSoon?.value ?? 0),
          unscheduled: Number(unscheduled?.value ?? 0),
          overdueMine: Number(mine?.value ?? 0),
        };
      }),
  }),

  // -------------------------------------------------------------------------
  // B20 — approval workflow.
  // -------------------------------------------------------------------------

  approval: router({
    /** B20. Ask a named person to approve the record as it currently stands. */
    submit: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        reviewerId: z.string().uuid(),
        note: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        await assertMembersInOrg(ctx.db, ctx.user!.orgId, [input.reviewerId]);

        if (!canTransition('submit', activity.approvalState)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'This activity is already awaiting a decision.',
          });
        }

        const [approval] = await ctx.db.insert(processingActivityApprovals).values({
          organizationId: ctx.user!.orgId,
          processingActivityId: input.processingActivityId,
          requestedBy: ctx.user!.id,
          requestNote: sanitize(input.note) ?? null,
          reviewerId: input.reviewerId,
          decision: 'pending',
        }).returning();

        await ctx.db.update(processingActivities)
          .set({
            approvalState: 'in_review',
            approvalRequestedAt: new Date(),
            approvalRequestedBy: ctx.user!.id,
            currentReviewerId: input.reviewerId,
          })
          .where(and(
            eq(processingActivities.id, input.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));

        await queueNotification({
          organizationId: ctx.user!.orgId,
          userId: input.reviewerId,
          type: 'ropa.approval_requested',
          title: `Approval requested: "${activity.name}"`,
          body: input.note ? sanitize(input.note)! : 'A processing activity is waiting for your review.',
          actionUrl: `/ropa/${input.processingActivityId}?tab=approval`,
          metadata: { activityId: input.processingActivityId, approvalId: approval?.id },
        });

        return approval;
      }),

    /**
     * B20. Approve or reject, with a reason.
     *
     * A rejection without a reason is refused: "no" that does not say why is not a
     * decision anybody can act on, and it is the thing the requester will ask about
     * within the hour anyway.
     *
     * Approving snapshots the record (B21) and links the snapshot to the decision,
     * so "what did I approve?" has an answer that does not depend on nobody having
     * edited it since.
     */
    decide: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        decision: z.enum(['approved', 'rejected']),
        reason: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        if (!canTransition(input.decision === 'approved' ? 'approve' : 'reject', activity.approvalState)) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This activity is not awaiting a decision.' });
        }
        if (input.decision === 'rejected' && (input.reason ?? '').trim().length < 5) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'A rejection needs a reason.' });
        }

        // The assigned reviewer, or anyone who may delete from the register — which
        // in the default roles is admin and owner. Deliberately not "anyone with
        // ropa:edit": the point of the workflow is that the person who wrote the
        // record is not the person who signs it off.
        const isReviewer = activity.currentReviewerId === ctx.user!.id;
        const canOverride = ctx.user!.permissions?.includes('ropa:delete') || ctx.user!.role === 'owner' || ctx.user!.role === 'admin';
        if (!isReviewer && !canOverride) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the assigned reviewer can decide this approval.' });
        }

        const [pending] = await ctx.db.select().from(processingActivityApprovals)
          .where(and(
            eq(processingActivityApprovals.processingActivityId, input.processingActivityId),
            eq(processingActivityApprovals.organizationId, ctx.user!.orgId),
            eq(processingActivityApprovals.decision, 'pending'),
          ));
        if (!pending) throw new TRPCError({ code: 'NOT_FOUND', message: 'No approval is pending.' });

        const version = input.decision === 'approved'
          ? await snapshotActivity(ctx.db, activity, {
              reason: 'approved',
              userId: ctx.user!.id,
              note: sanitize(input.reason) ?? null,
            })
          : null;

        const [decided] = await ctx.db.update(processingActivityApprovals)
          .set({
            decision: input.decision,
            decidedBy: ctx.user!.id,
            decidedAt: new Date(),
            decisionReason: sanitize(input.reason) ?? null,
            versionId: version?.id ?? null,
          })
          .where(and(
            eq(processingActivityApprovals.id, pending.id),
            eq(processingActivityApprovals.organizationId, ctx.user!.orgId),
          ))
          .returning();

        await ctx.db.update(processingActivities)
          .set({
            approvalState: input.decision === 'approved' ? 'approved' : 'rejected',
            approvedAt: input.decision === 'approved' ? new Date() : null,
            approvedBy: input.decision === 'approved' ? ctx.user!.id : null,
            currentReviewerId: null,
          })
          .where(and(
            eq(processingActivities.id, input.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));

        await queueNotification({
          organizationId: ctx.user!.orgId,
          userId: pending.requestedBy,
          type: 'ropa.approval_decided',
          title: `"${activity.name}" was ${input.decision}`,
          body: input.reason ? sanitize(input.reason)! : `Your approval request was ${input.decision}.`,
          actionUrl: `/ropa/${input.processingActivityId}?tab=approval`,
          metadata: { activityId: input.processingActivityId, decision: input.decision },
        });

        return decided;
      }),

    /** B20. Take back a request nobody has decided yet. */
    withdraw: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        if (!canTransition('withdraw', activity.approvalState)) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Nothing is awaiting a decision.' });
        }

        await ctx.db.update(processingActivityApprovals)
          .set({ decision: 'withdrawn', decidedBy: ctx.user!.id, decidedAt: new Date() })
          .where(and(
            eq(processingActivityApprovals.processingActivityId, input.processingActivityId),
            eq(processingActivityApprovals.organizationId, ctx.user!.orgId),
            eq(processingActivityApprovals.decision, 'pending'),
          ));

        const [updated] = await ctx.db.update(processingActivities)
          .set({ approvalState: 'draft', currentReviewerId: null })
          .where(and(
            eq(processingActivities.id, input.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ))
          .returning();

        return updated;
      }),

    /** B20. The immutable record — every request and decision, newest first. */
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const requester = alias(users, 'requester');
        const reviewer = alias(users, 'reviewer');
        return ctx.db.select({
          id: processingActivityApprovals.id,
          requestedAt: processingActivityApprovals.requestedAt,
          requestNote: processingActivityApprovals.requestNote,
          decision: processingActivityApprovals.decision,
          decidedAt: processingActivityApprovals.decidedAt,
          decisionReason: processingActivityApprovals.decisionReason,
          versionId: processingActivityApprovals.versionId,
          requestedBy: processingActivityApprovals.requestedBy,
          requesterName: requester.name,
          requesterEmail: requester.email,
          reviewerId: processingActivityApprovals.reviewerId,
          reviewerName: reviewer.name,
          reviewerEmail: reviewer.email,
        })
          .from(processingActivityApprovals)
          .leftJoin(requester, eq(processingActivityApprovals.requestedBy, requester.id))
          .leftJoin(reviewer, eq(processingActivityApprovals.reviewerId, reviewer.id))
          .where(eq(processingActivityApprovals.processingActivityId, input.processingActivityId))
          .orderBy(desc(processingActivityApprovals.requestedAt));
      }),
  }),

  // -------------------------------------------------------------------------
  // B21 — versions.
  // -------------------------------------------------------------------------

  versions: router({
    /** The list, without the snapshots — a version list should not ship ten blobs. */
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        return ctx.db.select({
          id: processingActivityVersions.id,
          version: processingActivityVersions.version,
          reason: processingActivityVersions.reason,
          note: processingActivityVersions.note,
          score: processingActivityVersions.score,
          status: processingActivityVersions.status,
          createdAt: processingActivityVersions.createdAt,
          createdBy: processingActivityVersions.createdBy,
          authorName: users.name,
          authorEmail: users.email,
        })
          .from(processingActivityVersions)
          .leftJoin(users, eq(processingActivityVersions.createdBy, users.id))
          .where(eq(processingActivityVersions.processingActivityId, input.processingActivityId))
          .orderBy(desc(processingActivityVersions.version));
      }),

    /** B21's "exportable as at a date" — one full snapshot, read back. */
    get: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const [row] = await ctx.db.select().from(processingActivityVersions)
          .where(and(
            eq(processingActivityVersions.id, input.id),
            eq(processingActivityVersions.organizationId, ctx.user!.orgId),
          ));
        if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
        return row;
      }),

    /**
     * B21's "diffable". Either version against another, or a version against the
     * record as it stands now — which is the comparison somebody actually wants
     * when they open an approved version.
     */
    diff: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ fromId: z.string().uuid(), toId: z.string().uuid().nullish() }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const [from] = await ctx.db.select().from(processingActivityVersions)
          .where(and(
            eq(processingActivityVersions.id, input.fromId),
            eq(processingActivityVersions.organizationId, ctx.user!.orgId),
          ));
        if (!from) throw new TRPCError({ code: 'NOT_FOUND' });

        let to: VersionSnapshot;
        let toLabel: string;
        if (input.toId) {
          const [row] = await ctx.db.select().from(processingActivityVersions)
            .where(and(
              eq(processingActivityVersions.id, input.toId),
              eq(processingActivityVersions.organizationId, ctx.user!.orgId),
              // Comparing two versions of *different* activities would produce a
              // diff in which every field changed, which is not a diff, it is noise
              // with a confident presentation.
              eq(processingActivityVersions.processingActivityId, from.processingActivityId),
            ));
          if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
          to = row.snapshot as unknown as VersionSnapshot;
          toLabel = `v${row.version}`;
        } else {
          const [activity] = await ctx.db.select().from(processingActivities)
            .where(and(
              eq(processingActivities.id, from.processingActivityId),
              eq(processingActivities.organizationId, ctx.user!.orgId),
            ));
          if (!activity) throw new TRPCError({ code: 'NOT_FOUND' });
          to = buildSnapshot(await loadBundle(ctx.db, activity), new Date());
          toLabel = 'current';
        }

        return {
          from: { label: `v${from.version}`, takenAt: from.createdAt },
          to: { label: toLabel },
          diff: diffSnapshots(from.snapshot as unknown as VersionSnapshot, to),
        };
      }),

    /** A snapshot taken on purpose — "before I restructure this". */
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ processingActivityId: z.string().uuid(), note: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        return snapshotActivity(ctx.db, activity, {
          reason: 'manual',
          userId: ctx.user!.id,
          note: sanitize(input.note) ?? null,
        });
      }),

    /**
     * B21's other half — put the record back as it was.
     *
     * Three things make this safe enough to offer, and they are the three reasons it
     * was held back when the rest of versioning shipped.
     *
     * **It snapshots first.** A restore is an edit like any other, and the state it
     * overwrites is exactly the state somebody will want back when they realise they
     * restored the wrong version. That is what `pre_restore` is for.
     *
     * **It restores what the record said, not where it was.** Publication, review
     * dates, archive state and approval are excluded — see RESTORE_EXCLUDED_FIELDS.
     * Restoring `status` would republish a record somebody deliberately withdrew,
     * around B23's gate, on the strength of a button labelled "restore".
     *
     * **It reconciles child rows on their primary key** rather than deleting and
     * re-inserting them. `transfer_impact_assessments.processing_transfer_id`
     * references `processing_transfers.id` with no `ON DELETE`, so the obvious
     * implementation fails outright against any transfer that has had a TIA — and
     * where it succeeded it would sever the link between a Chapter V transfer and the
     * assessment justifying it. Rows in both are updated; only rows added since are
     * deleted, and a TIA on one of those is refused by name rather than as a raw
     * constraint violation.
     */
    restore: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const [version] = await ctx.db.select().from(processingActivityVersions)
          .where(and(
            eq(processingActivityVersions.id, input.id),
            eq(processingActivityVersions.organizationId, ctx.user!.orgId),
          ));
        if (!version) throw new TRPCError({ code: 'NOT_FOUND' });

        const [activity] = await ctx.db.select().from(processingActivities)
          .where(and(
            eq(processingActivities.id, version.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
            isNull(processingActivities.deletedAt),
          ));
        if (!activity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });

        const snapshot = version.snapshot as unknown as VersionSnapshot;

        const plans = [
          { table: processingDataSubjects, rows: snapshot.dataSubjects ?? [] },
          { table: processingDataCategories, rows: snapshot.dataCategories ?? [] },
          { table: processingRecipients, rows: snapshot.recipients ?? [] },
          { table: processingTransfers, rows: snapshot.transfers ?? [] },
        ] as const;

        // Worked out before anything is written, so a refusal leaves the record
        // untouched rather than half restored.
        const reconciled = await Promise.all(plans.map(async (plan) => {
          const current = await ctx.db.select().from(plan.table)
            .where(eq(plan.table.processingActivityId, activity.id));
          return { ...plan, ...reconcileChildren(current as any[], plan.rows as any[]) };
        }));

        const transferPlan = reconciled[3]!;
        if (transferPlan.deleteIds.length > 0) {
          const blocked = await ctx.db.select({
            id: transferImpactAssessments.id,
            country: transferImpactAssessments.destinationCountry,
          })
            .from(transferImpactAssessments)
            .where(and(
              eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
              inArray(transferImpactAssessments.processingTransferId, transferPlan.deleteIds),
            ));
          if (blocked.length > 0) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: `This version predates ${blocked.length} transfer impact assessment${blocked.length === 1 ? '' : 's'} (${blocked.map((b: any) => b.country).join(', ')}). Restoring it would remove the transfer${blocked.length === 1 ? '' : 's'} they assess. Delete the assessment${blocked.length === 1 ? '' : 's'} first if that is what you mean.`,
            });
          }
        }

        await snapshotActivity(ctx.db, activity, {
          reason: 'pre_restore',
          userId: ctx.user!.id,
          note: `Superseded by a restore of v${version.version}`,
        });

        const restored = restorableActivityFields(snapshot.activity ?? {});
        const [updated] = await ctx.db.update(processingActivities)
          .set({
            ...restored,
            updatedAt: new Date(),
            // A restore always rewrites substantive content, so an approved record
            // is no longer the record anybody approved. Same rule as an ordinary
            // edit — see editInvalidatesApproval — reached by a different route.
            ...(activity.approvalState === 'approved'
              ? { approvalState: 'draft', approvedAt: null, approvedBy: null }
              : {}),
          })
          .where(and(
            eq(processingActivities.id, activity.id),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ))
          .returning();

        for (const plan of reconciled) {
          for (const row of plan.update) {
            // reviveSnapshotDates because the snapshot is jsonb: every Date in it
            // came back as a string, and a drizzle timestamp column calls
            // .toISOString() on what it is given.
            const { id, processingActivityId, createdAt, ...rest } = reviveSnapshotDates(row as any);
            await ctx.db.update(plan.table)
              .set({ ...rest, processingActivityId: activity.id, updatedAt: new Date() })
              .where(eq(plan.table.id, id));
          }
          if (plan.insert.length > 0) {
            await ctx.db.insert(plan.table).values(
              plan.insert.map((row: any) => ({
                ...reviveSnapshotDates(row),
                processingActivityId: activity.id,
              })),
            );
          }
          if (plan.deleteIds.length > 0) {
            await ctx.db.delete(plan.table).where(inArray(plan.table.id, plan.deleteIds));
          }
        }

        await syncDataSubjectMirror(ctx.db, activity.id);
        await refreshCompleteness(ctx.db, activity.id);
        await orgEmbeddingsQueue.add('embed-ropa', {
          orgId: ctx.user!.orgId,
          entityType: 'processing_activity',
          entityId: activity.id,
          action: 'upsert',
        });

        return { activity: updated, restoredFrom: version.version };
      }),
  }),

  /**
   * B20. The organisation-level switch that decides whether approval is a workflow
   * or a requirement. Admin-only: it changes what publishing means for everybody.
   */
  governance: router({
    get: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .query(async ({ ctx }) => {
        checkOrgContext(ctx.user);
        const [org] = await ctx.db.select({ settings: organizations.settings }).from(organizations)
          .where(eq(organizations.id, ctx.user!.orgId));
        const settings = (org?.settings as Record<string, any> | null) ?? {};
        return {
          approvalRequired: settings.ropaApprovalRequired === true,
          reviewCadenceMonths: typeof settings.ropaReviewCadenceMonths === 'number'
            ? settings.ropaReviewCadenceMonths
            : DEFAULT_REVIEW_CADENCE_MONTHS,
        };
      }),

    update: protectedProcedure
      .use(requireRole('admin'))
      .input(z.object({
        approvalRequired: z.boolean().optional(),
        reviewCadenceMonths: z.number().int().min(1).max(120).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        // Merged in SQL rather than read-modify-written in JS: `settings` is shared
        // with every other feature that keeps something there, and a whole-object
        // write would drop whatever landed between the read and the write.
        const patch: Record<string, any> = {};
        if (input.approvalRequired !== undefined) patch.ropaApprovalRequired = input.approvalRequired;
        if (input.reviewCadenceMonths !== undefined) patch.ropaReviewCadenceMonths = input.reviewCadenceMonths;
        if (Object.keys(patch).length === 0) return { ok: true };

        await ctx.db.update(organizations)
          .set({ settings: sql`coalesce(${organizations.settings}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
          .where(eq(organizations.id, ctx.user!.orgId));

        return { ok: true };
      }),
  }),

  // -------------------------------------------------------------------------
  // L107/L108 — bulk operations.
  // -------------------------------------------------------------------------

  bulk: router({
    /**
     * L108. One mutation for every bulk field change, because they are one act: a
     * user selects rows and applies a change, and splitting that into six endpoints
     * would mean six ownership checks to get right instead of one.
     *
     * Every write is filtered on `inArray(id, …) AND organizationId = session org`.
     * The id list is client-supplied — it comes from `listIds`, but nothing stops a
     * caller sending their own — so the organisation predicate is what makes it
     * safe, not the fact that the ids came from somewhere trustworthy.
     */
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        ids: z.array(z.string().uuid()).min(1).max(BULK_SELECTION_CAP),
        set: z.object({
          status: z.enum(['draft', 'under_review']).optional(),
          riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
          businessOwnerId: z.string().uuid().nullish(),
          privacyOwnerId: z.string().uuid().nullish(),
          nextReviewAt: z.coerce.date().nullish(),
          reviewCadenceMonths: z.number().int().min(0).max(120).nullish(),
          addTags: z.array(z.string().min(1).max(60)).max(25).optional(),
          removeTags: z.array(z.string().min(1).max(60)).max(25).optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        // 'active' is absent from the status enum above for the same reason it is
        // absent from create: publication runs through B23's gate, which is a
        // per-record judgement about Art. 30 completeness. A bulk publish would
        // either bypass the gate or fail on the first record and leave the rest in
        // an unknown state — both worse than not offering it.
        const patch: Record<string, any> = {};
        if (input.set.status !== undefined) patch.status = input.set.status;
        if (input.set.riskLevel !== undefined) patch.riskLevel = input.set.riskLevel;
        if (input.set.businessOwnerId !== undefined) patch.businessOwnerId = input.set.businessOwnerId ?? null;
        if (input.set.privacyOwnerId !== undefined) patch.privacyOwnerId = input.set.privacyOwnerId ?? null;
        if (input.set.nextReviewAt !== undefined) patch.nextReviewAt = input.set.nextReviewAt ?? null;
        if (input.set.reviewCadenceMonths !== undefined) patch.reviewCadenceMonths = input.set.reviewCadenceMonths ?? null;

        await assertMembersInOrg(ctx.db, ctx.user!.orgId, [
          input.set.businessOwnerId, input.set.privacyOwnerId,
        ].filter((v): v is string => !!v));

        const scope = and(
          inArray(processingActivities.id, input.ids),
          eq(processingActivities.organizationId, ctx.user!.orgId),
          isNull(processingActivities.deletedAt),
        );

        let touched: any[] = [];
        if (Object.keys(patch).length > 0) {
          touched = await ctx.db.update(processingActivities)
            .set({ ...patch, updatedAt: new Date() })
            .where(scope)
            .returning({ id: processingActivities.id });
        }

        const add = normaliseTags(input.set.addTags ?? []);
        const remove = normaliseTags(input.set.removeTags ?? []);
        if (add.length > 0 || remove.length > 0) {
          // Set semantics, done in SQL: reading every row, merging in JS and writing
          // back would lose a tag added by a concurrent bulk operation, and bulk
          // tagging is exactly the thing two people do at once while tidying up.
          const addJson = JSON.stringify(add);
          const removeJson = JSON.stringify(remove);
          const rows = await ctx.db.update(processingActivities)
            .set({
              tags: sql`(
                SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
                FROM jsonb_array_elements_text(${processingActivities.tags} || ${addJson}::jsonb) AS t
                WHERE t NOT IN (SELECT jsonb_array_elements_text(${removeJson}::jsonb))
              )`,
              updatedAt: new Date(),
            })
            .where(scope)
            .returning({ id: processingActivities.id });
          touched = rows;
        }

        return { updated: touched.length };
      }),

    /** L108. Bulk archive, which is the safe half of "get these out of my register". */
    archive: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(BULK_SELECTION_CAP) }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        // statusBeforeArchive is set from the row's own status in the same statement,
        // so a bulk restore puts each record back where it was rather than putting
        // all of them back as drafts.
        const rows = await ctx.db.update(processingActivities)
          .set({
            status: 'archived',
            statusBeforeArchive: sql`${processingActivities.status}`,
            archivedAt: new Date(),
            archivedBy: ctx.user!.id,
            updatedAt: new Date(),
          })
          .where(and(
            inArray(processingActivities.id, input.ids),
            eq(processingActivities.organizationId, ctx.user!.orgId),
            isNull(processingActivities.deletedAt),
            ne(processingActivities.status, 'archived'),
          ))
          .returning({ id: processingActivities.id });

        for (const row of rows) {
          await orgEmbeddingsQueue.add('embed-ropa', {
            orgId: ctx.user!.orgId,
            entityType: 'processing_activity',
            entityId: row.id,
            action: 'upsert',
          });
        }
        return { archived: rows.length };
      }),

    /** L108. Bulk delete — soft, like the single-record one, and permission-gated harder. */
    delete: protectedProcedure
      .use(requirePermission('ropa', 'delete'))
      .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(BULK_SELECTION_CAP) }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const rows = await ctx.db.update(processingActivities)
          .set({ deletedAt: new Date() })
          .where(and(
            inArray(processingActivities.id, input.ids),
            eq(processingActivities.organizationId, ctx.user!.orgId),
            isNull(processingActivities.deletedAt),
          ))
          .returning({ id: processingActivities.id });

        for (const row of rows) {
          await orgEmbeddingsQueue.add('embed-ropa', {
            orgId: ctx.user!.orgId,
            entityType: 'processing_activity',
            entityId: row.id,
            action: 'delete',
          });
        }
        return { deleted: rows.length };
      }),

    /**
     * L107. The selection, as rows, for the CSV the user is about to download.
     *
     * Server-side rather than "export what is loaded", which is what the register's
     * CSV button did: a filtered selection of 340 rows exported the 25 on screen.
     */
    export: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(BULK_SELECTION_CAP) }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        return ctx.db.select().from(processingActivities)
          .where(and(
            inArray(processingActivities.id, input.ids),
            eq(processingActivities.organizationId, ctx.user!.orgId),
            isNull(processingActivities.deletedAt),
          ))
          .orderBy(asc(processingActivities.name));
      }),
  }),

  // -------------------------------------------------------------------------
  // M110/M111 — tasks and comments.
  // -------------------------------------------------------------------------

  tasks: router({
    /**
     * M110. Either one activity's tasks, or everything assigned to the caller —
     * the second being the queue that makes tasks worth having.
     */
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        processingActivityId: z.string().uuid().optional(),
        assignedToMe: z.boolean().default(false),
        status: z.array(z.enum(['open', 'in_progress', 'done', 'cancelled'])).optional(),
      }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        if (input.processingActivityId) {
          await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        }

        const filters: any[] = [eq(processingActivityTasks.organizationId, ctx.user!.orgId)];
        if (input.processingActivityId) filters.push(eq(processingActivityTasks.processingActivityId, input.processingActivityId));
        if (input.assignedToMe) filters.push(eq(processingActivityTasks.assigneeId, ctx.user!.id));
        if (input.status?.length) filters.push(inArray(processingActivityTasks.status, input.status));

        return ctx.db.select({
          id: processingActivityTasks.id,
          processingActivityId: processingActivityTasks.processingActivityId,
          activityName: processingActivities.name,
          title: processingActivityTasks.title,
          description: processingActivityTasks.description,
          section: processingActivityTasks.section,
          status: processingActivityTasks.status,
          priority: processingActivityTasks.priority,
          dueDate: processingActivityTasks.dueDate,
          assigneeId: processingActivityTasks.assigneeId,
          assigneeName: users.name,
          assigneeEmail: users.email,
          completedAt: processingActivityTasks.completedAt,
          createdAt: processingActivityTasks.createdAt,
        })
          .from(processingActivityTasks)
          .leftJoin(users, eq(processingActivityTasks.assigneeId, users.id))
          .leftJoin(processingActivities, eq(processingActivityTasks.processingActivityId, processingActivities.id))
          .where(and(...filters))
          .orderBy(asc(processingActivityTasks.dueDate), desc(processingActivityTasks.createdAt));
      }),

    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().max(4000).optional(),
        section: z.string().max(40).optional(),
        assigneeId: z.string().uuid().nullish(),
        dueDate: z.coerce.date().nullish(),
        priority: z.enum(['low', 'normal', 'high']).default('normal'),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');
        if (input.assigneeId) await assertMembersInOrg(ctx.db, ctx.user!.orgId, [input.assigneeId]);

        const [task] = await ctx.db.insert(processingActivityTasks).values({
          organizationId: ctx.user!.orgId,
          processingActivityId: input.processingActivityId,
          title: sanitize(input.title)!,
          description: sanitize(input.description) ?? null,
          section: input.section ?? null,
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ?? null,
          priority: input.priority,
          createdBy: ctx.user!.id,
        }).returning();

        if (task?.assigneeId && task.assigneeId !== ctx.user!.id) {
          await queueNotification({
            organizationId: ctx.user!.orgId,
            userId: task.assigneeId,
            type: 'ropa.task_assigned',
            title: `Task on "${activity.name}": ${task.title}`,
            body: task.description || 'A task on a processing activity has been assigned to you.',
            actionUrl: `/ropa/${input.processingActivityId}${task.section ? `?tab=${task.section}` : ''}`,
            metadata: { activityId: input.processingActivityId, taskId: task.id },
          });
        }

        return task;
      }),

    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.object({
          title: z.string().min(1).max(255),
          description: z.string().max(4000).nullable(),
          section: z.string().max(40).nullable(),
          assigneeId: z.string().uuid().nullable(),
          dueDate: z.coerce.date().nullable(),
          status: z.enum(['open', 'in_progress', 'done', 'cancelled']),
          priority: z.enum(['low', 'normal', 'high']),
        }).partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const existing = await assertOwned(ctx.db, {
          table: processingActivityTasks,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Task',
        });
        if (input.data.assigneeId) await assertMembersInOrg(ctx.db, ctx.user!.orgId, [input.data.assigneeId]);

        const patch: Record<string, any> = { ...input.data, updatedAt: new Date() };
        if (patch.title) patch.title = sanitize(patch.title);
        if (patch.description) patch.description = sanitize(patch.description);
        // Closing a task records who closed it and when; re-opening clears both,
        // rather than leaving a task that is open and claims to have been completed.
        if (input.data.status === 'done' && existing.status !== 'done') {
          patch.completedAt = new Date();
          patch.completedBy = ctx.user!.id;
        } else if (input.data.status && input.data.status !== 'done') {
          patch.completedAt = null;
          patch.completedBy = null;
        }
        // A reassignment is a new piece of work for the new assignee, so the "we
        // already reminded about this" marker has to go with it.
        if (input.data.assigneeId !== undefined && input.data.assigneeId !== existing.assigneeId) {
          patch.reminderSentAt = null;
        }

        const [updated] = await ctx.db.update(processingActivityTasks)
          .set(patch)
          .where(and(
            eq(processingActivityTasks.id, input.id),
            eq(processingActivityTasks.organizationId, ctx.user!.orgId),
          ))
          .returning();

        if (updated?.assigneeId && updated.assigneeId !== existing.assigneeId && updated.assigneeId !== ctx.user!.id) {
          await queueNotification({
            organizationId: ctx.user!.orgId,
            userId: updated.assigneeId,
            type: 'ropa.task_assigned',
            title: `Task assigned to you: ${updated.title}`,
            body: updated.description || 'A task on a processing activity has been assigned to you.',
            actionUrl: `/ropa/${updated.processingActivityId}`,
            metadata: { activityId: updated.processingActivityId, taskId: updated.id },
          });
        }

        return updated;
      }),

    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        await assertOwned(ctx.db, { table: processingActivityTasks, id: input.id, orgId: ctx.user!.orgId, label: 'Task' });

        const [deleted] = await ctx.db.delete(processingActivityTasks)
          .where(and(
            eq(processingActivityTasks.id, input.id),
            eq(processingActivityTasks.organizationId, ctx.user!.orgId),
          ))
          .returning();
        return deleted;
      }),
  }),

  comments: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        field: z.string().max(80).optional(),
        includeResolved: z.boolean().default(true),
      }))
      .query(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const filters: any[] = [
          eq(processingActivityComments.processingActivityId, input.processingActivityId),
          isNull(processingActivityComments.deletedAt),
        ];
        if (input.field) filters.push(eq(processingActivityComments.field, input.field));
        if (!input.includeResolved) filters.push(isNull(processingActivityComments.resolvedAt));

        return ctx.db.select({
          id: processingActivityComments.id,
          parentId: processingActivityComments.parentId,
          field: processingActivityComments.field,
          body: processingActivityComments.body,
          mentions: processingActivityComments.mentions,
          authorId: processingActivityComments.authorId,
          authorName: users.name,
          authorEmail: users.email,
          resolvedAt: processingActivityComments.resolvedAt,
          resolvedBy: processingActivityComments.resolvedBy,
          createdAt: processingActivityComments.createdAt,
        })
          .from(processingActivityComments)
          .leftJoin(users, eq(processingActivityComments.authorId, users.id))
          .where(and(...filters))
          .orderBy(asc(processingActivityComments.createdAt));
      }),

    /**
     * M111. A comment, with its mentions resolved and notified.
     *
     * Mentions are parsed out of `@[Name](uuid)` and every id is proved to be a
     * member of the caller's organisation before anything is stored — a raw uuid in
     * a comment body would otherwise address, and email, another tenant's staff.
     */
    create: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        body: z.string().min(1).max(4000),
        field: z.string().max(80).optional(),
        parentId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        if (input.parentId) {
          const parent = await assertOwned(ctx.db, {
            table: processingActivityComments,
            id: input.parentId,
            orgId: ctx.user!.orgId,
            label: 'Comment',
          });
          if (parent.processingActivityId !== input.processingActivityId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'That reply belongs to a different activity.' });
          }
        }

        const body = sanitize(input.body)!;
        const mentions = extractMentions(body);
        await assertMembersInOrg(ctx.db, ctx.user!.orgId, mentions);

        const [comment] = await ctx.db.insert(processingActivityComments).values({
          organizationId: ctx.user!.orgId,
          processingActivityId: input.processingActivityId,
          parentId: input.parentId ?? null,
          field: input.field ?? null,
          body,
          mentions,
          authorId: ctx.user!.id,
        }).returning();

        for (const userId of mentions.filter((id) => id !== ctx.user!.id)) {
          await queueNotification({
            organizationId: ctx.user!.orgId,
            userId,
            type: 'ropa.comment_mention',
            title: `You were mentioned on "${activity.name}"`,
            body: body.slice(0, 280),
            actionUrl: `/ropa/${input.processingActivityId}`,
            metadata: { activityId: input.processingActivityId, commentId: comment?.id },
          });
        }

        return comment;
      }),

    /** Marks a thread answered. Reversible — a question can turn out not to be settled. */
    resolve: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ id: z.string().uuid(), resolved: z.boolean().default(true) }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        await assertOwned(ctx.db, { table: processingActivityComments, id: input.id, orgId: ctx.user!.orgId, label: 'Comment' });

        const [updated] = await ctx.db.update(processingActivityComments)
          .set({
            resolvedAt: input.resolved ? new Date() : null,
            resolvedBy: input.resolved ? ctx.user!.id : null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(processingActivityComments.id, input.id),
            eq(processingActivityComments.organizationId, ctx.user!.orgId),
          ))
          .returning();
        return updated;
      }),

    /**
     * Soft delete, and only your own. A thread with a hole in it reads as tampering
     * in an audit context, so the row survives and the list filters it out.
     */
    delete: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const existing = await assertOwned(ctx.db, { table: processingActivityComments, id: input.id, orgId: ctx.user!.orgId, label: 'Comment' });
        if (existing.authorId !== ctx.user!.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own comments.' });
        }

        const [deleted] = await ctx.db.update(processingActivityComments)
          .set({ deletedAt: new Date() })
          .where(and(
            eq(processingActivityComments.id, input.id),
            eq(processingActivityComments.organizationId, ctx.user!.orgId),
          ))
          .returning();
        return deleted;
      }),
  }),

  // -------------------------------------------------------------------------
  // K104 — saved views.
  // -------------------------------------------------------------------------

  savedViews: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .query(async ({ ctx }) => {
        checkOrgContext(ctx.user);
        // Mine, plus anything shared with the organisation. A private view belongs
        // to its author; a shared one is the team's.
        return ctx.db.select().from(ropaSavedViews)
          .where(and(
            eq(ropaSavedViews.organizationId, ctx.user!.orgId),
            or(eq(ropaSavedViews.createdBy, ctx.user!.id), eq(ropaSavedViews.isShared, true)),
          ))
          .orderBy(asc(ropaSavedViews.name));
      }),

    save: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        // Validated against the same schema `list` uses, so a stored view cannot
        // smuggle in a filter the API would reject — and a view saved today still
        // parses after the filter set grows.
        filters: registerFilterSchema,
        isShared: z.boolean().default(false),
        defaultForRole: z.enum(['owner', 'admin', 'member', 'viewer']).nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        if (input.id) {
          const existing = await assertOwned(ctx.db, { table: ropaSavedViews, id: input.id, orgId: ctx.user!.orgId, label: 'View' });
          if (existing.createdBy !== ctx.user!.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit views you created.' });
          }
          const [updated] = await ctx.db.update(ropaSavedViews)
            .set({
              name: sanitize(input.name)!,
              description: sanitize(input.description) ?? null,
              filters: input.filters as any,
              isShared: input.isShared,
              defaultForRole: input.defaultForRole ?? null,
              updatedAt: new Date(),
            })
            .where(and(
              eq(ropaSavedViews.id, input.id),
              eq(ropaSavedViews.organizationId, ctx.user!.orgId),
            ))
            .returning();
          return updated;
        }

        try {
          const [created] = await ctx.db.insert(ropaSavedViews).values({
            organizationId: ctx.user!.orgId,
            name: sanitize(input.name)!,
            description: sanitize(input.description) ?? null,
            filters: input.filters as any,
            isShared: input.isShared,
            defaultForRole: input.defaultForRole ?? null,
            createdBy: ctx.user!.id,
          }).returning();
          return created;
        } catch (err: any) {
          if (err?.code === '23505') {
            throw new TRPCError({ code: 'CONFLICT', message: 'You already have a view with that name.' });
          }
          throw err;
        }
      }),

    delete: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);
        const existing = await assertOwned(ctx.db, { table: ropaSavedViews, id: input.id, orgId: ctx.user!.orgId, label: 'View' });
        if (existing.createdBy !== ctx.user!.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete views you created.' });
        }

        const [deleted] = await ctx.db.delete(ropaSavedViews)
          .where(and(
            eq(ropaSavedViews.id, input.id),
            eq(ropaSavedViews.organizationId, ctx.user!.orgId),
          ))
          .returning();
        return deleted;
      }),
  }),

  // Advanced features and nested routers to be expanded...
  /**
   * I85–I89. The activity's trail — filtered, paginated, child rows included, and
   * exportable.
   *
   * What was here fetched every audit row whose `resource_id` matched the activity,
   * newest first, with no limit and no filter. Three things were wrong with that
   * and all three are what an auditor actually asks for: a register with a year of
   * edits returned thousands of rows to render a tab; child-table changes were
   * invisible because they file against their own id (I86); and there was no way
   * to answer "what did this person change in March", which is the only question
   * anybody brings to a trail.
   */
  history: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        activityId: z.string().uuid(),
        actorId: z.string().uuid().optional(),
        /** A field *name*, matched against the diff's keys. */
        field: z.string().max(80).optional(),
        changeType: z.enum(AUDIT_CHANGE_TYPES).optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        limit: z.number().min(1).max(100).default(25),
        cursor: z.string().nullish(),
      }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.activityId, ctx.user!.orgId, 'Activity');

        const filters: any[] = [
          eq(auditLogs.organizationId, ctx.user!.orgId),
          // I86. The record's own events, plus everything that happened in one of
          // its child rows. Without the second half, adding a data category — most
          // of what an Art. 30 record consists of — left no trace on the record.
          or(
            eq(auditLogs.resourceId, input.activityId),
            eq(auditLogs.parentResourceId, input.activityId),
          ),
        ];

        if (input.actorId) filters.push(eq(auditLogs.userId, input.actorId));
        if (input.from) filters.push(gte(auditLogs.createdAt, input.from));
        if (input.to) filters.push(lte(auditLogs.createdAt, input.to));

        if (input.changeType) {
          const suffixes = CHANGE_TYPE_SUFFIXES[input.changeType];
          if (suffixes.length > 0) {
            filters.push(or(...suffixes.map((suffix) => ilike(auditLogs.action, `%.${suffix}`))));
          } else {
            // 'other' is the complement, and has to be expressed as one: an empty
            // suffix list would otherwise filter nothing and quietly return
            // everything under a label that promises the opposite.
            const known = [
              ...CHANGE_TYPE_SUFFIXES.create,
              ...CHANGE_TYPE_SUFFIXES.update,
              ...CHANGE_TYPE_SUFFIXES.delete,
            ];
            filters.push(and(...known.map((suffix) => not(ilike(auditLogs.action, `%.${suffix}`)))));
          }
        }

        if (input.field) {
          // The diff is `{ field: { old, new } }`, so a field filter is a jsonb key
          // test rather than a text search — `?` on the top level of `changes`.
          // Searching the serialised blob would match a *value* that happens to
          // contain the field name, which is a filter that lies about its results.
          filters.push(sql`${auditLogs.changes} ? ${input.field}`);
        }

        // Keyset on (created_at, id), not on created_at alone. The audit
        // middleware writes through `setImmediate`, so a burst of child-row edits
        // from one save lands with timestamps that collide at millisecond
        // resolution — and a cursor comparing only the timestamp drops every row
        // that shares the boundary instant.
        if (input.cursor) {
          try {
            const { sortValue, id } = decodeCursor(input.cursor);
            const at = new Date(String(sortValue));
            filters.push(or(
              lt(auditLogs.createdAt, at),
              and(eq(auditLogs.createdAt, at), lt(auditLogs.id, id)),
            ));
          } catch {
            // A cursor from an older build, or a mangled one. Serving page one is
            // the right failure: the alternative is a 500 on a tab that was open
            // across a deploy.
          }
        }

        const rows = await ctx.db.select().from(auditLogs)
          .where(and(...filters))
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(input.limit + 1);

        const page = (rows as any[]).slice(0, input.limit);
        const last = page[page.length - 1];

        return {
          entries: page.map((row) => ({
            ...row,
            // I85. Rendered here rather than in the browser, so the tab, the CSV
            // and the PDF all say the same thing about the same edit.
            renderedChanges: describeChanges(row.changes),
            changeType: changeTypeOf(row.action ?? ''),
          })),
          nextCursor: rows.length > input.limit && last ? encodeCursor(last.createdAt, last.id) : null,
        };
      }),

    /** The distinct people who have touched this record, for the actor filter. */
    actors: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ activityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.activityId, ctx.user!.orgId, 'Activity');

        const rows = await ctx.db.selectDistinct({
          userId: auditLogs.userId,
          userEmail: auditLogs.userEmail,
        }).from(auditLogs)
          .where(and(
            eq(auditLogs.organizationId, ctx.user!.orgId),
            or(
              eq(auditLogs.resourceId, input.activityId),
              eq(auditLogs.parentResourceId, input.activityId),
            ),
          ));

        return (rows as any[]).filter((r) => r.userId);
      }),

    /**
     * I89. The trail as a file — one activity's, or the whole register's.
     *
     * CSV rather than PDF, and one row per changed field rather than one per
     * event: a spreadsheet is what a regulator asks for precisely so it can be
     * sorted on a field name, and that only works if the field is a column.
     *
     * Capped at 10,000 rows. An uncapped export of a register's whole trail is a
     * query that succeeds in staging and times out in production against the one
     * customer who needed it.
     */
    export: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        activityId: z.string().uuid().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const filters: any[] = [eq(auditLogs.organizationId, ctx.user!.orgId)];

        if (input.activityId) {
          await assertParentOwned(ctx.db, processingActivities, input.activityId, ctx.user!.orgId, 'Activity');
          filters.push(or(
            eq(auditLogs.resourceId, input.activityId),
            eq(auditLogs.parentResourceId, input.activityId),
          ));
        } else {
          // The whole register's trail means ROPA actions, not every audit row the
          // organisation has ever written. `resource_type` is what the middleware
          // sets from the path, so this is the module's own history.
          filters.push(eq(auditLogs.resourceType, 'processing_activity'));
        }

        if (input.from) filters.push(gte(auditLogs.createdAt, input.from));
        if (input.to) filters.push(lte(auditLogs.createdAt, input.to));

        const rows = await ctx.db.select().from(auditLogs)
          .where(and(...filters))
          .orderBy(desc(auditLogs.createdAt))
          .limit(10000);

        const flattened = (rows as any[]).flatMap(flattenAuditRow);
        const headers = ['timestamp', 'user', 'action', 'description', 'field', 'old_value', 'new_value', 'ip_address', 'record_id', 'changed_in'];
        const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
        const csv = [
          headers.join(','),
          ...flattened.map((row) => headers.map((h) => cell(row[h] ?? '')).join(',')),
        ].join('\r\n');

        return {
          csv,
          rowCount: flattened.length,
          truncated: rows.length >= 10000,
          filename: `audit-trail-${input.activityId ? input.activityId.slice(0, 8) : 'register'}-${new Date().toISOString().slice(0, 10)}.csv`,
        };
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

      // K103. Backfills `completeness_score` for anything the stored column has not
      // caught up with, in the same pass that computes the scores anyway.
      //
      // Every activity that existed before 0047 has a stored score of 0 — the column
      // defaulted, and nothing recomputes it until the record is next edited. The
      // ring on the register would show the truth while the completeness *filter*
      // called every one of them "under 50%", which is a filter that quietly lies
      // about the register. Doing it here means it heals the first time anyone opens
      // the list, for every organisation, with no runbook step to forget.
      //
      // A write in a query path is a cache fill, and a self-limiting one: only rows
      // that actually differ are touched, so the second load writes nothing. It does
      // not touch `updated_at`, for the reasons refreshCompleteness does not either.
      const stale: { id: string; score: number }[] = [];
      for (const activity of activities as any[]) {
        const score = scoreActivity({
          activity,
          dataSubjects: bySubject.get(activity.id) ?? [],
          dataCategories: byCategory.get(activity.id) ?? [],
          recipients: byRecipient.get(activity.id) ?? [],
          transfers: byTransfer.get(activity.id) ?? [],
        }).score;
        empty[activity.id] = score;
        if ((activity.completenessScore ?? 0) !== score) stale.push({ id: activity.id, score });
      }

      for (const row of stale) {
        await ctx.db.update(processingActivities)
          .set({ completenessScore: row.score })
          .where(and(
            eq(processingActivities.id, row.id),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));
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
   * F55. The legitimate interest assessment.
   *
   * The table has existed since the beginning and nothing ever wrote a row —
   * `processing_activities.lia_id` sat empty beside every register entry claiming
   * Art. 6(1)(f), which is the one basis that cannot be asserted without
   * documented reasoning. This is that interface.
   *
   * One current assessment per activity. Redoing the balancing test supersedes
   * the previous one rather than editing it, because "we assessed this in March
   * and concluded X" is a statement somebody relied on, and rewriting it in June
   * destroys the only evidence that the reliance was reasonable at the time.
   */
  lia: router({
    get: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const [current] = await ctx.db.select().from(legitimateInterestAssessments)
          .where(and(
            eq(legitimateInterestAssessments.processingActivityId, input.processingActivityId),
            eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
            ne(legitimateInterestAssessments.status, 'superseded'),
          ))
          .orderBy(desc(legitimateInterestAssessments.createdAt))
          .limit(1);

        if (!current) return { assessment: null, evaluation: null, history: [] as any[] };

        const history = await ctx.db.select({
          id: legitimateInterestAssessments.id,
          version: legitimateInterestAssessments.version,
          status: legitimateInterestAssessments.status,
          outcome: legitimateInterestAssessments.outcome,
          completedAt: legitimateInterestAssessments.completedAt,
          createdAt: legitimateInterestAssessments.createdAt,
        }).from(legitimateInterestAssessments)
          .where(and(
            eq(legitimateInterestAssessments.processingActivityId, input.processingActivityId),
            eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
            eq(legitimateInterestAssessments.status, 'superseded'),
          ))
          .orderBy(desc(legitimateInterestAssessments.version));

        return { assessment: current, evaluation: evaluateLia(current), history };
      }),

    save: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        data: liaUpdateSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const values = {
          ...input.data,
          purposeTestLegitimateInterest: sanitize(input.data.purposeTestLegitimateInterest ?? undefined) ?? null,
          necessityTestIsNecessary: sanitize(input.data.necessityTestIsNecessary ?? undefined) ?? null,
          balancingTestImpact: sanitize(input.data.balancingTestImpact ?? undefined) ?? null,
          balancingTestOverrides: sanitize(input.data.balancingTestOverrides ?? undefined) ?? null,
          updatedAt: new Date(),
        };

        const [existing] = await ctx.db.select().from(legitimateInterestAssessments)
          .where(and(
            eq(legitimateInterestAssessments.processingActivityId, input.processingActivityId),
            eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
            ne(legitimateInterestAssessments.status, 'superseded'),
          ))
          .orderBy(desc(legitimateInterestAssessments.createdAt))
          .limit(1);

        let row: any;
        if (existing) {
          // A completed assessment that is edited drops back to draft, for the same
          // reason an approved activity does when its substance changes: the state
          // records that somebody signed off *this* text, and the text has moved.
          const reopened = existing.status === 'completed' ? { status: 'draft', completedAt: null } : {};
          [row] = await ctx.db.update(legitimateInterestAssessments)
            .set({ ...values, ...reopened })
            .where(and(
              eq(legitimateInterestAssessments.id, existing.id),
              eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
            ))
            .returning();
        } else {
          [row] = await ctx.db.insert(legitimateInterestAssessments).values({
            ...values,
            organizationId: ctx.user!.orgId,
            processingActivityId: input.processingActivityId,
            title: input.data.title ?? `Legitimate interest assessment — ${activity.name}`,
            status: 'draft',
            version: 1,
            createdBy: ctx.user!.id,
            assessedBy: ctx.user!.id,
          }).returning();

          // The waiting column, finally written. It is what lets the register show
          // the assessment beside the basis without a second query per row.
          await ctx.db.update(processingActivities)
            .set({ liaId: row.id })
            .where(and(
              eq(processingActivities.id, input.processingActivityId),
              eq(processingActivities.organizationId, ctx.user!.orgId),
            ));
        }

        await refreshCompleteness(ctx.db, input.processingActivityId);
        return { assessment: row, evaluation: evaluateLia(row) };
      }),

    /**
     * Mark the assessment done.
     *
     * Refused where anything blocking is unanswered, and the refusal names what.
     * A "completed" LIA with an empty balancing conclusion is the document a
     * supervisory authority asks for and finds wanting, and the product should
     * not be the thing that told the customer it was finished.
     */
    complete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        nextReviewAt: z.coerce.date().nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: legitimateInterestAssessments,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Assessment',
        });

        const evaluation = evaluateLia(existing);
        if (!evaluation.canComplete) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `The assessment is not complete: ${evaluation.blockers.map((b) => b.id).join(', ')}`,
          });
        }

        const now = new Date();
        const [row] = await ctx.db.update(legitimateInterestAssessments)
          .set({
            status: 'completed',
            completedAt: now,
            assessedAt: now,
            assessedBy: ctx.user!.id,
            lastReviewedAt: now,
            // A year unless told otherwise. An LIA whose facts have not been looked
            // at since it was written is an LIA that no longer says anything about
            // today's processing, and nothing else in the schema would ever ask.
            nextReviewAt: input.nextReviewAt ?? nextReviewFrom(now, 12),
            updatedAt: now,
          })
          .where(and(
            eq(legitimateInterestAssessments.id, input.id),
            eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
          ))
          .returning();

        await refreshCompleteness(ctx.db, existing.processingActivityId);
        return row;
      }),

    /** Start again: supersede the current assessment and open a fresh draft from it. */
    supersede: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: legitimateInterestAssessments,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Assessment',
        });

        await ctx.db.update(legitimateInterestAssessments)
          .set({ status: 'superseded', updatedAt: new Date() })
          .where(and(
            eq(legitimateInterestAssessments.id, input.id),
            eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
          ));

        // The new draft starts from the old text rather than from nothing. What is
        // being redone is a judgement about facts that have mostly not changed, and
        // retyping four paragraphs is how a review becomes an annual formality
        // nobody performs.
        const { id, createdAt, updatedAt, completedAt, ...carried } = existing as any;
        const [row] = await ctx.db.insert(legitimateInterestAssessments).values({
          ...carried,
          status: 'draft',
          version: (existing.version ?? 1) + 1,
          completedAt: null,
          outcomeRationale: input.reason ?? existing.outcomeRationale,
          createdBy: ctx.user!.id,
          assessedBy: ctx.user!.id,
          assessedAt: new Date(),
        }).returning();
        if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to open the new assessment' });

        await ctx.db.update(processingActivities)
          .set({ liaId: row.id })
          .where(and(
            eq(processingActivities.id, existing.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));

        await refreshCompleteness(ctx.db, existing.processingActivityId);
        return row;
      }),

    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: legitimateInterestAssessments,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Assessment',
        });

        // Only a draft. A completed assessment is evidence somebody relied on, and
        // the way to stop relying on it is to supersede it — which keeps it.
        if (existing.status === 'completed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A completed assessment cannot be deleted. Supersede it instead.',
          });
        }

        const [deleted] = await ctx.db.delete(legitimateInterestAssessments)
          .where(and(
            eq(legitimateInterestAssessments.id, input.id),
            eq(legitimateInterestAssessments.organizationId, ctx.user!.orgId),
          ))
          .returning();

        await ctx.db.update(processingActivities)
          .set({ liaId: null })
          .where(and(
            eq(processingActivities.id, existing.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
            eq(processingActivities.liaId, input.id),
          ));

        await refreshCompleteness(ctx.db, existing.processingActivityId);
        return deleted;
      }),
  }),

  /**
   * F56. The Art. 35(1) screening, with a recorded outcome either way.
   *
   * `requires_dpia` was a boolean flipped by the special-category checkbox and
   * nothing else. It could not say who decided, when, against which criteria, or
   * why — and the EDPB is explicit that the reasoning behind a "no DPIA required"
   * has to be documented. A screening supersedes rather than overwrites, so the
   * March answer survives the June one.
   */
  screening: router({
    /** The criteria themselves, plus the blacklist that applies to this org. */
    criteria: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .query(async ({ ctx }) => {
        checkOrgContext(ctx.user);
        const [org] = await ctx.db.select({ countryCode: organizations.countryCode })
          .from(organizations).where(eq(organizations.id, ctx.user!.orgId));
        const jurisdiction = org?.countryCode ?? null;
        return {
          statutory: ARTICLE_35_3_CRITERIA,
          wp248: WP248_CRITERIA,
          jurisdiction,
          blacklist: [
            ...NATIONAL_BLACKLISTS.EU!,
            ...(jurisdiction ? NATIONAL_BLACKLISTS[jurisdiction.toUpperCase()] ?? [] : []),
          ],
        };
      }),

    current: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ processingActivityId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const activity = await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const [current] = await ctx.db.select().from(dpiaScreenings)
          .where(and(
            eq(dpiaScreenings.processingActivityId, input.processingActivityId),
            eq(dpiaScreenings.organizationId, ctx.user!.orgId),
            ne(dpiaScreenings.status, 'superseded'),
          ))
          .orderBy(desc(dpiaScreenings.createdAt))
          .limit(1);

        const [org] = await ctx.db.select({ countryCode: organizations.countryCode })
          .from(organizations).where(eq(organizations.id, ctx.user!.orgId));

        // A screening that has never been started still needs an opening position,
        // and the register already answers half the questionnaire. Returning the
        // prefill rather than an empty form is the difference between a screening
        // people complete and one they abandon.
        if (!current) {
          const categories = await ctx.db.select({ isCriminalData: processingDataCategories.isCriminalData })
            .from(processingDataCategories)
            .where(eq(processingDataCategories.processingActivityId, input.processingActivityId));
          const answers = prefillScreening(activity, {
            hasCriminalData: (categories as any[]).some((c) => c.isCriminalData),
          });
          return {
            screening: null,
            prefill: answers,
            result: screenForDpia(answers, { jurisdiction: org?.countryCode }),
            history: [] as any[],
          };
        }

        const history = await ctx.db.select({
          id: dpiaScreenings.id,
          verdict: dpiaScreenings.verdict,
          decision: dpiaScreenings.decision,
          rationale: dpiaScreenings.rationale,
          screenedAt: dpiaScreenings.screenedAt,
          createdAt: dpiaScreenings.createdAt,
        }).from(dpiaScreenings)
          .where(and(
            eq(dpiaScreenings.processingActivityId, input.processingActivityId),
            eq(dpiaScreenings.organizationId, ctx.user!.orgId),
            eq(dpiaScreenings.status, 'superseded'),
          ))
          .orderBy(desc(dpiaScreenings.createdAt));

        return {
          screening: current,
          prefill: null,
          result: screenForDpia((current.answers ?? {}) as Record<string, boolean>, {
            jurisdiction: current.jurisdiction ?? org?.countryCode,
            blacklistSelections: (current.blacklistMatches ?? []) as string[],
          }),
          history,
        };
      }),

    save: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        processingActivityId: z.string().uuid(),
        answers: z.record(z.enum(SCREENING_CRITERIA), z.boolean()),
        blacklistSelections: z.array(z.string().max(80)).max(40).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, processingActivities, input.processingActivityId, ctx.user!.orgId, 'Activity');

        const [org] = await ctx.db.select({ countryCode: organizations.countryCode })
          .from(organizations).where(eq(organizations.id, ctx.user!.orgId));
        const jurisdiction = org?.countryCode ?? null;

        const result = screenForDpia(input.answers as Record<string, boolean>, {
          jurisdiction,
          blacklistSelections: input.blacklistSelections,
        });

        const [existing] = await ctx.db.select().from(dpiaScreenings)
          .where(and(
            eq(dpiaScreenings.processingActivityId, input.processingActivityId),
            eq(dpiaScreenings.organizationId, ctx.user!.orgId),
            eq(dpiaScreenings.status, 'open'),
          ))
          .orderBy(desc(dpiaScreenings.createdAt))
          .limit(1);

        const values = {
          answers: input.answers as any,
          criteriaMet: result.criteriaMet as any,
          blacklistMatches: result.blacklistMatches as any,
          verdict: result.verdict,
          jurisdiction,
          updatedAt: new Date(),
        };

        let row: any;
        if (existing) {
          [row] = await ctx.db.update(dpiaScreenings)
            .set(values)
            .where(and(
              eq(dpiaScreenings.id, existing.id),
              eq(dpiaScreenings.organizationId, ctx.user!.orgId),
            ))
            .returning();
        } else {
          [row] = await ctx.db.insert(dpiaScreenings).values({
            ...values,
            organizationId: ctx.user!.orgId,
            processingActivityId: input.processingActivityId,
            status: 'open',
            createdBy: ctx.user!.id,
          }).returning();
        }

        return { screening: row, result };
      }),

    /**
     * Record the decision — including, and especially, a decision not to do one.
     *
     * `rationale` is mandatory. That is the entire finding F56 names: a register
     * full of activities marked "DPIA not required" with no reasoning is a
     * register that cannot demonstrate the Art. 35(1) judgement was ever made,
     * and the boolean it used to write could not carry one.
     */
    decide: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        decision: z.enum(['required', 'recommended', 'not_required']),
        rationale: z.string().trim().min(20).max(4000),
        nextReviewAt: z.coerce.date().nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: dpiaScreenings,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Screening',
        });

        const now = new Date();
        const [row] = await ctx.db.update(dpiaScreenings)
          .set({
            decision: input.decision,
            rationale: sanitize(input.rationale),
            status: 'decided',
            screenedBy: ctx.user!.id,
            screenedAt: now,
            // A screening is only true of the processing it screened. Re-screening
            // annually is what stops "not required, decided in 2024" being cited
            // about a system that has since gained a scoring model.
            nextReviewAt: input.nextReviewAt ?? nextReviewFrom(now, 12),
            updatedAt: now,
          })
          .where(and(
            eq(dpiaScreenings.id, input.id),
            eq(dpiaScreenings.organizationId, ctx.user!.orgId),
          ))
          .returning();

        // The register's own flag follows the decision rather than the checkbox
        // that used to set it. 'recommended' counts as required for the flag: the
        // register shows one boolean, and the safer reading of "may need one" is
        // the one that keeps it visible in the DPIA filter.
        await ctx.db.update(processingActivities)
          .set({ requiresDpia: input.decision !== 'not_required' })
          .where(and(
            eq(processingActivities.id, existing.processingActivityId),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));

        await refreshCompleteness(ctx.db, existing.processingActivityId);
        return row;
      }),

    /** Re-screen: close the current one and open a fresh questionnaire from it. */
    rescreen: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: dpiaScreenings,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Screening',
        });

        const [row] = await ctx.db.insert(dpiaScreenings).values({
          organizationId: ctx.user!.orgId,
          processingActivityId: existing.processingActivityId,
          answers: existing.answers as any,
          criteriaMet: existing.criteriaMet as any,
          blacklistMatches: existing.blacklistMatches as any,
          verdict: existing.verdict,
          jurisdiction: existing.jurisdiction,
          status: 'open',
          createdBy: ctx.user!.id,
        }).returning();
        if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to open the new screening' });

        await ctx.db.update(dpiaScreenings)
          .set({ status: 'superseded', supersededById: row.id, updatedAt: new Date() })
          .where(and(
            eq(dpiaScreenings.id, input.id),
            eq(dpiaScreenings.organizationId, ctx.user!.orgId),
          ));

        return row;
      }),
  }),

  /**
   * J93–J98. Every regulator-facing output the register produces, from one dataset.
   *
   * The module used to produce three different Article 30 documents and none of
   * them was complete: `export.generatePdf` rendered nine fields per activity, the
   * audit pack rendered eight, and the register's CSV button exported whatever the
   * browser happened to have loaded — twenty-five rows of an eight-column table,
   * labelled in the UI as an export of the register. Everything Sprints 1 and 2
   * added was absent from all three.
   *
   * These procedures are all thin: `buildArticle30Record` does the reading and
   * `ropaExportFormats` does the rendering, so the PDF, the workbook, the CSV, the
   * JSON and the four regulator packs cannot disagree about what the register says.
   *
   * Every one of them takes the register filter schema, which makes J96 fall out
   * of J94 rather than being a second implementation: "export the activities I am
   * looking at" is the same query as "export everything", with a `where`.
   */
  export: router({
    /** J93. The canonical Article 30 record, as a PDF. */
    article30Pdf: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(registerFilterSchema.partial().default({}))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const filters = registerFilterSchema.parse(input ?? {});
        const record = await buildArticle30Record(ctx.db, ctx.user!.orgId, {
          where: buildRegisterFilters(filters, ctx.user!.id),
          filterSummary: summariseFilters(filters),
        });

        const pdf = await renderPdf('ropa-register', serialiseArticle30(record));
        return {
          pdfData: pdf.toString('base64'),
          filename: `article-30-record-${new Date().toISOString().slice(0, 10)}.pdf`,
          counts: record.counts,
        };
      }),

    /** J95. One sheet per object, which is what an auditor asks for. */
    xlsx: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(registerFilterSchema.partial().default({}))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const filters = registerFilterSchema.parse(input ?? {});
        const record = await buildArticle30Record(ctx.db, ctx.user!.orgId, {
          where: buildRegisterFilters(filters, ctx.user!.id),
          filterSummary: summariseFilters(filters),
        });

        return {
          data: article30Xlsx(record).toString('base64'),
          filename: `article-30-register-${new Date().toISOString().slice(0, 10)}.xlsx`,
          counts: record.counts,
        };
      }),

    /** J94. The whole register as CSV, from the database rather than the browser. */
    csv: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(registerFilterSchema.partial().default({}))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const filters = registerFilterSchema.parse(input ?? {});
        const record = await buildArticle30Record(ctx.db, ctx.user!.orgId, {
          where: buildRegisterFilters(filters, ctx.user!.id),
          filterSummary: summariseFilters(filters),
        });

        return {
          csv: article30Csv(record),
          filename: `article-30-register-${new Date().toISOString().slice(0, 10)}.csv`,
          counts: record.counts,
        };
      }),

    /** J98. Keyed by Article, so a receiving system needs no knowledge of our schema. */
    json: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(registerFilterSchema.partial().default({}))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const filters = registerFilterSchema.parse(input ?? {});
        const record = await buildArticle30Record(ctx.db, ctx.user!.orgId, {
          where: buildRegisterFilters(filters, ctx.user!.id),
          filterSummary: summariseFilters(filters),
        });

        return {
          json: JSON.stringify(article30Json(record), null, 2),
          filename: `article-30-register-${new Date().toISOString().slice(0, 10)}.json`,
          counts: record.counts,
        };
      }),

    /** The packs on offer, for the export menu. */
    templates: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .query(() =>
        Object.values(REGULATOR_TEMPLATES).map((t) => ({
          id: t.id,
          title: t.title,
          authority: t.authority,
          language: t.language,
        })),
      ),

    /**
     * J97. The supervisory authority's own template, in its own language.
     *
     * A CNIL register submitted with English column headings is a document the
     * *contrôleur* has to translate before reading. The columns are data rather
     * than code (see `REGULATOR_TEMPLATES`), so adding the Garante's template is a
     * table entry and every pack keeps reading the same dataset.
     */
    regulator: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({
        template: z.enum(['cnil', 'ico', 'dsk', 'aepd']),
        filters: registerFilterSchema.partial().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkOrgContext(ctx.user);

        const filters = registerFilterSchema.parse(input.filters ?? {});
        const record = await buildArticle30Record(ctx.db, ctx.user!.orgId, {
          where: buildRegisterFilters(filters, ctx.user!.id),
          filterSummary: summariseFilters(filters),
        });

        const template = REGULATOR_TEMPLATES[input.template]!;
        return {
          data: regulatorXlsx(record, input.template).toString('base64'),
          filename: `${input.template}-${new Date().toISOString().slice(0, 10)}.xlsx`,
          title: template.title,
          authority: template.authority,
          counts: record.counts,
        };
      }),
  }),

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
          await refreshCompleteness(ctx.db, input.processingActivityId);

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
        await refreshCompleteness(ctx.db, updated.processingActivityId);
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
        await refreshCompleteness(ctx.db, existing.processingActivityId);

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
        await refreshCompleteness(ctx.db, input.processingActivityId);
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

        if (updated) await refreshCompleteness(ctx.db, updated.processingActivityId);
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

        await refreshCompleteness(ctx.db, existing.processingActivityId);
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

        await refreshCompleteness(ctx.db, input.processingActivityId);
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
        if (updated) await refreshCompleteness(ctx.db, updated.processingActivityId);
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

        if (deleted) await refreshCompleteness(ctx.db, deleted.processingActivityId);
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
        await refreshCompleteness(ctx.db, input.processingActivityId);
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
        if (updated) await refreshCompleteness(ctx.db, updated.processingActivityId);
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
        if (deleted) await refreshCompleteness(ctx.db, deleted.processingActivityId);
        return deleted;
      }),
    /**
     * F58. A transfer impact assessment, per transfer, org-scoped.
     *
     * `tia.ts` files an assessment against a *vendor*, which is the wrong unit
     * twice over. A vendor is a shared catalogue row, so vendor-keyed writes were
     * how D3 let one organisation's completed TIA flip every other tenant's
     * transfer to "TIA: Completed" — fixed in Sprint 0 by scoping the propagation,
     * but the assessment itself is still one per vendor. An organisation sending
     * HR data to a processor under 2021 SCCs and marketing data to the same
     * processor under a derogation has two transfers with two different risk
     * pictures and one assessment covering both.
     *
     * Here the assessment hangs off the transfer, which hangs off the activity,
     * which carries the organisation — so tenancy is proved through the chain by
     * `assertOwned` and there is no vendor-keyed write anywhere in this router.
     */
    tia: router({
      get: protectedProcedure
        .use(requirePermission('ropa', 'view'))
        .input(z.object({ transferId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
          const transfer = await assertOwned(ctx.db, {
            table: processingTransfers,
            id: input.transferId,
            orgId: ctx.user!.orgId,
            label: 'Transfer',
            via: [{ table: processingActivities, on: eq(processingTransfers.processingActivityId, processingActivities.id) }],
          });

          const [tia] = await ctx.db.select().from(transferImpactAssessments)
            .where(and(
              eq(transferImpactAssessments.processingTransferId, input.transferId),
              eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
            ))
            .orderBy(desc(transferImpactAssessments.createdAt))
            .limit(1);

          const isAdequate = isAdequateDestination(transfer.destinationCountry);
          return {
            transfer,
            assessment: tia ?? null,
            evaluation: tia ? evaluateTia(tia, { isAdequate }) : null,
            isAdequate,
            measures: {
              technical: TIA_TECHNICAL_MEASURES,
              organisational: TIA_ORGANISATIONAL_MEASURES,
              contractual: TIA_CONTRACTUAL_MEASURES,
              effectiveAlone: TIA_EFFECTIVE_ALONE_MEASURES,
            },
          };
        }),

      save: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({
          transferId: z.string().uuid(),
          data: tiaUpdateSchema,
        }))
        .mutation(async ({ ctx, input }) => {
          const transfer = await assertOwned(ctx.db, {
            table: processingTransfers,
            id: input.transferId,
            orgId: ctx.user!.orgId,
            label: 'Transfer',
            via: [{ table: processingActivities, on: eq(processingTransfers.processingActivityId, processingActivities.id) }],
          });

          const [existing] = await ctx.db.select().from(transferImpactAssessments)
            .where(and(
              eq(transferImpactAssessments.processingTransferId, input.transferId),
              eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
            ))
            .orderBy(desc(transferImpactAssessments.createdAt))
            .limit(1);

          const values: any = {
            ...input.data,
            surveillanceLawsDetail: sanitize(input.data.surveillanceLawsDetail ?? undefined) ?? null,
            residualRiskJustification: sanitize(input.data.residualRiskJustification ?? undefined) ?? null,
            updatedAt: new Date(),
          };

          let row: any;
          if (existing) {
            // Editing a completed assessment reopens it, for the reason the LIA
            // does: 'completed' records that somebody signed off this text.
            if (existing.status === 'completed') {
              values.status = 'draft';
              values.approvedBy = null;
              values.approvedAt = null;
            }
            [row] = await ctx.db.update(transferImpactAssessments)
              .set(values)
              .where(and(
                eq(transferImpactAssessments.id, existing.id),
                eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
              ))
              .returning();
          } else {
            [row] = await ctx.db.insert(transferImpactAssessments).values({
              ...values,
              organizationId: ctx.user!.orgId,
              processingTransferId: input.transferId,
              processingActivityId: transfer.processingActivityId,
              vendorId: transfer.vendorId ?? null,
              // The transfer already knows these two and disagreeing with it is
              // not a state the register should be able to reach.
              destinationCountry: transfer.destinationCountry,
              transferMechanism: transfer.transferMechanism,
              status: 'draft',
              createdBy: ctx.user!.id,
              assessedBy: ctx.user!.id,
            }).returning();
          }

          return {
            assessment: row,
            evaluation: evaluateTia(row, { isAdequate: isAdequateDestination(transfer.destinationCountry) }),
          };
        }),

      /**
       * Complete the assessment and act on its conclusion.
       *
       * The conclusion is the point: 'suspend' has to *do* something, or a TIA is
       * a document that concluded a transfer was unlawful and left it running.
       * The propagation is scoped by transfer id — whose parent activity has
       * already been proved to belong to this organisation — rather than by
       * vendor id, which is what D3 was.
       */
      complete: protectedProcedure
        .use(requirePermission('ropa', 'edit'))
        .input(z.object({
          id: z.string().uuid(),
          suspensionReason: z.string().max(2000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const existing = await assertOwned(ctx.db, {
            table: transferImpactAssessments,
            id: input.id,
            orgId: ctx.user!.orgId,
            label: 'Assessment',
          });

          if (!existing.processingTransferId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'This assessment is not linked to a transfer.',
            });
          }

          const isAdequate = isAdequateDestination(existing.destinationCountry);
          const evaluation = evaluateTia(existing, { isAdequate });
          if (!evaluation.canComplete) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: evaluation.contradictions.length > 0
                ? `The assessment contradicts itself: ${evaluation.contradictions.join(', ')}`
                : `The assessment is not complete: ${evaluation.steps.filter((s) => s.status !== 'met').map((s) => s.id).join(', ')}`,
            });
          }

          const suspending = existing.conclusion === 'suspend';
          if (suspending && !input.suspensionReason?.trim()) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'A suspension has to say why. It stops a transfer that is running.',
            });
          }

          const now = new Date();
          const [row] = await ctx.db.update(transferImpactAssessments)
            .set({
              status: 'completed',
              approvedBy: ctx.user!.id,
              approvedAt: now,
              lastReviewedAt: now,
              nextReviewAt: nextReviewFrom(now, existing.reevaluationIntervalMonths || 12),
              suspendedAt: suspending ? now : null,
              suspendedBy: suspending ? ctx.user!.id : null,
              suspensionReason: suspending ? sanitize(input.suspensionReason) : null,
              updatedAt: now,
            })
            .where(and(
              eq(transferImpactAssessments.id, input.id),
              eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
            ))
            .returning();

          // Scoped to the one transfer this assessment is about. Nothing here
          // reaches another organisation's rows even if the vendor is shared,
          // because the id was proved through the activity above.
          await ctx.db.update(processingTransfers)
            .set({
              tiaCompleted: true,
              tiaRiskLevel: suspending ? 'critical' : existing.residualRiskLevel,
              updatedAt: now,
            })
            .where(eq(processingTransfers.id, existing.processingTransferId));

          if (existing.processingActivityId) {
            await refreshCompleteness(ctx.db, existing.processingActivityId);

            if (suspending) {
              const [activity] = await ctx.db.select().from(processingActivities)
                .where(and(
                  eq(processingActivities.id, existing.processingActivityId),
                  eq(processingActivities.organizationId, ctx.user!.orgId),
                ));
              if (activity) {
                await queueNotification({
                  organizationId: ctx.user!.orgId,
                  type: 'compliance.gap_detected' as any,
                  title: 'Transfer suspended',
                  body: `The transfer impact assessment for "${activity.name}" concluded that the transfer to ${existing.destinationCountry} must be suspended.`,
                  actionUrl: `/ropa/${existing.processingActivityId}?tab=transfers`,
                });
              }
            }
          }

          return row;
        }),

      /** Every transfer in the register with its assessment state — the TIA queue. */
      queue: protectedProcedure
        .use(requirePermission('ropa', 'view'))
        .query(async ({ ctx }) => {
          checkOrgContext(ctx.user);

          const rows = await ctx.db.select({
            transferId: processingTransfers.id,
            activityId: processingActivities.id,
            activityName: processingActivities.name,
            destinationCountry: processingTransfers.destinationCountry,
            transferMechanism: processingTransfers.transferMechanism,
            tiaCompleted: processingTransfers.tiaCompleted,
            tiaRiskLevel: processingTransfers.tiaRiskLevel,
            assessmentId: transferImpactAssessments.id,
            assessmentStatus: transferImpactAssessments.status,
            conclusion: transferImpactAssessments.conclusion,
            nextReviewAt: transferImpactAssessments.nextReviewAt,
          })
            .from(processingTransfers)
            .innerJoin(processingActivities, eq(processingTransfers.processingActivityId, processingActivities.id))
            .leftJoin(transferImpactAssessments, eq(transferImpactAssessments.processingTransferId, processingTransfers.id))
            .where(and(
              eq(processingActivities.organizationId, ctx.user!.orgId),
              isNull(processingActivities.deletedAt),
            ))
            .orderBy(desc(processingTransfers.createdAt));

          return (rows as any[]).map((row) => ({
            ...row,
            // An adequate destination needs no TIA at all, and listing one as
            // "assessment missing" is how a queue trains people to ignore it.
            isAdequate: isAdequateDestination(row.destinationCountry),
          }));
        }),
    }),
  }),
});
