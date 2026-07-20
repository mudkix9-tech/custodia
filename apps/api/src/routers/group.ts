import { z } from 'zod';
import { router, protectedProcedure, verifyGroupScopeAndLog } from '../trpc.js';
import { dataExportQueue } from '../lib/queue.js';
import { computeGroupComplianceScores, computeGroupVendorConsistency } from '../lib/groupMetrics.js';
import { db } from '../db.js';
import { organizations, users, processingActivities, vendors, complianceReports, organizationVendors } from 'db';
import { eq, or, inArray, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const groupRouter = router({
  listChildOrgs: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user || !ctx.user.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Check if user is a group admin or if this org is a parent
      const [currentUser] = await ctx.db.select().from(users).where(eq(users.id, ctx.user.id));
      if (currentUser?.organizationGroupRole !== 'group_admin') {
         throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a group admin' });
      }

      const childOrgs = await ctx.db.select().from(organizations)
        .where(or(
            eq(organizations.parentOrganizationId, ctx.user.orgId),
            eq(organizations.id, ctx.user.orgId) // Include the parent org itself
        ));

      return childOrgs;
    }),

  getGroupComplianceScores: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user || !ctx.user.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Find all child orgs
      const childOrgs = await ctx.db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, ctx.user.orgId));
        
      if (childOrgs.length === 0) {
        return { averageScore: 0, worstScore: 0, breakdown: [] };
      }

      const childOrgIds = childOrgs.map((o: any) => o.id);

      // Verify scope and log
      await verifyGroupScopeAndLog(
        ctx.user.id,
        ctx.user.orgId,
        childOrgIds,
        ctx.user.entityScope,
        'query'
      );

      return computeGroupComplianceScores(ctx.db, ctx.user.orgId, childOrgIds);
    }),

  getGroupVendorConsistency: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user || !ctx.user.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const childOrgs = await ctx.db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, ctx.user.orgId));
        
      if (childOrgs.length === 0) return [];

      const childOrgIds = childOrgs.map((o: any) => o.id);

      // Verify scope and log
      await verifyGroupScopeAndLog(
        ctx.user.id,
        ctx.user.orgId,
        childOrgIds,
        ctx.user.entityScope,
        'query'
      );

      return computeGroupVendorConsistency(ctx.db, ctx.user.orgId, childOrgIds);
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
      if (!ctx.user || !ctx.user.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Find all child orgs to verify scope
      const childOrgs = await ctx.db.select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, ctx.user.orgId));
        
      const childOrgIds = childOrgs.map((o: any) => o.id);

      // We must explicitly log the attempt to export across these entities
      await verifyGroupScopeAndLog(
        ctx.user.id,
        ctx.user.orgId,
        childOrgIds,
        ctx.user.entityScope,
        'query'
      );

      // Queue the job to generate the group audit file asynchronously
      await dataExportQueue.add('group-audit-export', {
        organizationId: ctx.user.orgId,
        requestedBy: ctx.user.id,
        isGroupAudit: true,
        targetOrgIds: childOrgIds
      });

      return { success: true, message: 'Group audit export queued successfully' };
    })
});
