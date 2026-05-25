import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { 
  complianceGaps, 
  complianceReports,
  organizations,
  processingActivities,
  auditLogs
} from 'db';
import { eq, and, desc, inArray, ilike, or } from 'drizzle-orm';
import * as xlsx from 'xlsx';
import { paginatedQuery } from '../utils/pagination.js';

export const auditRouter = router({
  listLogs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
      // Future: add filters here (date, user, resource, action)
    }))
    .query(async ({ ctx, input }) => {
      const isAdminOrOwner = ['admin', 'owner'].includes(ctx.user!.role);
      
      const res = await paginatedQuery(
        auditLogs,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );

      res.data = res.data.map((log: any) => {
        if (!isAdminOrOwner) {
          log.ipAddress = null;
          log.userAgent = null;
        }
        return log;
      });

      return res;
    }),

  exportLogs: protectedProcedure
    .input(z.object({
      format: z.enum(['csv', 'json']).default('csv'),
    }))
    .query(async ({ ctx, input }) => {
      if (!['admin', 'owner'].includes(ctx.user!.role)) {
        throw new Error('Only admins or owners can export audit logs');
      }

      const logs = await db.query.auditLogs.findMany({
        where: eq(auditLogs.organizationId, ctx.user!.orgId),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 10000, // Export limit
      });

      const formatted = logs.map((log: any) => ({
        Timestamp: log.createdAt,
        UserEmail: log.userEmail,
        Action: log.description || log.action,
        ResourceType: log.resourceType,
        ResourceId: log.resourceId,
        IPAddress: log.ipAddress,
        UserAgent: log.userAgent,
      }));

      if (input.format === 'csv') {
        const worksheet = xlsx.utils.json_to_sheet(formatted);
        const csv = xlsx.utils.sheet_to_csv(worksheet);
        return { data: csv, filename: 'Privaro_Audit_Logs.csv' };
      }

      return { data: formatted };
    }),

  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user!.orgId;
    
    const latestReport = await db.query.complianceReports.findFirst({
      where: eq(complianceReports.organizationId, orgId),
      orderBy: [desc(complianceReports.snapshotDate)],
    });

    const activeGaps = await db.query.complianceGaps.findMany({
      where: and(
        eq(complianceGaps.organizationId, orgId),
        inArray(complianceGaps.status, ['open', 'in_progress'])
      ),
      orderBy: [desc(complianceGaps.createdAt)],
    });

    const gapsBySeverity = {
      critical: activeGaps.filter((g: any) => g.severity === 'critical').length,
      high: activeGaps.filter((g: any) => g.severity === 'high').length,
      medium: activeGaps.filter((g: any) => g.severity === 'medium').length,
      low: activeGaps.filter((g: any) => g.severity === 'low').length,
    };

    return {
      latestReport: latestReport || null,
      gapsSummary: gapsBySeverity,
    };
  }),

  listGaps: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      return paginatedQuery(
        complianceGaps,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );
    }),

  dismissGap: protectedProcedure
    .input(z.object({
      gapId: z.string().uuid(),
      reason: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(complianceGaps)
        .set({
          status: 'dismissed',
          dismissalReason: input.reason,
          dismissedAt: new Date(),
          dismissedBy: ctx.user!.id,
          updatedAt: new Date(),
        })
        .where(and(
          eq(complianceGaps.id, input.gapId),
          eq(complianceGaps.organizationId, ctx.user!.orgId)
        ));
      await dispatchWebhook(ctx.user!.orgId, 'compliance.gap_resolved', { gapId: input.gapId });
      return { success: true };
    }),

  generateArticle30Report: protectedProcedure
    .input(z.object({ format: z.enum(['json', 'csv']) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
      
      const activities = await db.query.processingActivities.findMany({
        where: eq(processingActivities.organizationId, orgId),
        with: {
          dataCategories: true,
          recipients: { with: { vendor: true } },
        }
      });

      const controllerRecords = activities.filter((a: any) => !a.clientId);
      const processorRecords = activities.filter((a: any) => a.clientId);

      const controllerRows = controllerRecords.map((a: any) => ({
        Type: 'Controller',
        Organization: org?.name,
        DPO: org?.dpoName || 'N/A',
        Activity: a.name,
        Purpose: a.purpose,
        LawfulBasis: a.lawfulBasis,
        DataSubjects: a.dataSubjectCategories?.join(', ') || '',
        DataCategories: a.dataCategories.map((dc: any) => dc.category).join(', '),
        Recipients: a.recipients.map((r: any) => r.vendor?.name).join(', '),
        Transfers: a.recipients.some((r: any) => r.vendor?.headquartersCountry && !['EU', 'EEA'].includes(r.vendor.headquartersCountry)) ? 'Yes' : 'No',
        RetentionPeriod: a.retentionPeriod || 'Not specified',
        SecurityMeasures: a.securityMeasures || 'Standard technical measures',
      }));

      const processorRows = processorRecords.map((a: any) => ({
        Type: 'Processor',
        Organization: org?.name,
        DPO: org?.dpoName || 'N/A',
        Activity: a.name,
        Purpose: a.purpose,
        LawfulBasis: a.lawfulBasis,
        DataSubjects: a.dataSubjectCategories?.join(', ') || '',
        DataCategories: a.dataCategories.map((dc: any) => dc.category).join(', '),
        Recipients: a.recipients.map((r: any) => r.vendor?.name).join(', '),
        Transfers: a.recipients.some((r: any) => r.vendor?.headquartersCountry && !['EU', 'EEA'].includes(r.vendor.headquartersCountry)) ? 'Yes' : 'No',
        RetentionPeriod: a.retentionPeriod || 'Not specified',
        SecurityMeasures: a.securityMeasures || 'Standard technical measures',
      }));

      const combined = [...controllerRows, ...processorRows];

      if (input.format === 'csv') {
        const worksheet = xlsx.utils.json_to_sheet(combined);
        const csv = xlsx.utils.sheet_to_csv(worksheet);
        return { data: csv, filename: 'Article30_ROPA.csv' };
      }

      return { data: combined };
    }),
});
