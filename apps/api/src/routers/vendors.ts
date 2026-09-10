import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { vendorJobsQueue } from '../workers/vendors.js';
import { db } from '../db.js';
import { vendors, organizationVendors, users, vendorSubProcessors, vendorSubProcessorChanges, vendorIncidents, organizationVendorIncidentAlerts, vendorQuestionnaires, vendorDiscoveries, organizations, vendorAssessments, complianceGaps, transferImpactAssessments } from 'db';
import { eq, and, isNull, inArray, or, sql, desc, asc, gte, lte, ilike, lt, gt, ne, count, notInArray } from 'drizzle-orm';
import { router, publicProcedure, protectedProcedure, requirePermission } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { isAdequateDestination } from '../constants/transferDestinations.js';

import { calculateVendorRisk, NEW_LINK_RISK_INPUTS, questionnaireScoreModifier, mergeSubProcessorRows } from '../lib/vendorRisk.js';
import { enforceLimit } from '../lib/billing.js';
import { DPA_STATUS_SIGNED, DPA_STATUS_MISSING, DPA_STATUSES } from '../constants/dpaStatus.js';
import {
  VENDOR_STATUSES,
  VENDOR_STATUSES_LIVE,
  VENDOR_STATUS_ACTIVE,
  VENDOR_STATUS_OFFBOARDED,
  VENDOR_PROCESSING_ROLES,
  VENDOR_CRITICALITIES,
} from '../constants/vendorLifecycle.js';
import {
  normaliseDataCategoryList,
  MAX_DATA_CATEGORIES,
  MAX_DATA_CATEGORY_LENGTH,
} from '../constants/vendorDataCategories.js';
import { csvDocument } from '../utils/csv.js';
import { TRANSFER_MECHANISMS } from '../constants/transferMechanisms.js';
import {
  parseCsvRows,
  buildColumnMapping,
  normaliseVendorRow,
  buildCatalogueIndex,
  matchCatalogue,
  AUTO_LINK_THRESHOLD,
  type CatalogueEntry,
  normaliseCountry,
} from '../lib/vendorImport.js';
import { auditLogs, vendorSubProcessorEntities, vendorFieldProvenance, vendorSubProcessorAcknowledgements } from 'db';
import {
  describeChanges,
  changeTypeOf,
} from '../lib/auditTrail.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import {
  buildArticle30RecipientCsv,
  buildArticle28DossierMarkdown,
  type Article30RecipientRow,
  type Article28DossierData,
} from '../lib/vendorAuditPack.js';
import { generateStandardArticle28Dpa } from '../lib/vendorDpaTemplate.js';
import { calculateNextReviewDate, evaluateReviewStatus } from '../lib/vendorGovernance.js';
import { hasSpecialCategory } from '../constants/vendorDataCategories.js';
import { assertOwned } from '../lib/tenancy.js';
import { ARTICLE_28_DEFINITIONS, type Article28ClauseKey } from '../lib/vendorDpaClauseAnalyzer.js';
import { calculateConcentrationAnalytics } from '../lib/vendorConcentration.js';
import { parseTrustCenterProfile } from '../lib/vendorTrustCenter.js';
import { crossCheckVendorResponses, calculateDiscrepancyRiskPenalty, discrepancyPenaltyFor } from '../lib/vendorCrossCheck.js';
import { safeFetch, BlockedRequestError } from '../lib/safeFetch.js';
import { getVendorBenchmarkStats } from '../lib/vendorBenchmarking.js';
import { matchRegulatoryDecisions } from '../lib/vendorEnforcementFeed.js';
import { matchDpfStatus, dpfLookupName, type DpfMatchStatus } from '../lib/vendorDpf.js';
import { provenanceAge, selectAuthoritativeProvenance } from '../lib/vendorProvenance.js';
import {
  submitFieldCorrection as submitCorrection,
  applyCorrectionToColumn,
  CorrectionError,
} from '../lib/vendorCorrections.js';

/**
 * Run an extracted correction function and map its error to a tRPC one.
 *
 * The logic lives in `lib/vendorCorrections.ts` so the local operator console
 * calls the same code path. tRPC status codes are a transport concern and stay
 * here rather than travelling into a module a plain script also imports.
 */
async function runCorrection<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CorrectionError) {
      throw new TRPCError({
        code: err.kind === 'not_found' ? 'NOT_FOUND' : 'BAD_REQUEST',
        message: err.message,
      });
    }
    throw err;
  }
}
import { loadDpfEntriesFor } from '../lib/vendorDpfLookup.js';
import { htmlToText } from '../lib/htmlText.js';
export { calculateVendorRisk, NEW_LINK_RISK_INPUTS };

/**
 * What hangs off one `organization_vendors` row.
 *
 * Four of these tables declare `ON DELETE CASCADE` and `transfer_impact_
 * assessments` declares nothing, so deleting the join row either destroys the
 * lot without a word or fails with a foreign-key violation. Counting first is
 * what lets `unlinkVendor` refuse, and what lets the confirmation dialog name
 * the records rather than warn in the abstract.
 */
/**
 * "Relationships this organisation is still in."
 *
 * The predicate every count, score, chaser and export should carry. A NULL
 * status is a row written before the column meant anything, and it is live —
 * treating unknown as offboarded would empty an existing register at the moment
 * this shipped.
 */
export function liveVendorPredicate() {
  return or(
    inArray(organizationVendors.status, [...VENDOR_STATUSES_LIVE]),
    isNull(organizationVendors.status),
  )!;
}

/**
 * The audit rows belonging to one vendor relationship, for this organisation.
 *
 * Shared by the timeline and its CSV export so the two cannot drift — a file
 * that disagrees with the screen it was exported from is worse than no file.
 */
function vendorTrailFilter(orgId: string, orgVendorId: string, vendorId: string) {
  return and(
    eq(auditLogs.organizationId, orgId),
    or(
      eq(auditLogs.resourceId, orgVendorId),
      eq(auditLogs.resourceId, vendorId),
    ),
    or(
      ilike(auditLogs.action, 'vendors.%'),
      ilike(auditLogs.action, 'tia.%'),
      ilike(auditLogs.action, 'assessments.%'),
    ),
  );
}

async function vendorEvidenceCounts(dbInstance: any, orgVendorId: string) {
  const one = async (table: any, column: any) => {
    const [row] = await dbInstance.select({ n: count() }).from(table).where(eq(column, orgVendorId));
    return Number(row?.n ?? 0);
  };
  const [assessments, questionnaires, subProcessorChanges, incidentAlerts, tias] = await Promise.all([
    one(vendorAssessments, vendorAssessments.vendorId),
    one(vendorQuestionnaires, vendorQuestionnaires.orgVendorId),
    one(vendorSubProcessorChanges, vendorSubProcessorChanges.orgVendorId),
    one(organizationVendorIncidentAlerts, organizationVendorIncidentAlerts.orgVendorId),
    one(transferImpactAssessments, transferImpactAssessments.orgVendorId),
  ]);
  return { assessments, questionnaires, subProcessorChanges, incidentAlerts, tias };
}

/**
 * DPF status for a US vendor — VD-7, VD-8.
 *
 * This used to inline its own fold: `LOWER(organisation_name) = LOWER(name)` OR
 * a hand-written `[^a-z0-9]` strip, with no NFD normalisation and no domain
 * check at all. `matchDpfStatus` is the matcher with fixtures behind it, and it
 * was being bypassed by both of the call sites that actually ask the question —
 * so a registrant published as "Société Générale" never matched, and no vendor
 * was ever matched by its domain. It also read `dpf.recertificationDueDate`, a
 * column that does not exist on the table; `dbInstance` is `any`, so `tsc` had
 * nothing to disagree with and `dpfLapsedDate` has always been undefined. The
 * risk factor that renders "DPF certification lapsed on {date}" has therefore
 * never printed a date.
 */
export async function resolveDpfStatus(dbInstance: any, vendor: any): Promise<{ dpfStatus?: DpfMatchStatus; dpfLapsedDate?: string }> {
  if (vendor.headquartersCountry !== 'US') return {};

  // VD-15: the registry certifies the legal entity, not the product.
  const lookupName = dpfLookupName(vendor);
  const entries = await loadDpfEntriesFor(dbInstance, [{ name: lookupName, website: vendor.website }]);
  const { status, entry } = matchDpfStatus(lookupName, vendor.website, entries);
  if (status === 'not_found' || !entry) return {};

  // The registry publishes the date the certification stopped being current, so
  // that is the date a reviewer is shown — not the recertification deadline it
  // missed, which is a different day and is null on every inactive row anyway.
  const lapsedOn = entry.inactiveStartDate;
  return {
    dpfStatus: status,
    dpfLapsedDate: status !== 'active' && lapsedOn
      ? new Date(lapsedOn).toISOString().slice(0, 10)
      : undefined,
  };
}

export async function updateVendorRiskScore(dbInstance: any, orgId: string, vendorId: string) {
  const [vendor] = await dbInstance.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) return;

  const [orgVendor] = await dbInstance.select().from(organizationVendors).where(and(
    eq(organizationVendors.organizationId, orgId),
    eq(organizationVendors.vendorId, vendorId)
  ));
  if (!orgVendor) return;

  const subs = await dbInstance.select()
    .from(vendorSubProcessors)
    .where(eq(vendorSubProcessors.parentVendorId, vendorId));
  const subProcessorsCount = subs.length;

  // Retrieve score modifier from completed/expired vendor assessments
  const assessments = await dbInstance.select()
    .from(vendorAssessments)
    .where(and(
      eq(vendorAssessments.organizationId, orgId),
      eq(vendorAssessments.vendorId, orgVendor.id)
    ))
    .orderBy(desc(vendorAssessments.completedAt), desc(vendorAssessments.expiresAt));

  const scoreModifier = questionnaireScoreModifier(assessments[0]);

  // Retrieve DPIA compliance gaps for this vendor, alongside the DPF lookup —
  // the register read and the certification read do not depend on each other.
  const [dpiaGaps, { dpfStatus, dpfLapsedDate }] = await Promise.all([
    dbInstance.select().from(complianceGaps).where(and(
      eq(complianceGaps.organizationId, orgId),
      eq(complianceGaps.entityType, 'vendor'),
      eq(complianceGaps.entityId, orgVendor.id),
      eq(complianceGaps.source, 'dpia')
    )),
    resolveDpfStatus(dbInstance, vendor),
  ]);

  const enrichedVendor = {
    ...vendor,
    ...(dpfStatus ? { dpfStatus, dpfLapsedDate } : {}),
  };

  const entitySubs = await dbInstance.select().from(vendorSubProcessorEntities)
    .where(eq(vendorSubProcessorEntities.parentVendorId, vendorId));
  const discrepancyPenalty = discrepancyPenaltyFor({
    vendor,
    orgVendor,
    latestAssessment: assessments[0],
    subProcessors: mergeSubProcessorRows(subs, entitySubs),
    dpfStatus,
  });

  const { score, level, factors } = calculateVendorRisk(enrichedVendor, orgVendor, {
    subProcessorsCount,
    scoreModifier,
    dpiaGaps,
    discrepancyPenalty,
  });

  await dbInstance.update(organizationVendors)
    .set({
      riskScore: score,
      riskLevel: level,
      riskFactors: factors,
      lastRiskAssessment: new Date()
    })
    .where(eq(organizationVendors.id, orgVendor.id));

  if (orgEmbeddingsQueue) {
    await orgEmbeddingsQueue.add('embed-vendor', {
      orgId: orgId,
      entityType: 'vendor',
      entityId: orgVendor.id,
      action: 'upsert'
    });
  }
}

/**
 * `dryRun` computes every score and writes nothing — it exists so a formula
 * change can be seen before it lands. The score is denormalised, so applying
 * one is a bulk rewrite of a column customers see, and "how far does this move
 * things" has until now been answerable only by doing it. It also skips the
 * embedding enqueue, because a dry run that fills a queue is not one.
 */
