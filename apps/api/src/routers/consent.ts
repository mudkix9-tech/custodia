import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
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
      const [domain] = await db.select().from(consentDomains).where(eq(consentDomains.id, input.id));
      if (!domain) return null;
      
      const cookies = await db.select().from(consentCookies).where(eq(consentCookies.domainId, domain.id));
      
      // Basic stats
      const result = await db.select({ total: count() }).from(consentRecords).where(eq(consentRecords.domainId, domain.id));
      const total = result[0]?.total ?? 0;
      
      return { domain, cookies, stats: { total } };
    }),

  createDomain: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ domain: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const scriptId = Math.random().toString(36).substring(2, 10);
      const [domain] = await db.insert(consentDomains).values({
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
      const [updated] = await db.update(consentDomains)
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
});
