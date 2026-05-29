import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, users, processingActivities, vendors } from 'db';
import { eq, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const groupRouter = router({
  listChildOrgs: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user || !ctx.user.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Check if user is a group admin or if this org is a parent
      const [currentUser] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (currentUser?.organizationGroupRole !== 'group_admin') {
         throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a group admin' });
      }

      const childOrgs = await db.select().from(organizations)
        .where(or(
            eq(organizations.parentOrganizationId, ctx.user.orgId),
            eq(organizations.id, ctx.user.orgId) // Include the parent org itself
        ));

      return childOrgs;
    }),

  getGroupDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      // Mock aggregated data
      return {
        aggregatedScore: 85,
        totalGaps: 12,
        totalActivities: 45,
        totalVendors: 28,
        totalEntities: 3,
      };
    }),

  getGroupGaps: protectedProcedure
    .query(async ({ ctx }) => {
       // Mock unified gap list
       return [
         { id: '1', title: 'Missing DPA with AWS', entity: 'Subsidiary A', severity: 'high' },
         { id: '2', title: 'No RoPA for HR data', entity: 'Main Org', severity: 'medium' },
       ];
    }),

  generateGroupAuditFile: protectedProcedure
    .mutation(async ({ ctx }) => {
       // Mock export
       return { url: '/exports/group-audit-report.pdf' };
    })
});