export async function recalculateVendorRiskForAllOrgs(
  dbInstance: any,
  vendorId: string,
  options: { dryRun?: boolean } = {},
): Promise<Array<{ id: string; score: number; level: string; factors: any }>> {
  const dryRun = options.dryRun === true;
  const [vendor] = await dbInstance.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) return [];

  const { dpfStatus, dpfLapsedDate } = await resolveDpfStatus(dbInstance, vendor);

  const enrichedVendor = {
    ...vendor,
    ...(dpfStatus ? { dpfStatus, dpfLapsedDate } : {}),
  };

  // The linked tenants and both sub-processor tables are read together. The
  // entity rows are fetched once for the whole catalogue row rather than per
  // organisation: the sub-processor list belongs to the vendor, and the
  // cross-check needs it for every tenant linked to it.
  const [orgVendors, subs, entitySubs] = await Promise.all([
    dbInstance.select().from(organizationVendors).where(eq(organizationVendors.vendorId, vendorId)),
    dbInstance.select()
      .from(vendorSubProcessors)
      .where(eq(vendorSubProcessors.parentVendorId, vendorId)),
    dbInstance.select().from(vendorSubProcessorEntities)
      .where(eq(vendorSubProcessorEntities.parentVendorId, vendorId)),
  ]);
  const subProcessorsCount = subs.length;
  const mergedSubs = mergeSubProcessorRows(subs, entitySubs);

  // Retrieve DPIA compliance gaps for all matched organization vendors at once to avoid N+1 queries
  const orgIds: string[] = Array.from(new Set(orgVendors.map((ov: any) => ov.organizationId as string)));
  let allDpiaGaps: any[] = [];
  if (orgIds.length > 0) {
    allDpiaGaps = await dbInstance.select().from(complianceGaps).where(and(
      inArray(complianceGaps.organizationId, orgIds),
      eq(complianceGaps.entityType, 'vendor'),
      eq(complianceGaps.source, 'dpia')
    ));
  }

  let allAssessments: any[] = [];
  if (orgIds.length > 0) {
    // vendorAssessments.vendorId FKs organizationVendors.id, not vendors.id --
    // matching it against the global id found no rows and silently dropped the
    // questionnaire modifier from every recalculated score.
    allAssessments = await dbInstance.select()
      .from(vendorAssessments)
      .where(and(
        inArray(vendorAssessments.organizationId, orgIds),
        inArray(vendorAssessments.vendorId, orgVendors.map((ov: any) => ov.id))
      ))
      .orderBy(desc(vendorAssessments.completedAt), desc(vendorAssessments.expiresAt));
  }

  const updates: Array<{ id: string; score: number; level: string; factors: any }> = [];

  for (const orgVendor of orgVendors) {
    const assessments = allAssessments.filter((a: any) => a.organizationId === orgVendor.organizationId && a.vendorId === orgVendor.id);

    // Same helper as updateVendorRiskScore, so the two paths cannot disagree about
    // whether a questionnaire has been seen by a human.
    const scoreModifier = questionnaireScoreModifier(assessments[0]);

    const vendorGaps = allDpiaGaps.filter((gap: any) =>
      gap.organizationId === orgVendor.organizationId &&
      gap.entityId === orgVendor.id
    );

    // This path used to omit the discrepancy penalty entirely, so the documented
    // post-deploy recalculation forgave every contradiction the cross-check had
    // found. It is now the same derivation as the per-row path.
    const discrepancyPenalty = discrepancyPenaltyFor({
      vendor,
      orgVendor,
      latestAssessment: assessments[0],
      subProcessors: mergedSubs,
      dpfStatus,
    });

    const { score, level, factors } = calculateVendorRisk(enrichedVendor, orgVendor, {
      subProcessorsCount,
      scoreModifier,
      dpiaGaps: vendorGaps,
      discrepancyPenalty,
    });

    updates.push({ id: orgVendor.id, score, level, factors });

    if (orgEmbeddingsQueue && !dryRun) {
      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: orgVendor.organizationId,
        entityType: 'vendor',
        entityId: orgVendor.id,
        action: 'upsert'
      });
    }
  }

  if (updates.length > 0 && !dryRun) {
    // Every branch of these CASE expressions is a bound parameter, so Postgres has
    // nothing to infer a type from and resolves the whole expression as `text` --
    // which it then refuses to assign to an integer column:
    //   column "risk_score" is of type integer but expression is of type text
    // The casts are what make this run at all. It threw on every invocation that
    // had a row to write, which is every sub-processor add/remove and every
    // catalogue-driven recalculation, and `tsc` sees a perfectly good SQL template.
    await dbInstance.update(organizationVendors)
      .set({
        riskScore: sql`
          (CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${u.score}`), sql` `)}
          END)::integer
        `,
        riskLevel: sql`
          (CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${u.level}`), sql` `)}
          END)::varchar(20)
        `,
        riskFactors: sql`
          CASE id 
          ${sql.join(updates.map(u => sql`WHEN ${u.id} THEN ${JSON.stringify(u.factors)}::jsonb`), sql` `)}
          END
        `,
        lastRiskAssessment: new Date()
      })
      .where(inArray(organizationVendors.id, updates.map(u => u.id)));
  }

  return updates;
}

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

