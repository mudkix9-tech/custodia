import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { z } from 'zod';
import { consentDomains, consentCookies, consentRecords } from 'db';
import { eq, count } from 'drizzle-orm';
import { paginatedQuery } from '../utils/pagination.js';
import { TRPCError } from '@trpc/server';
import { cmpJobsQueue } from '../workers/cmp.js';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
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
      const [domain] = await ctx.db.select().from(consentDomains).where(eq(consentDomains.id, input.id));
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
        .where(eq(consentDomains.id, input.id))
        .returning();
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
});
