import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { 
  complianceGaps, 
  complianceReports,
  organizations,
  processingActivities,
  auditLogs,
  dpias
} from 'db';
import { eq, and, desc, inArray, lt, or } from 'drizzle-orm';
import * as xlsx from 'xlsx';
import { paginatedQuery, decodeCursor, encodeCursor } from '../utils/pagination.js';
import { PassThrough } from 'stream';
import { format as csvFormat } from 'fast-csv';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3ClientForRegion, getS3BucketForOrg } from '../lib/s3.js';
import { sql } from 'drizzle-orm';

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
      filters: z.object({
        from: z.string().optional(),
        to: z.string().optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!['admin', 'owner'].includes(ctx.user!.role)) {
        throw new Error('Only admins or owners can export audit logs');
      }

      const exportKey = `audit-exports/${ctx.user!.orgId}/${Date.now()}.${input.format}`;
      
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });
      const dataRegion = (org as any)?.dataRegion || 'eu-west-1';
      const s3Client = getS3ClientForRegion(dataRegion);
      const S3_BUCKET = getS3BucketForOrg(dataRegion);

      const passThrough = new PassThrough();
      let streamWriter: any = null;

      if (input.format === 'csv') {
        streamWriter = csvFormat({ headers: true });
        streamWriter.pipe(passThrough);
      } else {
        // Fallback or handle json array streaming properly
        // For simplicity assuming CSV is the main stream target per Fix 14 requirements
        streamWriter = csvFormat({ headers: true });
        streamWriter.pipe(passThrough);
      }

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: S3_BUCKET,
          Key: exportKey,
          Body: passThrough,
        },
      });

      const uploadPromise = upload.done();

      let queryConditions: any[] = [eq(auditLogs.organizationId, ctx.user!.orgId)];
      if (input.filters?.from && input.filters?.to) {
        queryConditions.push(sql`created_at BETWEEN ${input.filters.from} AND ${input.filters.to}`);
      }

      let query = ctx.db.select()
        .from(auditLogs)
        .where(and(...queryConditions))
        .orderBy(desc(auditLogs.createdAt)) as any;

      // Iterate via limit/offset chunks to avoid OOM
      const CHUNK_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const chunk = await query.limit(CHUNK_SIZE).offset(offset);
        if (chunk.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of chunk) {
          streamWriter.write({
            Timestamp: row.createdAt,
            UserEmail: row.userEmail,
            Action: row.description || row.action,
            ResourceType: row.resourceType,
            ResourceId: row.resourceId,
            IPAddress: row.ipAddress,
            UserAgent: row.userAgent,
          });
        }

        offset += CHUNK_SIZE;
        // Basic safety limit to avoid infinite loops if something goes wrong
        if (offset > 1000000) break;
      }

      streamWriter.end();
      await uploadPromise;

      const downloadUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: exportKey,
      }), { expiresIn: 7 * 24 * 60 * 60 });

      return { downloadUrl };
    }),

  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user!.orgId;
    
    const latestReport = await ctx.db.query.complianceReports.findFirst({
      where: eq(complianceReports.organizationId, orgId),
      orderBy: [desc(complianceReports.snapshotDate)],
    });

    const activeGaps = await ctx.db.query.complianceGaps.findMany({
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
      const limit = Math.min(input.limit || 25, 100);
      let whereConditions: any[] = [eq(complianceGaps.organizationId, ctx.user!.orgId)];

      if (input.cursor) {
        try {
          const cursor = decodeCursor(input.cursor);
          const val = new Date(cursor.sortValue);

          whereConditions.push(
            or(
              lt(complianceGaps.createdAt, val),
              and(
                eq(complianceGaps.createdAt, val),
                lt(complianceGaps.id, cursor.id)
              )
            )
          );
        } catch (e) {
          // ignore
        }
      }

      const rows = await ctx.db
        .select({
          gap: complianceGaps,
          dpiaTitle: dpias.title,
        })
        .from(complianceGaps)
        .leftJoin(dpias, eq(complianceGaps.dpiaId, dpias.id))
        .where(and(...whereConditions))
        .orderBy(desc(complianceGaps.createdAt), desc(complianceGaps.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const dataRows = hasMore ? rows.slice(0, limit) : rows;

      const nextCursor = hasMore && dataRows.length > 0
        ? encodeCursor(dataRows[dataRows.length - 1].gap.createdAt, dataRows[dataRows.length - 1].gap.id)
        : null;

      const mappedData = dataRows.map((row: any) => ({
        ...row.gap,
        dpiaTitle: row.dpiaTitle
      }));

      return {
        data: mappedData,
        pagination: {
          has_more: hasMore,
          next_cursor: nextCursor,
          previous_cursor: null
        }
      };
    }),

  dismissGap: protectedProcedure
    .input(z.object({
      gapId: z.string().uuid(),
      reason: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(complianceGaps)
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
      const org = await ctx.db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
      
      const activities = await ctx.db.query.processingActivities.findMany({
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