export const vendorsRouter = router({
  // GLOBAL
  getAllGlobal: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
    return await ctx.db.select().from(vendors).where(eq(vendors.isGlobal, true));
  }),

  getById: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.select().from(vendors).where(eq(vendors.id, input.id));
      return result[0];
    }),

  /**
   * Catalogue vendors this organisation has not linked yet.
   *
   * D48. This returned the first five catalogue rows regardless of what the
   * organisation already had — so it suggested vendors already in the register, in
   * an order nobody chose, under a comment admitting it was a mock. Excluding what
   * is already linked is the whole job; ordering by how many other organisations
   * use a vendor makes the suggestion mean something, and falls back gracefully to
   * alphabetical while the catalogue is thin.
   *
   * Only global rows are eligible: another tenant's custom vendor is theirs.
   */
  suggestGlobal: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 5;
      const linked = ctx.db
        .select({ id: organizationVendors.vendorId })
        .from(organizationVendors)
        .where(eq(organizationVendors.organizationId, ctx.user!.orgId));

      return await ctx.db
        .select({
          id: vendors.id,
          name: vendors.name,
          website: vendors.website,
          category: vendors.category,
          logoUrl: vendors.logoUrl,
          headquartersCountry: vendors.headquartersCountry,
          adoptionCount: sql<number>`(
            SELECT COUNT(*) FROM ${organizationVendors}
            WHERE ${organizationVendors.vendorId} = ${vendors.id}
          )`,
        })
        .from(vendors)
        .where(and(
          eq(vendors.isGlobal, true),
          isNull(vendors.organizationId),
          notInArray(vendors.id, linked),
        ))
        .orderBy(sql`(
          SELECT COUNT(*) FROM ${organizationVendors}
          WHERE ${organizationVendors.vendorId} = ${vendors.id}
        ) DESC`, vendors.name)
        .limit(limit);
    }),

  // ORG
  /**
   * D41. The register, filtered, searched and sorted in the database.
   *
   * This deliberately does not use `paginatedQuery`. That helper selects from a
   * single table, and the register is a join: the name, website and category are
   * on the shared `vendors` catalogue while the risk score, DPA status and owner
   * are on the tenant's `organization_vendors` row. Pushing a predicate on
   * `vendors.name` through a single-table paginator produced SQL whose WHERE
   * named a table its FROM never mentioned — Postgres answers `missing
   * FROM-clause entry for table "vendors"` — so every search was a 500. Sorting
   * had the mirror problem: it was applied in JavaScript to whichever page had
   * already been fetched, which is the same illusion the client-side filter it
   * replaced was creating, moved to the server.
   *
   * The cursor is a keyset over (sort column, org-vendor id). The id tiebreak is
   * what keeps it stable when thirty vendors share a risk score of 60.
   */
  getOrgVendors: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
      search: z.string().max(120).optional(),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      dpaStatus: z.enum([...DPA_STATUSES, 'missing']).optional(),
      status: z.enum([...VENDOR_STATUSES, 'all']).optional(),
      criticality: z.enum(VENDOR_CRITICALITIES).optional(),
      processingRole: z.enum(VENDOR_PROCESSING_ROLES).optional(),
      category: z.string().max(100).optional(),
      sortBy: z.enum(['createdAt', 'name', 'riskScore', 'lastReviewedAt']).default('createdAt'),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(organizationVendors.organizationId, ctx.user!.orgId)];

      if (input.search && input.search.trim()) {
        // ESCAPE is named explicitly because the default escape character in a
        // Postgres LIKE is the backslash we are inserting: without it a vendor
        // called "100%" would search as "any string".
        const term = `%${input.search.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        conditions.push(sql`(
          ${vendors.name} ILIKE ${term} ESCAPE '\\'
          OR ${vendors.website} ILIKE ${term} ESCAPE '\\'
          OR ${organizationVendors.businessOwner} ILIKE ${term} ESCAPE '\\'
        )`);
      }
      if (input.riskLevel) conditions.push(eq(organizationVendors.riskLevel, input.riskLevel));
      if (input.dpaStatus === 'missing') {
        // "Missing" is DPA_STATUS_MISSING, not a hand-written subset of it. The
        // metric tile, the gap rule and this filter giving different answers to
        // "how many DPAs do we owe" is precisely what constants/dpaStatus.ts
        // exists to prevent — and the first version of this filter dropped
        // `expired`, so a lapsed DPA counted as missing on the dashboard and
        // present in the register.
        conditions.push(or(
          inArray(organizationVendors.dpaStatus, [...DPA_STATUS_MISSING]),
          isNull(organizationVendors.dpaStatus),
        )!);
      } else if (input.dpaStatus) {
        conditions.push(eq(organizationVendors.dpaStatus, input.dpaStatus));
      }
      // An offboarded relationship is history, not inventory, so it is out of the
      // default view — but it stays reachable through the explicit filter and
      // through `all`, because Art. 30 asks for the processors used during the
      // period, not only the ones used this morning.
      if (input.status && input.status !== 'all') {
        conditions.push(eq(organizationVendors.status, input.status));
      } else if (!input.status) {
        conditions.push(liveVendorPredicate());
      }
      if (input.criticality) conditions.push(eq(organizationVendors.criticality, input.criticality));
      if (input.processingRole) conditions.push(eq(organizationVendors.processingRole, input.processingRole));
      if (input.category) conditions.push(eq(vendors.category, input.category));

      const sortColumn = {
        createdAt: organizationVendors.createdAt,
        name: vendors.name,
        riskScore: organizationVendors.riskScore,
        lastReviewedAt: organizationVendors.lastReviewedAt,
      }[input.sortBy];
      const descending = input.sortDir === 'desc';

      if (input.cursor) {
        try {
          const { sortValue, id, isDate } = decodeCursor(input.cursor);
          const value = isDate ? new Date(sortValue) : sortValue;
          conditions.push(or(
            descending ? lt(sortColumn, value) : gt(sortColumn, value),
            and(
              eq(sortColumn, value),
              descending ? lt(organizationVendors.id, id) : gt(organizationVendors.id, id),
            ),
          )!);
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid pagination cursor.' });
        }
      }

      const rows = await ctx.db.select({
        orgVendor: organizationVendors,
        vendor: vendors,
      })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(and(...conditions))
        .orderBy(
          descending ? desc(sortColumn) : asc(sortColumn),
          descending ? desc(organizationVendors.id) : asc(organizationVendors.id),
        )
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const page = rows.slice(0, input.limit);

      const data = page.map(({ orgVendor: ov, vendor: v }) => ({
        ...v,
        orgVendorId: ov.id,
        status: ov.status ?? VENDOR_STATUS_ACTIVE,
        businessOwner: ov.businessOwner,
        contactEmail: ov.contactEmail,
        criticality: ov.criticality,
        processingRole: ov.processingRole,
        purpose: ov.purpose,
        dpaStatus: ov.dpaStatus,
        dpaSignedAt: ov.dpaSignedAt,
        dpaExpiresAt: ov.dpaExpiresAt,
        tiaCompleted: ov.tiaCompleted,
        usingEuHosting: ov.usingEuHosting,
        riskScore: ov.riskScore,
        riskLevel: ov.riskLevel,
        lastReviewedAt: ov.lastReviewedAt,
        nextReviewAt: ov.nextReviewAt,
        offboardedAt: ov.offboardedAt,
        deletionCertificateRef: ov.deletionCertificateRef,
        dataCategoriesShared: ov.dataCategoriesShared ?? [],
        linkedAt: ov.createdAt,
      }));

      const cursorValueOf = (row: (typeof page)[number]) => ({
        createdAt: row.orgVendor.createdAt,
        name: row.vendor.name,
        riskScore: row.orgVendor.riskScore,
        lastReviewedAt: row.orgVendor.lastReviewedAt,
      }[input.sortBy]);

      const lastRow = page[page.length - 1];
      const lastValue = lastRow ? cursorValueOf(lastRow) : null;

      return {
        data,
        pagination: {
          has_more: hasMore,
          // A NULL sort value cannot be keyset-paginated past — every comparison
          // against it is false — so a page ending on one ends the list rather
          // than serving itself again forever.
          next_cursor: hasMore && lastRow && lastValue != null
            ? encodeCursor(lastValue, lastRow.orgVendor.id)
            : null,
          previous_cursor: null,
        },
      };
    }),

  getOrgVendorDetails: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, input.vendorId)
      ));
      if (!records[0]) return records[0];

      /**
       * Sprint 10 built the provenance surface and wired it to nothing.
       * `ProvenanceBadge` was reached only through a wrapper that returned
       * early when handed no provenance, and the one call site passed a number
       * and nothing else. So the tier labels, the staleness hint, the
       * absent-tier copy and 16 keys in each of three catalogues were
       * unreachable from every screen in the product, and the only place a
       * source was ever shown was the Article 28 dossier, as a raw `sourceType`
       * slug.
       *
       * Resolved here rather than in the page because precedence and decay are
       * the API's answer to give: which row wins is `PROVENANCE_PRECEDENCE`, and
       * what it is worth today is a function of `retrieved_at` that must not be
       * recomputed in two places (VD-7's lesson, one level up).
       */
      const provenanceRows = await ctx.db
        .select()
        .from(vendorFieldProvenance)
        .where(eq(vendorFieldProvenance.vendorId, input.vendorId));

      const resolved = selectAuthoritativeProvenance(provenanceRows, { scope: 'catalogue' });
      const provenance: Record<string, {
        sourceType: string;
        confidence: number;
        confidenceWhenGathered: number;
        stale: boolean;
        reviewOverdue: boolean;
        retrievedAt: string | null;
        sourceUrl: string | null;
        supersededCount: number;
      }> = {};

      for (const field of resolved) {
        const retrieved = field.row.retrievedAt;
        provenance[field.fieldName] = {
          sourceType: field.row.sourceType,
          confidence: field.age.confidence,
          confidenceWhenGathered: field.age.originalConfidence,
          stale: field.age.stale,
          reviewOverdue: field.age.reviewOverdue,
          retrievedAt: retrieved ? new Date(retrieved).toISOString() : null,
          sourceUrl: field.row.sourceUrl ?? null,
          supersededCount: field.superseded.length,
        };
      }

      return { ...records[0], provenance };
    }),

  linkVendor: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await enforceLimit(ctx.db, ctx.user!.orgId, 'vendors', 1);
      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
      if (!vendor) throw new Error("Vendor not found");

      // Fetch sub-processor count
      const subs = await ctx.db.select()
        .from(vendorSubProcessors)
        .where(eq(vendorSubProcessors.parentVendorId, input.vendorId));
      const subProcessorsCount = subs.length;

      // Calculate initial risk
      const { score, level, factors } = calculateVendorRisk(
        vendor,
        { dpaStatus: 'not_started', dataCategoriesShared: [], dataSubjectVolume: '<1K' },
        { ...NEW_LINK_RISK_INPUTS, subProcessorsCount }
      );

      const [newLink] = await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user!.orgId,
        vendorId: input.vendorId,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date(),
        addedBy: ctx.user!.id,
      }).returning();
      if (!newLink) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });
      
      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user!.orgId,
        entityType: 'vendor',
        entityId: newLink.id,
        action: 'upsert'
      });

      return newLink;
    }),

  updateOrgVendor: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      vendorId: z.string().uuid(),
      dpaStatus: z.string().optional(),
      dpaExpiresAt: z.string().nullable().optional(),
      dpaSignedAt: z.string().nullable().optional(),
      usingEuHosting: z.boolean().optional(),
      tiaCompleted: z.boolean().optional(),
      notes: z.string().max(5000).optional(),
      dataSubjectVolume: z.enum(['<1K', '1K-10K', '10K-100K', '100K+']).optional(),
      certifications: z.array(z.string()).optional(),
      contractRenewalDate: z.string().nullable().optional(),
      dpaClauseCoverage: z.record(z.boolean()).optional(),
      // The safeguard this organisation relies on, which may differ from the
      // shared catalogue's. Constrained to the vocabulary the risk engine and the
      // gap rule actually match on -- a free-text 'SCCs' scored as no safeguard
      // at all, which is the trap the audit's finding 4 describes.
      transferMechanisms: z.array(z.enum(TRANSFER_MECHANISMS)).optional(),
      // D2. The Article 30(1)(d) write path: what data actually goes to this
      // recipient. Feeds the risk engine's special-category factor and, through
      // it, the `missing_dpa_special_category` gap rule (D3). Values are
      // normalised onto the controlled vocabulary server-side rather than
      // rejected, so an import's free text is kept rather than lost.
      dataCategoriesShared: z.array(z.string().min(1).max(MAX_DATA_CATEGORY_LENGTH)).max(MAX_DATA_CATEGORIES).optional(),
      // D32. The relationship record.
      businessOwner: z.string().max(255).nullable().optional(),
      // `.or(z.literal(''))` because the field is edited by a human: an empty box
      // means "clear it", and a schema that rejects the empty string makes the
      // input unclearable and reports it as a validation failure.
      contactEmail: z.string().email().or(z.literal('')).nullable().optional(),
      criticality: z.enum(VENDOR_CRITICALITIES).nullable().optional(),
      processingRole: z.enum(VENDOR_PROCESSING_ROLES).nullable().optional(),
      purpose: z.string().max(2000).nullable().optional(),
      nextReviewAt: z.string().nullable().optional(),
      /**
       * D31. Reviewing is an attestation, not a side effect of editing.
       *
       * The first version stamped `lastReviewedAt` on every save, which meant the
       * overdue-review rule could be silenced by touching any field — and that
       * an autosave of the notes box counted, to a regulator, as "we reviewed
       * this processor". The caller now says so explicitly, and only the review
       * control on the record sets it.
       */
      attestReview: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [orgVendor] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, input.vendorId)
      ));
      if (!orgVendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found' });

      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));

      const updates: any = {};
      // The signed date is handled once, after both inputs are known. Splitting
      // it across two branches meant an explicit `dpaSignedAt: null` alongside
      // `dpaStatus: 'signed'` silently became today — the field could be set but
      // never cleared, and the mutation did something other than what it was
      // asked to.
      if (input.dpaSignedAt !== undefined) {
        updates.dpaSignedAt = input.dpaSignedAt ? new Date(input.dpaSignedAt) : null;
      }
      if (input.dpaStatus !== undefined) {
        updates.dpaStatus = input.dpaStatus;
        // A signed date is part of the same fact as a signed status: recording
        // one without the other is how dpaSignedAt stayed blank in every audit
        // pack. Fill it in only when the caller has not spoken and the row has
        // nothing already.
        if (input.dpaStatus === DPA_STATUS_SIGNED && input.dpaSignedAt === undefined && !orgVendor.dpaSignedAt) {
          updates.dpaSignedAt = new Date();
        }
      }
      if (input.dpaExpiresAt !== undefined) updates.dpaExpiresAt = input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null;
      if (input.usingEuHosting !== undefined) updates.usingEuHosting = input.usingEuHosting;
      if (input.tiaCompleted !== undefined) updates.tiaCompleted = input.tiaCompleted;
      if (input.notes !== undefined) updates.dpaNotes = input.notes;
      if (input.dataSubjectVolume !== undefined) updates.dataSubjectVolume = input.dataSubjectVolume;
      if (input.certifications !== undefined) updates.certifications = input.certifications;
      // A `date` column takes 'YYYY-MM-DD'; the input already is one. Wrapping it
      // in new Date() bound a timestamp to a date column.
      if (input.contractRenewalDate !== undefined) updates.contractRenewalDate = input.contractRenewalDate || null;
      if (input.dpaClauseCoverage !== undefined) updates.dpaClauseCoverage = input.dpaClauseCoverage;
      if (input.transferMechanisms !== undefined) updates.transferMechanisms = input.transferMechanisms;
      if (input.dataCategoriesShared !== undefined) {
        updates.dataCategoriesShared = normaliseDataCategoryList(input.dataCategoriesShared);
      }
      if (input.businessOwner !== undefined) updates.businessOwner = input.businessOwner || null;
      if (input.contactEmail !== undefined) updates.contactEmail = input.contactEmail || null;
      if (input.criticality !== undefined) updates.criticality = input.criticality;
      if (input.processingRole !== undefined) updates.processingRole = input.processingRole;
      if (input.purpose !== undefined) updates.purpose = input.purpose;
      if (input.nextReviewAt !== undefined) {
        updates.nextReviewAt = input.nextReviewAt ? new Date(input.nextReviewAt) : null;
      }
      if (input.attestReview) {
        updates.lastReviewedAt = new Date();
      }

      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found.' });

      await ctx.db.update(organizationVendors)
        .set(updates)
        .where(eq(organizationVendors.id, orgVendor.id));

      /**
       * The score is recomputed by `updateVendorRiskScore`, not here.
       *
       * This procedure used to call `calculateVendorRisk(vendor, merged, subs)`
       * directly — three arguments, where the full formula takes five. It
       * omitted the reviewed questionnaire's `scoreModifier` and the vendor's
       * open DPIA gaps, so editing any field on the relationship silently
       * discarded both: a DPO would review a questionnaire, watch the score drop
       * ten points, then type a business owner into the box and watch it come
       * back. Two derivations of one number is one derivation too many — the
       * same lesson as the three divergent Article 30 documents.
       *
       * It also enqueues the embedding refresh, which is why this path no longer
       * does that itself.
       */
      await updateVendorRiskScore(ctx.db, ctx.user!.orgId, input.vendorId);

      const [updated] = await ctx.db.select().from(organizationVendors)
        .where(eq(organizationVendors.id, orgVendor.id));
      return updated ?? { success: true };
    }),

  // CUSTOM VENDORS
  createCustom: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      name: z.string(),
      website: z.string().optional(),
      /*
       * D42. This was a bare `z.string()` into `char('headquarters_country', 2)`,
       * fed by a free-text input, so "Germany" surfaced a raw
       * `value too long for type character(2)` and a shorter unrecognised word was
       * stored as whatever two characters it happened to be — silently, and then
       * read by the adequacy logic as a different country. Accepting prose and
       * normalising it is the behaviour the CSV import already had; refusing what
       * we cannot place is better than truncating it.
       */
      headquartersCountry: z
        .string()
        .optional()
        .transform((value) => (value && value.trim() ? normaliseCountry(value) : undefined))
        .refine((value) => value !== null, {
          message: 'Country not recognised. Use an ISO 3166-1 alpha-2 code (for example DE) or an English country name.',
        }),
      category: z.string().optional(),
      description: z.string().optional(),
      euHostingAvailable: z.boolean().optional(),
      securityCertifications: z.array(z.string()).optional(),
      dataSubjectVolume: z.enum(['<1K', '1K-10K', '10K-100K', '100K+']).optional(),
      certifications: z.array(z.string()).optional(),
      contractRenewalDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await enforceLimit(ctx.db, ctx.user!.orgId, 'vendors', 1);
      const [newVendor] = await ctx.db.insert(vendors).values({
        name: input.name,
        website: input.website,
        headquartersCountry: input.headquartersCountry,
        category: input.category,
        description: input.description,
        euHostingAvailable: input.euHostingAvailable,
        securityCertifications: input.securityCertifications,
        isGlobal: false,
        organizationId: ctx.user!.orgId
      }).returning();

      if (!newVendor) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Calculate initial risk
      const initialOrgVendor = {
        dpaStatus: 'not_started',
        dataSubjectVolume: input.dataSubjectVolume || '<1K',
        certifications: input.certifications || [],
        contractRenewalDate: input.contractRenewalDate || null
      };

      const { score, level, factors } = calculateVendorRisk(newVendor, initialOrgVendor, NEW_LINK_RISK_INPUTS);

      const [newLink] = await ctx.db.insert(organizationVendors).values({
        organizationId: ctx.user!.orgId,
        vendorId: newVendor.id,
        dpaStatus: 'not_started',
        riskScore: score,
        riskLevel: level,
        riskFactors: factors,
        lastRiskAssessment: new Date(),
        dataSubjectVolume: input.dataSubjectVolume || '<1K',
        certifications: input.certifications || [],
        contractRenewalDate: input.contractRenewalDate || null,
        addedBy: ctx.user!.id,
      }).returning();
      if (!newLink) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });

      await orgEmbeddingsQueue.add('embed-vendor', {
        orgId: ctx.user!.orgId,
        entityType: 'vendor',
        entityId: newLink.id,
        action: 'upsert'
      });

      return newVendor;
    }),

  // SUB-PROCESSORS
  subProcessors: router({
    // Sub-processor records describe a vendor, not a tenant, so these are readable
    // across organisations by design.
    list: protectedProcedure
      .use(requirePermission('vendors', 'view'))
      .input(z.object({ parentVendorId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // Fetch sub-processors and join with vendors if linked
        const records = await ctx.db.select({
          subProcessor: vendorSubProcessors,
          vendor: vendors
        })
        .from(vendorSubProcessors)
        .leftJoin(vendors, eq(vendorSubProcessors.subProcessorVendorId, vendors.id))
        .where(eq(vendorSubProcessors.parentVendorId, input.parentVendorId));
        
        return records.map((r: any) => ({
          ...r.subProcessor,
          vendorData: r.vendor // Will be null for unlinked sub-processors
        }));
      }),

    addLinked: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({
        parentVendorId: z.string().uuid(),
        subProcessorVendorId: z.string().uuid(),
        purpose: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        // A sub-processor row hangs off the shared catalogue, so an unproved
        // parentVendorId let any member attach fabricated sub-processors to AWS's
        // global row and shift every tenant's derived risk score. Only a custom
        // vendor this organisation owns may be edited.
        const [parent] = await ctx.db.select({ id: vendors.id })
          .from(vendors)
          .where(and(
            eq(vendors.id, input.parentVendorId),
            eq(vendors.organizationId, ctx.user!.orgId)
          ));
        if (!parent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent vendor not found' });

        const [sub] = await ctx.db.insert(vendorSubProcessors).values({
          parentVendorId: input.parentVendorId,
          subProcessorVendorId: input.subProcessorVendorId,
          purpose: input.purpose
        }).returning();

        await recalculateVendorRiskForAllOrgs(ctx.db, input.parentVendorId);
        return sub;
      }),

    addUnlinked: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({
        parentVendorId: z.string().uuid(),
        name: z.string().min(1),
        country: z.string().length(2).optional(),
        purpose: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        // Same proof as addLinked: the row describes the vendor, but the write
        // mutates the shared catalogue unless the parent is org-owned.
        const [parent] = await ctx.db.select({ id: vendors.id })
          .from(vendors)
          .where(and(
            eq(vendors.id, input.parentVendorId),
            eq(vendors.organizationId, ctx.user!.orgId)
          ));
        if (!parent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent vendor not found' });

        const [sub] = await ctx.db.insert(vendorSubProcessors).values({
          parentVendorId: input.parentVendorId,
          name: input.name,
          country: input.country,
          purpose: input.purpose
        }).returning();

        await recalculateVendorRiskForAllOrgs(ctx.db, input.parentVendorId);
        return sub;
      }),

    remove: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // Only sub-processors of a vendor this organisation owns. Deleting a row
        // under a global catalogue vendor would silently change every other
        // tenant's sub-processor list and their derived risk scores.
        const [existing] = await ctx.db.select({ row: vendorSubProcessors })
          .from(vendorSubProcessors)
          .innerJoin(vendors, eq(vendorSubProcessors.parentVendorId, vendors.id))
          .where(and(
            eq(vendorSubProcessors.id, input.id),
            eq(vendors.organizationId, ctx.user!.orgId),
          ))
          .then((rows: any[]) => rows.map(r => r.row));
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sub-processor not found' });

        const [removed] = await ctx.db.delete(vendorSubProcessors)
          .where(eq(vendorSubProcessors.id, input.id))
          .returning();
          
        await recalculateVendorRiskForAllOrgs(ctx.db, existing.parentVendorId);
        return removed;
      }),
      
    /*
     * D46. This used to set `notifiedAt` on the shared `vendor_sub_processors` row,
     * so one organisation acknowledging a sub-processor cleared it for every other
     * organisation — an Article 28(2) record that recorded whoever clicked last.
     * The acknowledgement is now its own per-organisation row, which is what makes
     * it a tenant's own answer; the unique key makes acknowledging twice a no-op
     * rather than a duplicate.
     */
    markNotified: protectedProcedure
      .use(requirePermission('vendors', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [subProcessor] = await ctx.db.select()
          .from(vendorSubProcessors)
          .where(eq(vendorSubProcessors.id, input.id));
        if (!subProcessor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sub-processor not found' });

        const [ack] = await ctx.db.insert(vendorSubProcessorAcknowledgements)
          .values({
            organizationId: ctx.user!.orgId,
            subProcessorId: input.id,
            acknowledgedBy: ctx.user!.id,
          })
          .onConflictDoUpdate({
            target: [
              vendorSubProcessorAcknowledgements.organizationId,
              vendorSubProcessorAcknowledgements.subProcessorId,
            ],
            set: { acknowledgedAt: new Date(), acknowledgedBy: ctx.user!.id },
          })
          .returning();
        return ack;
      })
  }),

  getRiskStats: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      // Counted in SQL. These tiles are the whole register -- the page used to
      // derive them from the 25 rows it happened to have loaded -- so pulling
      // every column of every row back to call .filter() on it scaled the wrong
      // way for the one caller that most needed it not to.
      // The offboarded tally is counted separately so the number can be shown
      // rather than merely excluded: "6 offboarded" is a fact about the
      // register, and a total that silently shrank would read as data loss.
      // Separate predicates over the same table, so the two counts race.
      const [[row], [offboarded]] = await Promise.all([
        ctx.db.select({
          total: sql<number>`count(*)::int`,
          highOrCritical: sql<number>`count(*) filter (where ${inArray(organizationVendors.riskLevel, ['high', 'critical'])})::int`,
          low: sql<number>`count(*) filter (where ${eq(organizationVendors.riskLevel, 'low')})::int`,
          medium: sql<number>`count(*) filter (where ${eq(organizationVendors.riskLevel, 'medium')})::int`,
          dpasSigned: sql<number>`count(*) filter (where ${eq(organizationVendors.dpaStatus, DPA_STATUS_SIGNED)})::int`,
          missingDpas: sql<number>`count(*) filter (where ${inArray(organizationVendors.dpaStatus, [...DPA_STATUS_MISSING])})::int`,
        })
          .from(organizationVendors)
          .where(and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            // D30's other half. Recording an offboarding is easy; making the rest
            // of the product believe it is the point. While these tiles counted
            // every row, offboarding Salesforce left "1 DPA missing" on the
            // dashboard for ever and the register's compliance score could never
            // improve by ending a relationship — which is one of the two ways it
            // is supposed to be able to improve.
            liveVendorPredicate(),
          )),
        ctx.db.select({ n: count() })
          .from(organizationVendors)
          .where(and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            eq(organizationVendors.status, VENDOR_STATUS_OFFBOARDED),
          )),
      ]);

      return {
        total: row?.total ?? 0,
        highOrCritical: row?.highOrCritical ?? 0,
        low: row?.low ?? 0,
        medium: row?.medium ?? 0,
        dpasSigned: row?.dpasSigned ?? 0,
        missingDpas: row?.missingDpas ?? 0,
        offboarded: Number(offboarded?.n ?? 0),
      };
    }),

  /**
   * Server-side export over the entire register. The client-side version
   * serialised only the loaded pages, so an organisation with 60 vendors handed
   * an auditor a file describing 25.
   *
   * Offboarded relationships are **included**, with their status and end date.
   * This is the opposite decision to the register view, and deliberately so: the
   * screen is a working list of who is processing data today, while the export
   * is evidence of who processed it during the period. Dropping ended
   * relationships from an Art. 30(1)(d) recipient list would be a hole in the
   * record, not a tidier file.
   */
  exportRegisterCsv: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.select({
        name: vendors.name,
        category: vendors.category,
        headquartersCountry: vendors.headquartersCountry,
        website: vendors.website,
        status: organizationVendors.status,
        processingRole: organizationVendors.processingRole,
        businessOwner: organizationVendors.businessOwner,
        criticality: organizationVendors.criticality,
        purpose: organizationVendors.purpose,
        dataCategoriesShared: organizationVendors.dataCategoriesShared,
        dpaStatus: organizationVendors.dpaStatus,
        dpaSignedAt: organizationVendors.dpaSignedAt,
        dpaExpiresAt: organizationVendors.dpaExpiresAt,
        tiaCompleted: organizationVendors.tiaCompleted,
        riskLevel: organizationVendors.riskLevel,
        riskScore: organizationVendors.riskScore,
        lastReviewedAt: organizationVendors.lastReviewedAt,
        offboardedAt: organizationVendors.offboardedAt,
        deletionCertificateRef: organizationVendors.deletionCertificateRef,
      })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(eq(organizationVendors.organizationId, ctx.user!.orgId))
        .orderBy(desc(organizationVendors.riskScore));

      const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

      // csvDocument rather than a local quoting helper: this file and
      // ropaExportFormats.ts had one each, disagreeing about when to quote, and
      // only one of them was covered by the importer's round-trip test.
      const csv = csvDocument([
        [
          'Vendor', 'Category', 'Country', 'Website', 'Status', 'Processing role',
          'Business owner', 'Criticality', 'Purpose', 'Data categories shared',
          'DPA status', 'DPA signed', 'DPA expires', 'TIA completed',
          'Risk level', 'Risk score', 'Last reviewed', 'Offboarded', 'Deletion certificate',
        ],
        ...rows.map((r) => [
          r.name, r.category, r.headquartersCountry, r.website,
          r.status ?? VENDOR_STATUS_ACTIVE, r.processingRole,
          r.businessOwner, r.criticality, r.purpose,
          (r.dataCategoriesShared ?? []).join('; '),
          r.dpaStatus, day(r.dpaSignedAt), day(r.dpaExpiresAt), r.tiaCompleted ? 'Yes' : 'No',
          r.riskLevel, r.riskScore, day(r.lastReviewedAt),
          day(r.offboardedAt), r.deletionCertificateRef,
        ]),
      ]);

      return { csv, count: rows.length };
    }),

  getSubProcessorChanges: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ orgVendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ov] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ));
      if (!ov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization vendor link not found' });

      const list = await ctx.db.select({
        change: vendorSubProcessorChanges,
        reviewerName: users.name
      })
      .from(vendorSubProcessorChanges)
      .leftJoin(users, eq(vendorSubProcessorChanges.reviewedBy, users.id))
      .where(eq(vendorSubProcessorChanges.orgVendorId, input.orgVendorId))
      .orderBy(vendorSubProcessorChanges.detectedAt);

      return list.map((item) => ({
        ...item.change,
        reviewerName: item.reviewerName
      }));
    }),

  reviewSubProcessorChange: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      changeId: z.string().uuid(),
      status: z.enum(['acknowledged', 'objected']),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [change] = await ctx.db.select()
        .from(vendorSubProcessorChanges)
        .where(and(
          eq(vendorSubProcessorChanges.id, input.changeId),
          eq(vendorSubProcessorChanges.organizationId, ctx.user!.orgId)
        ));
      if (!change) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sub-processor change record not found' });

      const [updated] = await ctx.db.update(vendorSubProcessorChanges)
        .set({
          status: input.status,
          notes: input.notes || null,
          reviewedBy: ctx.user!.id,
          reviewedAt: new Date()
        })
        .where(eq(vendorSubProcessorChanges.id, input.changeId))
        .returning();

      return updated;
    }),

  getIncidentsForVendor: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [v] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
      if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      const slug = v.slug || v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const list = await ctx.db.select({
        incident: vendorIncidents,
        alertId: organizationVendorIncidentAlerts.id,
        alertStatus: organizationVendorIncidentAlerts.status,
        acknowledgedAt: organizationVendorIncidentAlerts.acknowledgedAt,
        actionNotes: organizationVendorIncidentAlerts.actionNotes,
        reviewerName: users.name
      })
      .from(vendorIncidents)
      .leftJoin(
        organizationVendorIncidentAlerts,
        and(
          eq(organizationVendorIncidentAlerts.incidentId, vendorIncidents.id),
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user!.orgId)
        )
      )
      .leftJoin(users, eq(organizationVendorIncidentAlerts.acknowledgedBy, users.id))
      .where(
        and(
          eq(vendorIncidents.vendorSlug, slug),
          or(
            eq(vendorIncidents.status, 'published'),
            sql`organization_vendor_incident_alerts.id IS NOT NULL`
          )
        )
      )
      .orderBy(vendorIncidents.incidentDate);

      return list.map((item) => ({
        ...item.incident,
        alertId: item.alertId,
        alertStatus: item.alertStatus || 'unread',
        acknowledgedAt: item.acknowledgedAt,
        actionNotes: item.actionNotes,
        reviewerName: item.reviewerName
      }));
    }),

  getUnreadIncidentAlertsCount: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const list = await ctx.db.select()
        .from(organizationVendorIncidentAlerts)
        .where(and(
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user!.orgId),
          eq(organizationVendorIncidentAlerts.status, 'unread')
        ));
      return { count: list.length };
    }),

  reviewIncidentAlert: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      alertId: z.string().uuid(),
      status: z.enum(['unread', 'acknowledged', 'action_taken', 'dismissed']),
      actionNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendorIncidentAlerts)
        .where(and(
          eq(organizationVendorIncidentAlerts.id, input.alertId),
          eq(organizationVendorIncidentAlerts.organizationId, ctx.user!.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' });

      const [updated] = await ctx.db.update(organizationVendorIncidentAlerts)
        .set({
          status: input.status,
          actionNotes: input.actionNotes || null,
          acknowledgedBy: ctx.user!.id,
          acknowledgedAt: new Date()
        })
        .where(eq(organizationVendorIncidentAlerts.id, input.alertId))
        .returning();

      return updated;
    }),

  // Publishing fans an alert out to every organisation subscribed to this vendor,
  // so this is a platform-operator action sitting on a tenant-facing router. It had
  // no permission check at all. `vendors:manage` is granted by no built-in role --
  // see the note on ROLE_PERMISSION_DEFAULTS -- so this resolves to owner-only via
  // `*:*`. That is the intent, deliberately narrower than `vendors:edit`, until a
  // real platform-admin role exists. Recorded in known-concerns.md.
  publishIncident: protectedProcedure
    .use(requirePermission('vendors', 'manage'))
    .input(z.object({ incidentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [incident] = await ctx.db.select().from(vendorIncidents).where(eq(vendorIncidents.id, input.incidentId));
      if (!incident) throw new TRPCError({ code: 'NOT_FOUND', message: 'Incident not found' });
      if (incident.status === 'published') return incident;

      // The catalogue row is looked up by the slug already read above, so it does
      // not observe the publish and the two run together.
      const [[updated], [vendor]] = await Promise.all([
        ctx.db.update(vendorIncidents)
          .set({ status: 'published' })
          .where(eq(vendorIncidents.id, input.incidentId))
          .returning(),
        ctx.db.select().from(vendors).where(eq(vendors.slug, incident.vendorSlug)),
      ]);
      if (vendor) {
        const { publishIncidentAndAlertOrgs } = await import('../workers/incidents.js');
        await publishIncidentAndAlertOrgs(input.incidentId, vendor, updated);
      }

      return updated;
    }),

  /**
   * Correct a catalogue field about a named third party — Sprint 10, VD-20.
   *
   * Until now the catalogue had no correction path at all. Custodia publishes
   * assertions about real companies — where they are established, what transfer
   * mechanism they offer, whether their DPF certification is current — sourced
   * from a register and a crawler, and there was no procedure for "your record
   * of us is wrong" and no rule for what should win if somebody recorded an
   * answer by hand. A registry row that is wrong about a company was, literally,
   * uncorrectable by anything the product offered.
   *
   * Three properties, each of which is the point rather than a detail:
   *
   * **`analyst` is the only tier a human may write.** The other four are what a
   * machine observed — a register row, a probe, a portal, a tenant's own
   * contract — and letting a person write one of those would put an unsourced
   * assertion behind a label that says a machine measured it. The tier is
   * hardcoded here, not taken from the input.
   *
   * **It supersedes registry and probe rows for its field** (see
   * `PROVENANCE_PRECEDENCE`), which is why the evidence requirements are strict:
   * the row that beats an official register has to carry a named author, the URL
   * they read, the sentence they read, and a date by which somebody must read it
   * again. `validateAnalystCorrection` refuses anything short of that, so the
   * override cannot be quieter than what it overrides.
   *
   * **It writes to the shared catalogue,** so it is gated on `vendors:manage`
   * and is in the tenancy guard's `ALLOWED_WRITES` with that reason. A tenant
   * who disagrees about a vendor is a different feature — a `customer` row,
   * org-scoped, which `selectAuthoritativeProvenance` already excludes from the
   * catalogue resolution so it can never propagate to anyone else.
   *
   * Nothing here writes the vendor column itself. The provenance row is the
   * record of what somebody established; folding it into `vendors` is a
   * separate, reversible step, and doing both at once would make an override
   * indistinguishable from the thing it overrode.
   */
  submitFieldCorrection: protectedProcedure
    .use(requirePermission('vendors', 'manage'))
    .input(z.object({
      vendorId: z.string().uuid(),
      fieldName: z.string().min(1).max(100),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      sourceUrl: z.string().url().max(2000),
      evidenceSnippet: z.string().min(20).max(2000),
      reviewBy: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      note: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // The author is taken from the session, never from the input: a
      // correction is attributable or it is not a correction, and an
      // attribution the caller supplies is an attribution the caller can forge.
      // `ctx.user` carries no email, so the id is the attribution. It resolves
      // to a person through `users`, which is what an auditor asking "who
      // decided this?" needs; a display name here would go stale the moment
      // somebody changed theirs.
      return runCorrection(() =>
        submitCorrection({
          db: ctx.db,
          vendorId: input.vendorId,
          fieldName: input.fieldName,
          value: input.value,
          sourceUrl: input.sourceUrl,
          evidenceSnippet: input.evidenceSnippet,
          reviewBy: input.reviewBy,
          verifiedBy: ctx.user?.id ?? null,
        }),
      );
    }),

  /**
   * Fold a standing analyst correction into the catalogue column it corrects.
   *
   * The deliberate second half of `submitFieldCorrection` (known-concerns §20).
   * Recording a correction says what a person found; this is what makes the
   * product act on it — without it a corrected headquarters country was visible
   * to anything reading provenance and invisible to everything reading the
   * column, including the risk score.
   *
   * Separate on purpose rather than folded into the write above: doing both at
   * once makes an override indistinguishable from the thing it overrode, which
   * is what the widened provenance key exists to prevent. It takes no value —
   * only a vendor and a field — so the column can only be set to something that
   * already passed `validateAnalystCorrection`.
   */
  applyFieldCorrection: protectedProcedure
    .use(requirePermission('vendors', 'manage'))
    .input(z.object({
      vendorId: z.string().uuid(),
      fieldName: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      return runCorrection(() =>
        applyCorrectionToColumn({
          db: ctx.db,
          vendorId: input.vendorId,
          fieldName: input.fieldName,
        }),
      );
    }),

  getPrivacyAlternatives: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, input.vendorId));
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      if (!vendor.category) return [];

      /*
       * D29. This sorted on `vendors.risk_score`, which the risk engine never writes
       * — the score is per relationship and lives on `organization_vendors`. So the
       * COALESCE fell through to 100 for every row, the ordering was arbitrary, and
       * a panel headed "consider these lower-risk alternatives" listed the whole
       * category with nothing lower-risk about it.
       *
       * Ranked on the mean score other organisations actually carry for each
       * candidate, which is a real signal and the only risk number that exists.
       * Vendors nobody has linked yet have no score to average; they sort last
       * rather than first, because "unknown" is not "safe" — the previous behaviour
       * badged exactly those rows as low risk.
       */
      const alternatives = await ctx.db.select({
        id: vendors.id,
        name: vendors.name,
        website: vendors.website,
        category: vendors.category,
        logoUrl: vendors.logoUrl,
        headquartersCountry: vendors.headquartersCountry,
        euHostingAvailable: vendors.euHostingAvailable,
        transferMechanisms: vendors.transferMechanisms,
        securityCertifications: vendors.securityCertifications,
        peerRiskScore: sql<number | null>`(
          SELECT AVG(${organizationVendors.riskScore})::int
          FROM ${organizationVendors}
          WHERE ${organizationVendors.vendorId} = ${vendors.id}
        )`,
        peerOrgCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${organizationVendors}
          WHERE ${organizationVendors.vendorId} = ${vendors.id}
        )`,
      })
        .from(vendors)
        .where(and(
          eq(vendors.category, vendor.category),
          eq(vendors.isGlobal, true),
          sql`${vendors.id} != ${input.vendorId}`
        ))
        .orderBy(sql`(
          SELECT AVG(${organizationVendors.riskScore})
          FROM ${organizationVendors}
          WHERE ${organizationVendors.vendorId} = ${vendors.id}
        ) ASC NULLS LAST`, vendors.name);

      return alternatives;
    }),

  confirmDpaAnalysis: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      orgVendorId: z.string().uuid(),
      dpaClauseCoverage: z.record(z.boolean()),
      dpaStatus: z.string().optional(),
      dpaNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization vendor link not found' });

      const updates: any = {
        dpaClauseCoverage: input.dpaClauseCoverage,
        dpaAnalysisStatus: 'confirmed'
      };
      if (input.dpaStatus) updates.dpaStatus = input.dpaStatus;
      if (input.dpaNotes !== undefined) updates.dpaNotes = input.dpaNotes;

      const [updated] = await ctx.db.update(organizationVendors)
        .set(updates)
        .where(eq(organizationVendors.id, input.orgVendorId))
        .returning();

      // Recalculate risk
      await updateVendorRiskScore(ctx.db, ctx.user!.orgId, existing.vendorId);

      return updated;
    }),

  saveDpaAnalysisDraft: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      orgVendorId: z.string().uuid(),
      dpaAiAnalysis: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization vendor link not found' });

      const [updated] = await ctx.db.update(organizationVendors)
        .set({
          dpaAiAnalysis: input.dpaAiAnalysis,
          dpaAnalysisStatus: 'pending_review'
        })
        .where(eq(organizationVendors.id, input.orgVendorId))
        .returning();

      return updated;
    }),

  getQuestionnaires: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ orgVendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(and(
          eq(vendorQuestionnaires.orgVendorId, input.orgVendorId),
          eq(vendorQuestionnaires.organizationId, ctx.user!.orgId)
        ))
        .orderBy(desc(vendorQuestionnaires.createdAt));
    }),

  createQuestionnaire: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      orgVendorId: z.string().uuid(),
      questions: z.array(z.object({
        id: z.string(),
        text: z.string(),
        category: z.string(),
        rationale: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const [orgVendor] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.id, input.orgVendorId),
          eq(organizationVendors.organizationId, ctx.user!.orgId)
        ));
      if (!orgVendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const [newQ] = await ctx.db.insert(vendorQuestionnaires)
        .values({
          organizationId: ctx.user!.orgId,
          vendorId: orgVendor.vendorId,
          orgVendorId: input.orgVendorId,
          questions: input.questions,
          status: 'draft',
          promptVersion: 'v1'
        })
        .returning();

      return newQ;
    }),

  confirmQuestionnaire: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      questionnaireId: z.string().uuid(),
      scoreModifier: z.number().min(-10).max(25),
      aiScore: z.number().optional(),
      aiAnalysis: z.any().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(and(
          eq(vendorQuestionnaires.id, input.questionnaireId),
          eq(vendorQuestionnaires.organizationId, ctx.user!.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      const updates: any = {
        scoreModifier: input.scoreModifier,
        status: 'reviewed',
        updatedAt: new Date()
      };
      if (input.aiScore !== undefined) updates.aiScore = input.aiScore;
      if (input.aiAnalysis !== undefined) updates.aiAnalysis = input.aiAnalysis;

      const [updated] = await ctx.db.update(vendorQuestionnaires)
        .set(updates)
        .where(eq(vendorQuestionnaires.id, input.questionnaireId))
        .returning();

      // Recalculate risk score for this vendor
      await updateVendorRiskScore(ctx.db, ctx.user!.orgId, existing.vendorId);

      return updated;
    }),

  getQuestionnaireByToken: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.select({
        questionnaire: vendorQuestionnaires,
        vendor: vendors
      })
      .from(vendorQuestionnaires)
      .leftJoin(vendors, eq(vendorQuestionnaires.vendorId, vendors.id))
      .where(eq(vendorQuestionnaires.token, input.token));

      const record = records[0];
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      return {
        id: record.questionnaire.id,
        status: record.questionnaire.status,
        vendorName: record.vendor?.name || 'Unknown Vendor',
        vendorWebsite: record.vendor?.website || '',
        questions: record.questionnaire.questions,
        answers: record.questionnaire.answers || []
      };
    }),

  submitQuestionnaireAnswers: publicProcedure
    .input(z.object({
      token: z.string().uuid(),
      answers: z.array(z.object({
        questionId: z.string(),
        textAnswer: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(vendorQuestionnaires)
        .where(eq(vendorQuestionnaires.token, input.token));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });

      const [updated] = await ctx.db.update(vendorQuestionnaires)
        .set({
          answers: input.answers,
          status: 'submitted',
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(vendorQuestionnaires.token, input.token))
        .returning();

      return { success: true };
    }),

  getDiscoveries: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
      status: z.enum(['undocumented', 'added_to_register', 'dismissed', 'false_positive']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vendorDiscoveries.organizationId, ctx.user!.orgId)];
      if (input.status) {
        conditions.push(eq(vendorDiscoveries.status, input.status));
      }

      // Each detected host is resolved against the tracker registry, so a discovery
      // arrives with the consent category it needs already attached. Whoever
      // triages this inbox is the person who has to decide whether the banner
      // covers it, and that decision is unanswerable from a bare hostname. The
      // registry module does not depend on the discovery list, so both are loaded
      // together; only `loadTrackerRegistry` has to wait for its own import.
      const [list, { loadTrackerRegistry, matchTrackerByDomain }] = await Promise.all([
        ctx.db.select({
          discovery: vendorDiscoveries,
          matchedVendor: vendors
        })
        .from(vendorDiscoveries)
        .leftJoin(vendors, eq(vendorDiscoveries.matchedVendorId, vendors.id))
        .where(and(...conditions))
        .orderBy(desc(vendorDiscoveries.lastDetectedAt))
        .limit(input.limit),
        import('../lib/trackerRegistry.js'),
      ]);
      const registry = await loadTrackerRegistry(ctx.db);

      return list.map((row: any) => {
        const tracker = matchTrackerByDomain(row.discovery.detectedDomain, registry);
        return {
          ...row,
          tracker: tracker
            ? {
                trackerKey: tracker.trackerKey,
                provider: tracker.provider,
                requiredCategory: tracker.requiredCategory,
                consentModeSupported: tracker.consentModeSupported,
              }
            : null,
        };
      });
    }),

  getUndocumentedCount: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const [result] = await ctx.db.select({
        count: sql<number>`count(*)::int`
      })
      .from(vendorDiscoveries)
      .where(and(
        eq(vendorDiscoveries.organizationId, ctx.user!.orgId),
        eq(vendorDiscoveries.status, 'undocumented')
      ));
      return result?.count || 0;
    }),

  triggerDiscoveryScan: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      websiteUrl: z.string().url().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

      const websiteUrl = input.websiteUrl || (org.settings as any)?.websiteUrl || `https://${org.slug}.com`;
      let domain = '';
      try {
        const urlObj = new URL(websiteUrl);
        domain = urlObj.hostname.replace(/^www\./, '');
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid website URL provided' });
      }

      if (vendorJobsQueue) {
        await vendorJobsQueue.add('vendor-discovery', {
          organizationId: ctx.user!.orgId,
          domain,
          websiteUrl
        });
      }

      return { success: true };
    }),

  dismissDiscovery: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(vendorDiscoveries)
        .set({
          status: 'dismissed',
          resolvedBy: ctx.user!.id,
          resolvedAt: new Date()
        })
        .where(and(
          eq(vendorDiscoveries.id, input.id),
          eq(vendorDiscoveries.organizationId, ctx.user!.orgId)
        ))
        .returning();
      return updated;
    }),

  confirmDiscovery: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      vendorId: z.string().uuid().optional(),
      customVendorData: z.object({
        name: z.string(),
        website: z.string().optional(),
        category: z.string().optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const [discovery] = await ctx.db.select().from(vendorDiscoveries).where(and(
        eq(vendorDiscoveries.id, input.id),
        eq(vendorDiscoveries.organizationId, ctx.user!.orgId)
      ));
      if (!discovery) throw new TRPCError({ code: 'NOT_FOUND', message: 'Discovery record not found' });

      let finalVendorId = input.vendorId;

      if (!finalVendorId && input.customVendorData) {
        const [newVendor] = await ctx.db.insert(vendors).values({
          name: input.customVendorData.name,
          website: input.customVendorData.website || `https://${discovery.detectedDomain}`,
          category: input.customVendorData.category || 'Other',
          isGlobal: false,
          isAutoDiscovered: true,
          organizationId: ctx.user!.orgId
        }).returning();

        if (!newVendor) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create custom vendor' });
        finalVendorId = newVendor.id;
      }

      if (!finalVendorId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Either vendorId or customVendorData is required' });
      }

      // Check if already linked
      const [existingLink] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, finalVendorId)
      ));

      if (!existingLink) {
        const [vendor] = await ctx.db.select().from(vendors).where(eq(vendors.id, finalVendorId));
        if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found.' });

        const { score, level, factors } = calculateVendorRisk(
          vendor,
          { dpaStatus: 'not_started', dataCategoriesShared: [], dataSubjectVolume: '<1K' },
          NEW_LINK_RISK_INPUTS
        );

        const [newLink] = await ctx.db.insert(organizationVendors).values({
          organizationId: ctx.user!.orgId,
          vendorId: finalVendorId,
          dpaStatus: 'not_started',
          riskScore: score,
          riskLevel: level,
          riskFactors: factors,
          lastRiskAssessment: new Date(),
          addedBy: ctx.user!.id
        }).returning();
        if (!newLink) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });

        if (orgEmbeddingsQueue) {
          await orgEmbeddingsQueue.add('embed-vendor', {
            orgId: ctx.user!.orgId,
            entityType: 'vendor',
            entityId: newLink.id,
            action: 'upsert'
          });
        }
      }

      const [updated] = await ctx.db.update(vendorDiscoveries)
        .set({
          status: 'added_to_register',
          matchedVendorId: finalVendorId,
          resolvedBy: ctx.user!.id,
          resolvedAt: new Date()
        })
        .where(eq(vendorDiscoveries.id, input.id))
        .returning();

      return updated;
    }),

  verifyVendorProfile: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      vendorId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(vendors)
        .set({
          isAutoDiscovered: false,
          lastVerifiedAt: new Date(),
          verifiedBy: ctx.user!.id
        })
        .where(and(
          eq(vendors.id, input.vendorId),
          eq(vendors.organizationId, ctx.user!.orgId)
        ))
        .returning();

      return updated;
    }),

  // -------------------------------------------------------------------------
  // Sprint 1. The register's lifecycle and its evidence.
  // -------------------------------------------------------------------------

  /**
   * D30. Status lifecycle. `status` existed on the row and was written by
   * nothing; a register that can only grow stops being evidence the moment a
   * contract ends. `offboarded` is terminal-but-recorded rather than deleted --
   * Art. 28(3)(g) asks what happened to the data, which needs the row to stay.
   *
   * `vendorId` rather than the join-row id, so the audit middleware's
   * `extractResourceId` can file the entry against a vendor the History tab
   * knows how to look up. Keyed on the org-vendor id, the most important
   * lifecycle event in the module logged with a null resource id and appeared in
   * no timeline at all.
   */
  setStatus: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      vendorId: z.string().uuid(),
      status: z.enum(VENDOR_STATUSES),
      /** Art. 28(3)(g): the assurance that the data came back or was deleted. */
      deletionCertificateRef: z.string().max(255).nullable().optional(),
      /** Backdating a real offboarding date, rather than the day it was typed in. */
      offboardedAt: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, input.vendorId),
      ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const updates: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === VENDOR_STATUS_OFFBOARDED) {
        // Stamped once, on the transition. Re-stamping on every call meant that
        // typing a twenty-character certificate reference into the box next to
        // it — one mutation per keystroke — reset the recorded end-of-processing
        // date twenty times, so the Art. 28(3)(g) date became "whenever someone
        // last touched the form".
        if (input.offboardedAt !== undefined) {
          updates.offboardedAt = input.offboardedAt ? new Date(input.offboardedAt) : null;
        } else if (existing.status !== VENDOR_STATUS_OFFBOARDED || !existing.offboardedAt) {
          updates.offboardedAt = new Date();
        }
        if (input.deletionCertificateRef !== undefined) {
          updates.deletionCertificateRef = input.deletionCertificateRef || null;
        }
      } else {
        // Coming back from offboarding clears the end-of-processing record --
        // an active relationship cannot simultaneously carry one.
        updates.offboardedAt = null;
        updates.deletionCertificateRef = null;
      }

      const [updated] = await ctx.db.update(organizationVendors)
        .set(updates)
        .where(and(
          eq(organizationVendors.id, existing.id),
          eq(organizationVendors.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });
      return updated;
    }),

  /**
   * D30. Unlink — remove the vendor from this organisation's register without
   * touching the shared catalogue row or anyone else's register.
   *
   * **This refuses when the relationship carries evidence.** Four tables cascade
   * from `organization_vendors.id`: the completed questionnaires, the
   * questionnaire invitations, the Art. 28(2) sub-processor change log and the
   * incident alerts. A plain delete therefore destroyed exactly the material the
   * audit trail two procedures down exists to preserve — and `transfer_impact_
   * assessments.org_vendor_id` has no ON DELETE at all, so a vendor with a TIA
   * failed the delete with a foreign-key violation instead. Silently shredding
   * an Art. 28 file in one case and 500ing in the other are both wrong answers
   * to "we do not use this vendor any more"; the right one is `offboarded`,
   * which is what this points the caller at.
   *
   * What unlink is still for: the row added by mistake, or by a discovery scan,
   * that never accumulated anything.
   */
  unlinkVendor: protectedProcedure
    .use(requirePermission('vendors', 'delete'))
    .input(z.object({
      vendorId: z.string().uuid(),
      /**
       * Delete the evidence along with the link. Not a convenience flag — the UI
       * only offers it after naming what will be destroyed, because the caller
       * has to be the one who decides an Art. 28 record is disposable.
       */
      discardEvidence: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select()
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const evidence = await vendorEvidenceCounts(ctx.db, existing.id);
      const total = Object.values(evidence).reduce((sum, n) => sum + n, 0);

      if (total > 0 && !input.discardEvidence) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'This relationship holds assessment, sub-processor or transfer records. ' +
            'Offboard it to keep them as evidence, or confirm that they should be destroyed.',
          cause: evidence as unknown as Error,
        });
      }

      // Detaching the TIA explicitly rather than leaving it to the constraint.
      //
      // `transfer_impact_assessments.org_vendor_id` is ON DELETE SET NULL as of
      // migration 0053, which does exactly this — but it carried no clause at
      // all before that, and on a database where 0053 has not yet run the delete
      // below fails with a foreign-key violation the caller reads as an
      // unexplained 500. Doing it here costs one statement and makes the
      // intent legible at the call site: the assessment survives the unlink,
      // deliberately, because it is a document about a transfer that happened.
      if (total > 0) {
        await ctx.db.update(transferImpactAssessments)
          .set({ orgVendorId: null })
          .where(and(
            eq(transferImpactAssessments.orgVendorId, existing.id),
            eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
          ));
      }

      await ctx.db.delete(organizationVendors)
        .where(and(
          eq(organizationVendors.id, existing.id),
          eq(organizationVendors.organizationId, ctx.user!.orgId),
        ));

      if (orgEmbeddingsQueue) {
        await orgEmbeddingsQueue.add('embed-vendor', {
          orgId: ctx.user!.orgId,
          entityType: 'vendor',
          entityId: existing.id,
          action: 'delete'
        });
      }

      return { success: true, discarded: input.discardEvidence ? evidence : null };
    }),

  /**
   * What would be destroyed by unlinking. The modal asks before it offers the
   * button, so that "remove from register" is never the first time somebody
   * learns they are deleting three completed questionnaires.
   */
  unlinkImpact: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select({ id: organizationVendors.id })
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const evidence = await vendorEvidenceCounts(ctx.db, existing.id);
      return {
        ...evidence,
        total: Object.values(evidence).reduce((sum, n) => sum + n, 0),
      };
    }),

  /**
   * D33. The vendor record's audit trail, read from the same audit_logs table
   * every tRPC mutation already writes through the middleware in trpc.ts.
   *
   * A vendor's events are keyed two ways — the join-row id (a questionnaire, an
   * incident alert, a DPA analysis) and the catalogue id (everything the router
   * addresses by `vendorId`) — so both are matched. The action filter covers
   * `tia.*` as well as `vendors.*`: the Chapter V assessment is the reason a
   * transfer to that vendor is lawful, and a reader looking for it looks at the
   * vendor, not at a separate module.
   */
  history: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      vendorId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      // Prove the join row belongs to this organisation before reading its trail.
      const [ov] = await ctx.db.select({ id: organizationVendors.id })
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!ov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const filters: any[] = [vendorTrailFilter(ctx.user!.orgId, ov.id, input.vendorId)];

      if (input.cursor) {
        try {
          const { sortValue, id } = decodeCursor(input.cursor);
          const at = new Date(String(sortValue));
          if (Number.isNaN(at.getTime())) throw new Error('not a date');
          filters.push(or(
            lt(auditLogs.createdAt, at),
            and(eq(auditLogs.createdAt, at), lt(auditLogs.id, id)),
          ));
        } catch {
          // A cursor that cannot be read is an error, not "start again". Serving
          // page one instead means an infinite-scroll client that requests the
          // next page receives the first one, whose nextCursor is the same
          // unreadable token, and loops.
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid pagination cursor.' });
        }
      }

      const rows = await ctx.db.select().from(auditLogs)
        .where(and(...filters))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(input.limit + 1);

      const page = rows.slice(0, input.limit);
      const last = page[page.length - 1];

      return {
        entries: page.map((row: any) => ({
          ...row,
          renderedChanges: describeChanges(row.changes),
          changeType: changeTypeOf(row.action ?? ''),
        })),
        nextCursor: rows.length > input.limit && last && last.createdAt
          ? encodeCursor(last.createdAt, last.id)
          : null,
      };
    }),

  /**
   * The trail as a file. One row per changed field, same shape as the ROPA
   * trail export -- a regulator filters on a field name, not on a blob.
   */
  exportHistoryCsv: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [ov] = await ctx.db.select({ id: organizationVendors.id })
        .from(organizationVendors)
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));
      if (!ov) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const rows = await ctx.db.select().from(auditLogs)
        .where(vendorTrailFilter(ctx.user!.orgId, ov.id, input.vendorId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10000);

      const lines = (rows as any[]).flatMap((row): Array<Record<string, string>> => {
        const changes = describeChanges(row.changes);
        const base: Record<string, string> = {
          timestamp: row.createdAt ? new Date(row.createdAt).toISOString() : '',
          user: row.userEmail || 'system',
          action: row.action,
          description: row.description || '',
        };
        if (changes.length === 0) return [{ ...base, field: '', old_value: '', new_value: '' }];
        return changes.map((change) => ({
          ...base,
          field: change.label,
          old_value: change.before,
          new_value: change.after,
        }));
      });

      const headers = ['timestamp', 'user', 'action', 'description', 'field', 'old_value', 'new_value'];
      return {
        csv: csvDocument([headers, ...lines.map((l) => headers.map((h) => l[h] ?? ''))]),
        filename: `vendor-history-${input.vendorId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`,
      };
    }),

  /**
   * D40. Import the spreadsheet.
   *
   * Two phases against one procedure: `commit: false` parses, matches and
   * reports without writing, so the modal can show exactly what will happen; the
   * same call with `commit: true` writes it. The preview is the contract, which
   * is why it reports the columns it *ignored* as well as the rows it accepted —
   * a spreadsheet whose "Datenkategorien" column silently went nowhere is worse
   * than one that was rejected, because the register then looks complete.
   *
   * `enforceLimit` runs against the *net* additions once rows already linked are
   * excluded: re-importing last month's file must not consume plan headroom for
   * vendors the organisation already tracks.
   */
  importCsv: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      // Well under the Fastify body limit set in index.ts, with room for the
      // tRPC envelope and JSON string-escaping around it. A promise of 2 MB the
      // HTTP layer rejected at 1 MB surfaced as an unexplained 413.
      csv: z.string().min(1).max(600_000),
      hasHeader: z.boolean().default(true),
      commit: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const parsed = parseCsvRows(input.csv);
      if ('error' in parsed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: parsed.error });
      }
      const rows = parsed.rows;
      if (rows.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The file contains no data rows.' });
      }

      // Headerless files are rejected rather than guessed at: without a header
      // row there is no way to know which column is the vendor name, and
      // guessing wrong writes a register full of countries in the name column.
      if (!input.hasHeader) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'The file must include a header row (Name, Website, Category, ...).',
        });
      }

      const [headerRow, ...dataRows] = rows;
      const mapping = buildColumnMapping(headerRow ?? []);
      if (mapping.name === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No vendor name column found. Expected a header such as Name, Vendor or Supplier.',
        });
      }
      // Which headers went nowhere. Reported, never guessed at.
      const mappedIndices = new Set(Object.values(mapping));
      const ignoredColumns = (headerRow ?? [])
        .map((header, index) => ({ header: header.trim(), index }))
        .filter(({ header, index }) => header !== '' && !mappedIndices.has(index))
        .map(({ header }) => header);

      const catalogueRows = await ctx.db.select({
        id: vendors.id,
        name: vendors.name,
        website: vendors.website,
        aliases: vendors.aliases,
      })
        .from(vendors)
        .where(or(
          eq(vendors.isGlobal, true),
          // The organisation's own custom vendors are part of its catalogue for
          // matching purposes: without them, re-importing a spreadsheet creates
          // a second "Acme Ltd" beside the one the first import made.
          eq(vendors.organizationId, ctx.user!.orgId),
        ));
      // Built once. `matchCatalogue` used to re-parse every catalogue entry's
      // URL for every row, so a 500-row file against a 3,000-row catalogue
      // constructed 1.5 million URL objects to answer one question.
      const catalogue = buildCatalogueIndex(catalogueRows as CatalogueEntry[]);

      // Duplicate rows within one file, matched on the same key the catalogue
      // matcher uses. Two lines for "Slack" are one vendor, not a unique-index
      // violation halfway through the commit.
      const seenInFile = new Map<string, number>();

      const results = dataRows.map((cells, index) => {
        const rowNumber = index + 2; // header is row 1
        const normalised = normaliseVendorRow(cells, mapping);
        if ('error' in normalised) {
          return { rowNumber, ok: false as const, error: normalised.error };
        }
        const match = matchCatalogue(normalised.matchCandidate, catalogue);
        const accepted = match && match.confidence >= AUTO_LINK_THRESHOLD ? match : null;

        const dedupeKey = accepted
          ? `id:${accepted.vendorId}`
          : `name:${normalised.matchCandidate.domain ?? normalised.name.toLowerCase()}`;
        const firstSeenAt = seenInFile.get(dedupeKey);
        if (firstSeenAt !== undefined) {
          return {
            rowNumber,
            ok: false as const,
            error: `"${normalised.name}" is already on row ${firstSeenAt} of this file.`,
          };
        }
        seenInFile.set(dedupeKey, rowNumber);

        return {
          rowNumber,
          ok: true as const,
          name: normalised.name,
          website: normalised.website,
          category: normalised.category,
          headquartersCountry: normalised.headquartersCountry,
          purpose: normalised.purpose,
          dataCategoriesShared: normalised.dataCategoriesShared,
          businessOwner: normalised.businessOwner,
          contactEmail: normalised.contactEmail,
          criticality: normalised.criticality,
          warnings: normalised.warnings,
          match: accepted
            ? { vendorId: accepted.vendorId, confidence: accepted.confidence, method: accepted.method }
            : null,
          // A near-miss below the auto-link threshold is the single most useful
          // thing a human can adjudicate, so it is shown rather than discarded.
          nearMiss: !accepted && match
            ? { vendorId: match.vendorId, confidence: match.confidence, name: catalogue.byId.get(match.vendorId)?.name ?? '' }
            : null,
        };
      });

      const valid = results.filter((r): r is Extract<typeof r, { ok: true }> => r.ok === true);
      const errors = results
        .filter((r): r is Extract<typeof r, { ok: false }> => r.ok === false)
        .map((r) => ({ rowNumber: r.rowNumber, error: r.error }));

      const existingLinks = await ctx.db.select({ vendorId: organizationVendors.vendorId })
        .from(organizationVendors)
        .where(eq(organizationVendors.organizationId, ctx.user!.orgId));
      const linked = new Set(existingLinks.map((l) => l.vendorId));

      const plan = valid.map((row) => ({
        ...row,
        action: row.match
          ? (linked.has(row.match.vendorId) ? ('already_linked' as const) : ('link' as const))
          : ('create_custom' as const),
      }));
      const netAdditions = plan.filter((r) => r.action !== 'already_linked').length;

      if (!input.commit) {
        return {
          committed: false as const,
          total: dataRows.length,
          validCount: valid.length,
          netAdditions,
          errorCount: errors.length,
          ignoredColumns,
          errors,
          rows: plan,
        };
      }

      // ---- commit ------------------------------------------------------------
      if (netAdditions > 0) {
        await enforceLimit(ctx.db, ctx.user!.orgId, 'vendors', netAdditions);
      }

      const writable = plan.filter((r) => r.action !== 'already_linked');
      const skippedExisting = plan.length - writable.length;

      /**
       * One transaction for the whole file.
       *
       * Row-by-row commits left a half-imported register on any failure, with no
       * way to tell which half and no way to retry only the rest — and the
       * counters came back describing a state nobody could reconstruct. An
       * import either happened or it did not; that is the only shape a user can
       * reason about, and the only one they can safely repeat.
       */
      let created = 0;
      let relinked = 0;
      try {
        await ctx.db.transaction(async (tx: any) => {
          const toCreate = writable.filter((r) => !r.match);
          const createdIds = new Map<number, string>();

          if (toCreate.length > 0) {
            const inserted = await tx.insert(vendors).values(
              toCreate.map((row) => ({
                name: row.name,
                website: row.website,
                category: row.category,
                headquartersCountry: row.headquartersCountry,
                description: row.purpose,
                isGlobal: false,
                organizationId: ctx.user!.orgId,
              })),
            ).returning({ id: vendors.id });
            if (inserted.length !== toCreate.length) {
              throw new Error('The catalogue did not accept every new vendor.');
            }
            toCreate.forEach((row, i) => createdIds.set(row.rowNumber, inserted[i].id));
          }

          // Every catalogue row the links will need, in one read — the previous
          // version re-selected one row per import row, including rows it had
          // just inserted and already held.
          const targetIds = writable.map((row) => row.match?.vendorId ?? createdIds.get(row.rowNumber)!);
          const catalogueById = new Map<string, any>();
          if (targetIds.length > 0) {
            const full = await tx.select().from(vendors).where(inArray(vendors.id, targetIds));
            for (const v of full) catalogueById.set(v.id, v);
          }

          /**
           * The real sub-processor count per catalogue vendor, in one grouped
           * read.
           *
           * This was hardcoded to `0`, which made the same vendor score
           * differently depending on which door it came through: `linkVendor`
           * queries `vendorSubProcessors` and passes the count, so a vendor with
           * four known sub-processors takes the full 10/10 on chain depth there
           * and 0/10 when it arrives by spreadsheet. Importing a register — the
           * path the audit calls the biggest change to the first-run experience
           * — therefore understated the risk of exactly the vendors the
           * catalogue knows most about.
           *
           * Newly created custom vendors have none by construction and simply
           * miss from the map, which `?? 0` reads correctly.
           */
          const subCounts = new Map<string, number>();
          if (targetIds.length > 0) {
            const grouped = await tx.select({
              parentVendorId: vendorSubProcessors.parentVendorId,
              n: count(),
            })
              .from(vendorSubProcessors)
              .where(inArray(vendorSubProcessors.parentVendorId, targetIds))
              .groupBy(vendorSubProcessors.parentVendorId);
            for (const row of grouped) subCounts.set(row.parentVendorId, Number(row.n));
          }

          const links = writable.map((row) => {
            const targetVendorId = row.match?.vendorId ?? createdIds.get(row.rowNumber)!;
            const catalogueRow = catalogueById.get(targetVendorId);
            if (!catalogueRow) throw new Error(`Row ${row.rowNumber}: the catalogue entry could not be read back.`);

            const { score, level, factors } = calculateVendorRisk(
              catalogueRow,
              {
                dpaStatus: DPA_STATUS_MISSING[0],
                dataCategoriesShared: row.dataCategoriesShared,
                dataSubjectVolume: '<1K',
              },
              { ...NEW_LINK_RISK_INPUTS, subProcessorsCount: subCounts.get(targetVendorId) ?? 0 },
            );

            return {
              organizationId: ctx.user!.orgId,
              vendorId: targetVendorId,
              status: VENDOR_STATUS_ACTIVE,
              dpaStatus: DPA_STATUS_MISSING[0],
              businessOwner: row.businessOwner,
              contactEmail: row.contactEmail,
              criticality: row.criticality,
              // Not defaulted to 'processor'. The role decides which Article
              // applies, and a register that asserts every imported vendor is a
              // processor has answered a legal question on the customer's behalf
              // with the answer that happens to be commonest.
              processingRole: null,
              purpose: row.purpose,
              dataCategoriesShared: row.dataCategoriesShared,
              riskScore: score,
              riskLevel: level,
              riskFactors: factors,
              lastRiskAssessment: new Date(),
              addedBy: ctx.user!.id,
            };
          });

          if (links.length > 0) {
            await tx.insert(organizationVendors).values(links);
          }

          created = toCreate.length;
          relinked = writable.length - toCreate.length;
        });
      } catch (err: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `The import was rolled back and nothing was written: ${err.message ?? 'unknown error'}`,
        });
      }

      if (orgEmbeddingsQueue) {
        await orgEmbeddingsQueue.add('embed-org', { orgId: ctx.user!.orgId, entityType: 'vendor', action: 'upsert' });
      }

      return {
        committed: true as const,
        total: dataRows.length,
        created,
        relinked,
        skippedExisting,
        errorCount: errors.length,
        ignoredColumns,
        errors,
      };
    }),

  /**
   * D31. The review attestation, on its own.
   *
   * Separate from `updateOrgVendor` because reviewing is a statement about the
   * whole record — "I have looked at this and it is accurate today" — and not a
   * by-product of editing one field on it. When editing stamped the review date,
   * the overdue-review rule could be silenced by touching the notes box, which
   * is the compliance equivalent of marking your own homework.
   */
  attestReview: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({
      vendorId: z.string().uuid(),
      /** Months until the next review; null leaves the existing date alone. */
      nextReviewInMonths: z.number().int().min(1).max(60).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(organizationVendors).where(and(
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        eq(organizationVendors.vendorId, input.vendorId),
      ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });

      const now = new Date();
      const updates: any = { lastReviewedAt: now, updatedAt: now };
      if (input.nextReviewInMonths) {
        const next = new Date(now);
        next.setMonth(next.getMonth() + input.nextReviewInMonths);
        updates.nextReviewAt = next;
      }

      const [updated] = await ctx.db.update(organizationVendors)
        .set(updates)
        .where(and(
          eq(organizationVendors.id, existing.id),
          eq(organizationVendors.organizationId, ctx.user!.orgId),
        ))
        .returning();
      return updated;
    }),

  /**
   * Sprint 3 — Article 30(1)(d) Recipient Register Export.
   *
   * Produces the official statutory GDPR record of categories of recipients
   * to whom personal data have been or will be disclosed (CSV format).
   */
  exportArticle30Register: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const orgId = ctx.user!.orgId;
      const list = await ctx.db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(eq(organizationVendors.organizationId, orgId))
        .orderBy(vendors.name);

      const rows: Article30RecipientRow[] = list.map(({ orgVendor, vendor }) => {
        const dataCategories = (orgVendor.dataCategoriesShared as string[]) || [];
        const transferMechanisms = [
          ...((vendor.transferMechanisms as string[]) || []),
          ...((orgVendor.transferMechanisms as string[]) || []),
        ];
        return {
          vendorName: vendor.name,
          category: vendor.category || 'Uncategorised',
          processingRole: orgVendor.processingRole
            ? orgVendor.processingRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : 'Processor',
          purpose: orgVendor.purpose || 'Not specified',
          dataCategoriesShared: dataCategories,
          isSpecialCategory: hasSpecialCategory(dataCategories),
          headquartersCountry: vendor.headquartersCountry || 'Unknown',
          dataProcessingLocations: (vendor.dataProcessingLocations as string[]) || [],
          transferMechanisms,
          dpaStatus: orgVendor.dpaStatus || 'not_started',
          dpaSignedAt: orgVendor.dpaSignedAt ? orgVendor.dpaSignedAt.toISOString().split('T')[0] : undefined,
          businessOwner: orgVendor.businessOwner || undefined,
          criticality: orgVendor.criticality || 'medium',
          status: orgVendor.status || 'active',
        };
      });

      const csv = buildArticle30RecipientCsv(rows);
      return {
        csv,
        rowCount: rows.length,
        filename: `ropa_article_30_recipients_${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),

  /**
   * Sprint 3 — Article 28 Compliance Evidence Dossier Export.
   *
   * Produces a comprehensive evidence dossier detailing contractual terms,
   * verified clause citations, sub-processors, and transfer safeguards.
   */
  exportArticle28Dossier: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const [orgVendorRow] = await ctx.db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(
          and(
            eq(organizationVendors.organizationId, orgId),
            eq(organizationVendors.vendorId, input.vendorId)
          )
        );

      if (!orgVendorRow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor record not found for organisation' });
      }

      // Organisation, sub-processors, TIA and provenance are four independent
      // reads that the response below only assembles once all four are back.
      const [[org], subProcessors, [tia], provenanceRows] = await Promise.all([
        ctx.db.select().from(organizations).where(eq(organizations.id, orgId)),
        ctx.db
          .select()
          .from(vendorSubProcessorEntities)
          .where(eq(vendorSubProcessorEntities.parentVendorId, input.vendorId)),
        ctx.db
          .select()
          .from(transferImpactAssessments)
          .where(
            and(
              eq(transferImpactAssessments.organizationId, orgId),
              eq(transferImpactAssessments.vendorId, input.vendorId)
            )
          ),
        ctx.db
          .select()
          .from(vendorFieldProvenance)
          .where(eq(vendorFieldProvenance.vendorId, input.vendorId)),
      ]);

      /**
       * Sprint 10. The rows are still returned as they are stored, because a
       * surface showing "what did we override" needs the losers too — but each
       * one now carries what it is worth *today* rather than what it was worth
       * when it was gathered (VD-19), and `authoritative` says which row answers
       * for each field (VD-20).
       *
       * Both are computed here at read time and neither is written back: decay
       * is a function of `retrieved_at`, and a background pass that re-scored a
       * shared catalogue row on a timer is the mistake the ROPA register already
       * made once with `updated_at`.
       */
      const provenance = provenanceRows.map((row: any) => ({
        ...row,
        age: provenanceAge(row),
      }));
      const authoritative = selectAuthoritativeProvenance(provenanceRows, { scope: 'catalogue' });

      const v = orgVendorRow.vendor;
      const ov = orgVendorRow.orgVendor;

      const rawCoverage = (ov.dpaClauseCoverage as any) || {};
      const catalogueAnalysis = v.dpaClauseAnalysis?.clauses || {};

      const clauseCoverage: Record<string, { status: 'present' | 'weak' | 'missing'; excerpt?: string; citation?: string }> = {};
      const clauseKeys = [
        'documentedInstructions',
        'confidentiality',
        'securityMeasures',
        'subProcessorRestrictions',
        'dataSubjectRights',
        'securityBreachDpia',
        'deletionOnTermination',
        'auditRights',
      ];

      for (const key of clauseKeys) {
        if (rawCoverage[key]) {
          const cat = catalogueAnalysis[key];
          clauseCoverage[key] = {
            status: cat?.status || 'present',
            excerpt: cat?.excerpt,
            citation: ARTICLE_28_DEFINITIONS[key as Article28ClauseKey]?.articleRef || 'Art. 28(3)',
          };
        } else {
          clauseCoverage[key] = { status: 'missing' };
        }
      }

      const dossierData: Article28DossierData = {
        organizationName: org?.name || 'Organisation',
        generatedAt: new Date().toISOString().split('T')[0] ?? '',
        vendor: {
          name: v.name,
          website: v.website || undefined,
          category: v.category || undefined,
          headquartersCountry: v.headquartersCountry || undefined,
          businessOwner: ov.businessOwner || undefined,
          contactEmail: ov.contactEmail || undefined,
          criticality: ov.criticality || undefined,
          processingRole: ov.processingRole || undefined,
          dpaStatus: ov.dpaStatus || 'not_started',
          dpaSignedAt: ov.dpaSignedAt ? ov.dpaSignedAt.toISOString().split('T')[0] : undefined,
          dpaExpiresAt: ov.dpaExpiresAt ? ov.dpaExpiresAt.toISOString().split('T')[0] : undefined,
          deletionCertificateRef: ov.deletionCertificateRef || undefined,
          lastReviewedAt: ov.lastReviewedAt ? ov.lastReviewedAt.toISOString().split('T')[0] : undefined,
          nextReviewAt: ov.nextReviewAt ? ov.nextReviewAt.toISOString().split('T')[0] : undefined,
        },
        clauseCoverage,
        subProcessors: subProcessors.map((sp) => ({
          name: sp.name,
          service: sp.service || undefined,
          country: sp.country || undefined,
          website: sp.website || undefined,
        })),
        transfers: {
          destinationCountry: v.headquartersCountry || undefined,
          mechanisms: [
            ...((v.transferMechanisms as string[]) || []),
            ...((ov.transferMechanisms as string[]) || []),
          ],
          tiaStatus: tia?.status || (ov.tiaCompleted ? 'Completed' : ov.tiaRequired ? 'Required' : 'Not required'),
          tiaConclusion: tia?.conclusion || undefined,
        },
        provenance: provenance.map((p: any) => ({
          fieldName: p.fieldName,
          sourceType: p.sourceType,
          confidence: p.age.confidence,
          confidenceWhenGathered: p.age.originalConfidence,
          stale: p.age.stale,
          authoritative: authoritative.some((f) => f.row === p || (f.fieldName === p.fieldName && f.row.retrievedAt === p.retrievedAt && f.row.sourceType === p.sourceType)),
          retrievedAt: p.retrievedAt ? p.retrievedAt.toISOString().split('T')[0]! : '',
          sourceUrl: p.sourceUrl || undefined,
        })),
      };

      const markdown = buildArticle28DossierMarkdown(dossierData);
      const slug = v.slug || v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        markdown,
        filename: `article28_dossier_${slug}_${new Date().toISOString().split('T')[0]}.md`,
      };
    }),

  /**
   * Sprint 3 — Standard GDPR Article 28 DPA Agreement Generator.
   */
  generateDpaAgreement: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const [orgVendorRow] = await ctx.db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(
          and(
            eq(organizationVendors.organizationId, orgId),
            eq(organizationVendors.vendorId, input.vendorId)
          )
        );

      if (!orgVendorRow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor record not found' });
      }

      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, orgId));
      const v = orgVendorRow.vendor;
      const ov = orgVendorRow.orgVendor;

      const subProcessors = await ctx.db
        .select()
        .from(vendorSubProcessorEntities)
        .where(eq(vendorSubProcessorEntities.parentVendorId, input.vendorId));

      const dpaMarkdown = generateStandardArticle28Dpa({
        controllerName: org?.name || 'Organisation',
        controllerContactEmail: (org?.settings as any)?.dpoEmail || undefined,
        processorName: v.name,
        processorContactEmail: ov.contactEmail || undefined,
        purposeOfProcessing: ov.purpose || undefined,
        dataCategories: (ov.dataCategoriesShared as string[]) || undefined,
        authorizedSubProcessors: subProcessors.map((sp) => ({
          name: sp.name,
          country: sp.country || undefined,
          service: sp.service || undefined,
        })),
      });

      const slug = v.slug || v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        dpaMarkdown,
        filename: `dpa_agreement_${slug}.md`,
      };
    }),

  /**
   * Sprint 3 — Schedule vendor review cadence.
   */
  scheduleReview: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(
      z.object({
        vendorId: z.string().uuid(),
        cadence: z.enum(['quarterly', 'biannual', 'annual']).optional(),
        customDate: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(organizationVendors)
        .where(
          and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            eq(organizationVendors.vendorId, input.vendorId)
          )
        );

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });
      }

      const nextReviewAt = input.customDate
        ? new Date(input.customDate)
        : calculateNextReviewDate(new Date(), existing.criticality, input.cadence);

      const [updated] = await ctx.db
        .update(organizationVendors)
        .set({
          reviewCadence: input.cadence || existing.reviewCadence || 'annual',
          nextReviewAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationVendors.id, existing.id),
            eq(organizationVendors.organizationId, ctx.user!.orgId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Sprint 3 — Apply pre-analysed catalogue Article 28(3) DPA clauses to tenant record.
   */
  applyCatalogueDpaAnalysis: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(
          and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            eq(organizationVendors.vendorId, input.vendorId)
          )
        );

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });
      }

      const catAnalysis = existing.vendor.dpaClauseAnalysis;
      if (!catAnalysis || !catAnalysis.clauses) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No pre-analysed catalogue DPA clauses available for this vendor',
        });
      }

      const clauseCoverage: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(catAnalysis.clauses)) {
        clauseCoverage[k] = v.status === 'present' || v.status === 'weak';
      }

      const [updated] = await ctx.db
        .update(organizationVendors)
        .set({
          dpaClauseCoverage: clauseCoverage,
          dpaAiAnalysis: catAnalysis,
          dpaAnalysisStatus: 'completed',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationVendors.id, existing.orgVendor.id),
            eq(organizationVendors.organizationId, ctx.user!.orgId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Sprint 4 — Supply Chain Graph & 4th-Party Vendor Concentration Analytics.
   */
  getConcentrationAnalytics: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      return await calculateConcentrationAnalytics(
        ctx.db,
        ctx.user!.orgId,
        { organizationVendors, vendors, vendorSubProcessors, vendorSubProcessorEntities },
        liveVendorPredicate()
      );
    }),

  /**
   * Sprint 4 — Ingest Trust Centre telemetry, update security posture & provenance.
   */
  ingestTrustCenter: protectedProcedure
    .use(requirePermission('vendors', 'edit'))
    .input(
      z.object({
        vendorId: z.string().uuid(),
        trustCenterUrl: z.string().url().optional(),
        rawContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(
          and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            eq(organizationVendors.vendorId, input.vendorId)
          )
        );

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });
      }

      let contentToParse = input.rawContent || '';
      const url = input.trustCenterUrl || existing.vendor.website || undefined;

      if (!contentToParse.trim() && input.trustCenterUrl) {
        try {
          // Through `safeFetch`, not bare `fetch`: this is a URL the caller chose
          // and the backend is being asked to open. The API process also hosts every
          // worker, so an unchecked fetch here reaches the cloud metadata endpoint
          // and anything else bound inside the container.
          const res = await safeFetch(input.trustCenterUrl, {
            headers: { 'User-Agent': 'CustodiaVendorIntelligence/1.0' },
            timeoutMs: 6000,
          });
          if (res.ok) {
            // This was the only one of the three copies that removed script and
            // style bodies as well as tags, so it is the shape `htmlToText` took.
            contentToParse = htmlToText(res.body);
          }
        } catch (err) {
          // A refused destination is the caller's mistake and worth saying so; any
          // other failure falls back to URL-based parsing as before.
          if (err instanceof BlockedRequestError) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `That trust-centre URL could not be fetched: ${err.message}`,
            });
          }
        }
      }

      const profile = parseTrustCenterProfile({
        url,
        rawContent: contentToParse,
        vendorName: existing.vendor.name,
      });

      /*
       * This used to write `profile.euHostingAvailable` straight onto the shared
       * `vendors` row. The content it is derived from is whatever this tenant
       * supplied — `rawContent` is free text they pasted and nothing verifies it —
       * so one organisation could flip a catalogue flag for every other tenant. That
       * matters beyond display: `vendorCrossCheck` reads `euHostingAvailable` when
       * it decides whether a US vendor is contradicting its own EU-hosting claim, so
       * poisoning it suppressed a contradiction, and therefore lowered a risk score,
       * in registers belonging to other customers.
       *
       * The tenancy guard cannot catch this and is not at fault: the vendor id was
       * pinned by an org-scoped read, which is exactly the proof pass 2 accepts. The
       * guard establishes "you have this vendor linked", never "this row is yours".
       *
       * A trust-centre reading is now evidence for *this* relationship. Promoting it
       * to the catalogue is what `vendor_candidates` and the review console exist
       * for, and it belongs behind that human step.
       */
      if (profile.euHostingAvailable !== undefined) {
        await ctx.db
          .update(organizationVendors)
          .set({ trustCentreEuHosting: profile.euHostingAvailable })
          .where(eq(organizationVendors.id, existing.orgVendor.id));
      }

      // Merge certifications
      const existingCerts = existing.orgVendor.certifications || existing.vendor.securityCertifications || [];
      const combinedCerts = Array.from(new Set([...existingCerts, ...profile.certifications]));

      // Preserve tenant's usingEuHosting (do not auto-overwrite tenant datacentre choice)
      const [updatedOrgVendor] = await ctx.db
        .update(organizationVendors)
        .set({
          certifications: combinedCerts,
          dpaStatus: profile.dpaAvailable && existing.orgVendor.dpaStatus === 'not_started' ? 'requested' : existing.orgVendor.dpaStatus,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationVendors.id, existing.orgVendor.id),
            eq(organizationVendors.organizationId, ctx.user!.orgId)
          )
        )
        .returning();

      // Upsert field provenance rows for transparency. One row per field, and the
      // conflict target is keyed on the field name, so no two of these contend for
      // the same row.
      await Promise.all(Object.entries(profile.evidenceSnippets).map(([key, snippet]) =>
        ctx.db
          .insert(vendorFieldProvenance)
          .values({
            vendorId: existing.vendor.id,
            fieldName: key,
            value: snippet,
            sourceType: 'trust_centre',
            sourceUrl: url,
            confidence: profile.confidence,
            evidenceSnippet: snippet,
            verifiedBy: ctx.user!.id || 'Trust Center Importer',
            verifiedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              vendorFieldProvenance.vendorId,
              vendorFieldProvenance.fieldName,
              vendorFieldProvenance.sourceType,
            ],
            set: {
              value: snippet,
              sourceType: 'trust_centre',
              sourceUrl: url,
              confidence: profile.confidence,
              evidenceSnippet: snippet,
              verifiedBy: ctx.user!.id || 'Trust Center Importer',
              verifiedAt: new Date(),
            },
          })
      ));

      await updateVendorRiskScore(ctx.db, ctx.user!.orgId, input.vendorId);

      return {
        profile,
        orgVendor: updatedOrgVendor,
      };
    }),

  /**
   * Sprint 4 — Multi-factor Discrepancy & Contradiction Detection.
   */
  getDiscrepancies: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(
      z
        .object({
          vendorId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(organizationVendors.organizationId, ctx.user!.orgId),
        liveVendorPredicate(),
      ];
      if (input?.vendorId) {
        conditions.push(eq(organizationVendors.vendorId, input.vendorId));
      }

      const orgVendors = await ctx.db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(and(...conditions));

      if (!orgVendors || orgVendors.length === 0) {
        return [];
      }

      const orgVendorIds = orgVendors.map((ov: any) => ov.orgVendor.id);
      const vendorIds = orgVendors.map((ov: any) => ov.vendor.id);

      // Completed assessments and both sub-processor tables: independent reads
      // over the same vendor set, so they race rather than queue.
      const [assessmentsList, legacySubs, entitySubs] = await Promise.all([
        ctx.db
          .select()
          .from(vendorAssessments)
          .where(
            and(
              eq(vendorAssessments.organizationId, ctx.user!.orgId),
              inArray(vendorAssessments.vendorId, orgVendorIds)
            )
          ),
        ctx.db.select().from(vendorSubProcessors).where(inArray(vendorSubProcessors.parentVendorId, vendorIds)),
        ctx.db.select().from(vendorSubProcessorEntities).where(inArray(vendorSubProcessorEntities.parentVendorId, vendorIds)),
      ]);

      const subMap = new Map<string, Array<{ name: string; country?: string | null; service?: string | null }>>();
      for (const s of [...(legacySubs || []), ...(entitySubs || [])]) {
        if (!s.parentVendorId || !s.name) continue;
        let list = subMap.get(s.parentVendorId);
        if (!list) {
          list = [];
          subMap.set(s.parentVendorId, list);
        }
        list.push({ name: s.name, country: s.country, service: s.service });
      }

      // VD-8. Only the registrations these vendors could match, not the
      // whole registry — this is a per-request query on a table that is now
      // 16,534 rows.
      const dpfEntries = await loadDpfEntriesFor(
        ctx.db,
        orgVendors.map((ov: any) => ({ name: dpfLookupName(ov.vendor), website: ov.vendor.website })),
      );

      const results: Array<{
        vendorId: string;
        orgVendorId: string;
        vendorName: string;
        discrepancies: ReturnType<typeof crossCheckVendorResponses>;
        riskPenalty: number;
      }> = [];

      for (const ov of orgVendors) {
        const assessment = assessmentsList.find((a: any) => a.vendorId === ov.orgVendor.id);
        const subProcessors = subMap.get(ov.vendor.id) || [];

        let dpfStatus: DpfMatchStatus | 'none' = 'none';
        if (ov.vendor.headquartersCountry === 'US') {
          const match = matchDpfStatus(dpfLookupName(ov.vendor), ov.vendor.website, dpfEntries);
          if (match.status !== 'not_found') dpfStatus = match.status;
        }

        const responses = (assessment?.responses as Record<string, any>) || {};
        const questionsSnapshot = (assessment?.questionsSnapshot as any[]) || [];

        const discrepancies = crossCheckVendorResponses({
          vendorName: ov.vendor.name,
          vendorCountry: ov.vendor.headquartersCountry,
          euHostingAvailable: ov.vendor.euHostingAvailable,
          usingEuHosting: ov.orgVendor.usingEuHosting,
          securityCertifications: (ov.orgVendor.certifications as string[]) || (ov.vendor.securityCertifications as string[]) || [],
          dpfStatus,
          subProcessors,
          dpaClauseAnalysis: ov.vendor.dpaClauseAnalysis,
          questionsSnapshot,
          responses,
        });

        if (discrepancies.length > 0) {
          results.push({
            vendorId: ov.vendor.id,
            orgVendorId: ov.orgVendor.id,
            vendorName: ov.vendor.name,
            discrepancies,
            riskPenalty: calculateDiscrepancyRiskPenalty(discrepancies),
          });
        }
      }

      return results;
    }),

  /**
   * Sprint 4 — Cross-Customer Anonymous Privacy Benchmarking (k-anonymity >= 5).
   */
  getAggregatedBenchmark: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await getVendorBenchmarkStats(
        ctx.db,
        input.vendorId,
        { organizationVendors, vendors },
        liveVendorPredicate()
      );
    }),

  /**
   * Sprint 4 — European Regulatory Enforcement Decisions feed mapped to active vendors.
   */
  getEnforcementFeed: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .query(async ({ ctx }) => {
      const orgVendors = await ctx.db
        .select({
          id: organizationVendors.id,
          name: vendors.name,
          website: vendors.website,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(
          and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            liveVendorPredicate()
          )
        );

      return matchRegulatoryDecisions(orgVendors || []);
    }),
});

