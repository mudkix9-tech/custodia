import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { z } from 'zod';
import {
  consentDomains,
  consentCookies,
  consentRecords,
  consentFindings,
  consentScanRuns,
  consentTrackerObservations,
  vendors,
} from 'db';
import { and, count, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { paginatedQuery } from '../utils/pagination.js';
import { TRPCError } from '@trpc/server';
import { cmpJobsQueue } from '../workers/cmp.js';
import { consentScanQueue } from '../workers/consentScan.js';
import { enforceLimit } from '../lib/billing.js';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

/**
 * Every reconciliation read is keyed on a domain id supplied by the client, so the
 * domain has to be proved to belong to the caller's organisation before anything
 * hanging off it is returned.
 */
const assertDomainInOrg = async (ctx: any, domainId: string) => {
  const [domain] = await ctx.db
    .select()
    .from(consentDomains)
    .where(and(
      eq(consentDomains.id, domainId),
      eq(consentDomains.organizationId, ctx.user!.orgId),
    ));
  if (!domain) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domain not found' });
  return domain;
};

/** Worst first, so a critical is never buried under a page of info rows. */
const SEVERITY_ORDER = sql`CASE ${consentFindings.severity}
  WHEN 'critical' THEN 0
  WHEN 'high' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'low' THEN 3
  ELSE 4 END`;

const VENDOR_COLUMNS = {
  id: vendors.id,
  name: vendors.name,
  slug: vendors.slug,
  logoUrl: vendors.logoUrl,
};

export const consentRouter = router({
  listDomains: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      return paginatedQuery(
        consentDomains,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );
    }),

  getDomain: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [domain] = await ctx.db
        .select()
        .from(consentDomains)
        .where(and(
          eq(consentDomains.id, input.id),
          eq(consentDomains.organizationId, ctx.user!.orgId),
        ));
      if (!domain) return null;
      
      const cookies = await ctx.db.select().from(consentCookies).where(eq(consentCookies.domainId, domain.id));
      
      // Basic stats
      const result = await ctx.db.select({ total: count() }).from(consentRecords).where(eq(consentRecords.domainId, domain.id));
      const total = result[0]?.total ?? 0;
      
      return { domain, cookies, stats: { total } };
    }),

  createDomain: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ domain: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await enforceLimit(ctx.db, ctx.user!.orgId, 'domains', 1);
      const scriptId = Math.random().toString(36).substring(2, 10);
      const [domain] = await ctx.db.insert(consentDomains).values({
        organizationId: ctx.user!.orgId,
        domain: input.domain,
        scriptId,
      }).returning();
      return domain;
    }),

  updateBannerConfig: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ id: z.string().uuid(), config: z.any() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(consentDomains)
        .set({ bannerConfig: input.config })
        .where(and(
          eq(consentDomains.id, input.id),
          eq(consentDomains.organizationId, ctx.user!.orgId),
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domain not found' });
      return updated;
    }),

  scanCookies: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ domainId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      // Kick off the Puppeteer scanner
      await cmpJobsQueue.add('cookie-scanner', { 
        domainId: input.domainId,
        correlationId: (ctx.req as any).correlationId 
      });
      return { success: true, message: 'Scan queued' };
    }),

  getAnalytics: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      domainId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      // Validate access bounds
      const orgDomains = await ctx.db.select({ id: consentDomains.id }).from(consentDomains).where(eq(consentDomains.organizationId, ctx.user!.orgId));
      const orgDomainIds = orgDomains.map((d: any) => d.id);

      let targetDomainIds = orgDomainIds;

      if (input.domainId) {
        if (!orgDomainIds.includes(input.domainId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Domain does not belong to organization' });
        }
        targetDomainIds = [input.domainId];
      }

      if (targetDomainIds.length === 0) {
         // Return empty structures if no domains
         return {
           optInRateOverTime: [],
           interactionBreakdown: { acceptAll: 0, rejectAll: 0, customizedWithAcceptance: 0, customizedAllRejected: 0 },
           domainBreakdown: [],
           categoryRejection: { analyticsRejected: 0, marketingRejected: 0, functionalRejected: 0 },
           withdrawalMetrics: { withdrawalTrend: [], withdrawalVolume: 0, relativeVolumePercent: 0, avgTimeToWithdrawalHours: null },
           granularCategoryDistribution: []
         };
      }

      const { getOptInRateOverTime, getInteractionBreakdown, getDomainBreakdown, getCategoryRejection, getWithdrawalMetrics, getGranularCategoryDistribution } = await import('../lib/consentAnalytics.js');

      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

      const [optInRateOverTime, interactionBreakdown, domainBreakdown, categoryRejection, withdrawalMetrics, granularCategoryDistribution] = await Promise.all([
        getOptInRateOverTime(ctx.db, targetDomainIds, start, end),
        getInteractionBreakdown(ctx.db, targetDomainIds, start, end),
        getDomainBreakdown(ctx.db, targetDomainIds, start, end),
        getCategoryRejection(ctx.db, targetDomainIds, start, end),
        getWithdrawalMetrics(ctx.db, targetDomainIds, start, end),
        getGranularCategoryDistribution(ctx.db, targetDomainIds, start, end)
      ]);

      return {
        optInRateOverTime,
        interactionBreakdown,
        domainBreakdown,
        categoryRejection,
        withdrawalMetrics,
        granularCategoryDistribution
      };
    }),
  // -------------------------------------------------------------------------
  // Consent / tracker reconciliation
  //
  // Read-only over what workers/consentScan.ts persisted, apart from resolving a
  // finding and triggering a re-run. The evaluator decides what counts as a
  // problem; this layer only decides what the customer is shown.
  // -------------------------------------------------------------------------

  listFindings: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      domainId: z.string().uuid(),
      state: z.enum(['open', 'resolved', 'dismissed', 'false_positive']).optional(),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
      includeInfo: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertDomainInOrg(ctx, input.domainId);

      const conditions = [
        eq(consentFindings.domainId, input.domainId),
        eq(consentFindings.organizationId, ctx.user!.orgId),
      ];
      if (input.state) conditions.push(eq(consentFindings.state, input.state));
      if (input.severity) conditions.push(eq(consentFindings.severity, input.severity));
      // consent_mode_only is recorded as evidence of correct behaviour rather than
      // as a problem, so it is filterable instead of always present.
      if (!input.severity && !input.includeInfo) {
        conditions.push(ne(consentFindings.severity, 'info'));
      }

      return ctx.db
        .select({ finding: consentFindings, vendor: VENDOR_COLUMNS })
        .from(consentFindings)
        .leftJoin(vendors, eq(consentFindings.matchedVendorId, vendors.id))
        .where(and(...conditions))
        .orderBy(SEVERITY_ORDER, desc(consentFindings.lastSeenAt));
    }),

  getFinding: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const [row] = await ctx.db
        .select({ finding: consentFindings, vendor: VENDOR_COLUMNS })
        .from(consentFindings)
        .leftJoin(vendors, eq(consentFindings.matchedVendorId, vendors.id))
        .where(and(
          eq(consentFindings.id, input.id),
          eq(consentFindings.organizationId, ctx.user!.orgId),
        ));

      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Finding not found' });
      const finding = row.finding;

      // The observations that justify the claim, taken from the run that last saw
      // it, so what the customer reads is what that dated scan actually recorded.
      let observations: any[] = [];
      if (finding.lastScanRunId) {
        const affectedHosts: string[] = Array.isArray((finding.evidence as any)?.affectedHosts)
          ? (finding.evidence as any).affectedHosts
          : [];

        const conditions = [eq(consentTrackerObservations.scanRunId, finding.lastScanRunId)];
        if (finding.observedHost) {
          conditions.push(eq(consentTrackerObservations.observedHost, finding.observedHost));
        } else if (affectedHosts.length > 0) {
          // Domain-level findings carry no host of their own; they name the hosts
          // they are about in the evidence instead.
          conditions.push(inArray(consentTrackerObservations.observedHost, affectedHosts));
        } else {
          conditions.push(isNotNull(consentTrackerObservations.trackerKey));
        }

        observations = await ctx.db
          .select()
          .from(consentTrackerObservations)
          .where(and(...conditions))
          .orderBy(consentTrackerObservations.pass, consentTrackerObservations.observedHost)
          .limit(200);
      }

      const [lastRun] = finding.lastScanRunId
        ? await ctx.db
            .select()
            .from(consentScanRuns)
            .where(eq(consentScanRuns.id, finding.lastScanRunId))
        : [];

      return { finding, vendor: row.vendor, observations, lastRun: lastRun ?? null };
    }),

  resolveFinding: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      // 'open' reopens a dismissal. A scan only ever reopens what it resolved
      // itself, so without this a mistaken dismissal would be permanent.
      resolution: z.enum(['dismissed', 'false_positive', 'open']),
      note: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const reopening = input.resolution === 'open';
      const [updated] = await ctx.db
        .update(consentFindings)
        .set({
          state: input.resolution,
          resolutionNote: input.note ?? null,
          resolvedAt: reopening ? null : new Date(),
          resolvedBy: reopening ? null : ctx.user!.id,
        })
        .where(and(
          eq(consentFindings.id, input.id),
          eq(consentFindings.organizationId, ctx.user!.orgId),
        ))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Finding not found' });
      return updated;
    }),

  runReconciliation: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ domainId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertDomainInOrg(ctx, input.domainId);

      await consentScanQueue.add(
        'reconcile-domain',
        { domainId: input.domainId, correlationId: (ctx.req as any)?.correlationId },
        // Two Puppeteer passes on a single-concurrency cluster; one queued scan per
        // domain is enough, and repeated clicks must not stack them up.
        { singletonKey: input.domainId },
      );

      return { success: true, message: 'Reconciliation scan queued' };
    }),

  getScanRuns: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({
      domainId: z.string().uuid(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertDomainInOrg(ctx, input.domainId);

      return ctx.db
        .select()
        .from(consentScanRuns)
        .where(and(
          eq(consentScanRuns.domainId, input.domainId),
          eq(consentScanRuns.organizationId, ctx.user!.orgId),
        ))
        .orderBy(desc(consentScanRuns.startedAt))
        .limit(input.limit);
    }),

  /**
   * The Coverage panel: what the banner declares, against what the last good scan
   * actually saw. Assembled here rather than in the client so the comparison is
   * made once, against the same run the findings were drawn from.
   */
  getCoverage: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ domainId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const domain = await assertDomainInOrg(ctx, input.domainId);
      const declaredCategories = ((domain.categories ?? []) as string[]);

      const severityRows = await ctx.db
        .select({ severity: consentFindings.severity, total: sql<number>`count(*)::int` })
        .from(consentFindings)
        .where(and(
          eq(consentFindings.domainId, input.domainId),
          eq(consentFindings.state, 'open'),
        ))
        .groupBy(consentFindings.severity);

      const severityCounts: Record<string, number> =
        { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const row of severityRows) {
        if (row.severity in severityCounts) severityCounts[row.severity] = row.total;
      }

      const [lastRun] = await ctx.db
        .select()
        .from(consentScanRuns)
        .where(and(
          eq(consentScanRuns.domainId, input.domainId),
          eq(consentScanRuns.status, 'ok'),
        ))
        .orderBy(desc(consentScanRuns.startedAt))
        .limit(1);

      if (!lastRun) {
        return {
          declaredCategories,
          lastRun: null,
          categories: [] as any[],
          severityCounts,
          unmatchedHostCount: 0,
        };
      }

      const observations = await ctx.db
        .select()
        .from(consentTrackerObservations)
        .where(eq(consentTrackerObservations.scanRunId, lastRun.id));

      // One row per tracker, folded across both passes. What makes a tracker
      // interesting is when it fires and whether it carried an identifier, and
      // that is a property of the pair of passes rather than of either alone.
      const trackers = new Map<string, any>();
      let unmatchedHostCount = 0;

      for (const observation of observations) {
        if (!observation.trackerKey) {
          if (observation.pass === 'pre_consent') unmatchedHostCount += 1;
          continue;
        }

        const existing = trackers.get(observation.trackerKey) ?? {
          trackerKey: observation.trackerKey,
          provider: observation.provider,
          requiredCategory: observation.requiredCategory,
          matchedVendorId: observation.matchedVendorId,
          hosts: [] as string[],
          firesPreConsent: false,
          identifiersPreConsent: false,
          firesPostConsent: false,
          consentSignal: null as string | null,
          requestCount: 0,
        };

        if (!existing.hosts.includes(observation.observedHost)) {
          existing.hosts.push(observation.observedHost);
        }
        existing.requestCount += observation.requestCount ?? 1;

        if (observation.pass === 'pre_consent') {
          existing.firesPreConsent = true;
          if (observation.carriedIdentifiers) existing.identifiersPreConsent = true;
          // The pre-consent signal is what separates a Consent Mode ping from an
          // ungated tag, so it is the one worth surfacing.
          if (observation.consentSignal) existing.consentSignal = observation.consentSignal;
        } else {
          existing.firesPostConsent = true;
        }

        trackers.set(observation.trackerKey, existing);
      }

      const byCategory = new Map<string, any[]>();
      for (const tracker of trackers.values()) {
        const category = tracker.requiredCategory ?? 'uncategorized';
        const bucket = byCategory.get(category) ?? [];
        bucket.push(tracker);
        byCategory.set(category, bucket);
      }

      // A declared category with nothing observed still belongs in the table: an
      // offered category no tracker needs is as much a mismatch as the reverse,
      // just a harmless one.
      const allCategories = new Set<string>([...declaredCategories, ...byCategory.keys()]);

      const categories = Array.from(allCategories)
        .map(category => ({
          category,
          declared: declaredCategories.includes(category),
          trackers: (byCategory.get(category) ?? []).sort((a, b) =>
            a.trackerKey.localeCompare(b.trackerKey)
          ),
        }))
        .sort((a, b) => {
          // An undeclared category carrying trackers is the whole point; float it up.
          const aGap = !a.declared && a.trackers.length > 0;
          const bGap = !b.declared && b.trackers.length > 0;
          if (aGap !== bGap) return aGap ? -1 : 1;
          return a.category.localeCompare(b.category);
        });

      return { declaredCategories, lastRun, categories, severityCounts, unmatchedHostCount };
    }),
});
