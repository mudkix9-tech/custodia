import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import { organizations, users, notificationQueue, processingActivities, organizationVendors } from 'db';
import { eq, and, desc, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

export const settingsRouter = router({
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    const [ropaRes, vendorRes] = await Promise.all([
      db.select({ count: count() }).from(processingActivities).where(eq(processingActivities.organizationId, ctx.user!.orgId)),
      db.select({ count: count() }).from(organizationVendors).where(eq(organizationVendors.organizationId, ctx.user!.orgId)),
    ]);
    
    return {
      ropaEntries: ropaRes[0]?.count ?? 0,
      vendorsTracked: vendorRes[0]?.count ?? 0,
    };
  }),

  getResidencyData: protectedProcedure.query(async ({ ctx }) => {
    checkOrgContext(ctx.user);
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.user!.orgId),
      columns: {
        dataRegion: true,
        dedicatedDatabaseStatus: true,
        dedicatedDatabaseProvisionedAt: true,
      }
    });
    return org;
  }),

  updateResidency: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      region: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user!.orgId)
      });

      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      if (org.subscriptionTier !== 'enterprise') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Enterprise plan required' });
      }

      await db.update(organizations)
        .set({
          dataRegion: input.region,
          dedicatedDatabaseStatus: 'provisioning'
        })
        .where(eq(organizations.id, ctx.user!.orgId));

      // Trigger provisioning worker
      const { residencyProvisioningQueue } = await import('../workers/residencyProvisioner.js');
      await residencyProvisioningQueue.add('provision', {
        orgId: org.id,
        region: input.region,
        orgSlug: org.slug
      });

      return { success: true };
    }),
  getOrgSettings: protectedProcedure
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      return org;
    }),

  getSiemSettings: protectedProcedure
    .use(requireRole('admin'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      const [org] = await ctx.db.select({
        siemEnabled: organizations.siemEnabled,
        siemEndpointUrl: organizations.siemEndpointUrl,
        siemFormat: organizations.siemFormat,
        siemAuthHeader: organizations.siemAuthHeader,
      }).from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });

      // Fetch last delivery status from notificationQueue for SIEM
      const [lastDelivery] = await ctx.db.select({
        status: notificationQueue.status,
        lastAttemptAt: notificationQueue.lastAttemptAt,
        error: notificationQueue.error,
      })
      .from(notificationQueue)
      .where(and(
        eq(notificationQueue.organizationId, ctx.user!.orgId),
        eq(notificationQueue.channel, 'siem')
      ))
      .orderBy(desc(notificationQueue.createdAt))
      .limit(1);

      return {
        ...org,
        deliveryStatus: lastDelivery ? lastDelivery : null,
      };
    }),

  updateSiemSettings: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      siemEnabled: z.boolean(),
      siemEndpointUrl: z.string().optional().nullable(),
      siemFormat: z.string().optional().nullable(),
      siemAuthHeader: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const org = await ctx.db.query.organizations.findFirst({ where: eq(organizations.id, ctx.user!.orgId) });
      if (!org || org.subscriptionTier !== 'enterprise') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Enterprise plan required for SIEM integration' });
      }

      const [updated] = await ctx.db.update(organizations)
        .set({
          siemEnabled: input.siemEnabled,
          siemEndpointUrl: input.siemEndpointUrl,
          siemFormat: input.siemFormat,
          siemAuthHeader: input.siemAuthHeader,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning({
          siemEnabled: organizations.siemEnabled,
          siemEndpointUrl: organizations.siemEndpointUrl,
          siemFormat: organizations.siemFormat,
          siemAuthHeader: organizations.siemAuthHeader,
        });

      return updated;
    }),

  testSiemConnection: protectedProcedure
    .use(requireRole('admin'))
    .mutation(async ({ ctx }) => {
      checkOrgContext(ctx.user);

      const [org] = await ctx.db.select({
        siemEnabled: organizations.siemEnabled,
        siemEndpointUrl: organizations.siemEndpointUrl,
        siemFormat: organizations.siemFormat,
        siemAuthHeader: organizations.siemAuthHeader,
      }).from(organizations).where(eq(organizations.id, ctx.user!.orgId));

      if (!org || !org.siemEndpointUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'SIEM is not configured or missing endpoint URL.' });
      }

      // Generate a mock audit log payload for the test
      const testPayload = {
        createdAt: new Date().toISOString(),
        organizationId: ctx.user!.orgId,
        userId: ctx.user!.id,
        userEmail: 'test@example.com',
        ipAddress: ctx.req.ip,
        action: 'system.test',
        resourceType: 'system',
        resourceId: 'test-123',
        description: 'Test SIEM connection',
        changes: null,
      };

      const { formatSiemPayload } = await import('../lib/siemFormatters.js');
      const formattedPayload = formatSiemPayload(org.siemFormat || 'json', testPayload);

      const headers: Record<string, string> = {
        'Content-Type': org.siemFormat === 'json' ? 'application/json' : 'text/plain',
      };

      if (org.siemAuthHeader) {
        headers['Authorization'] = org.siemAuthHeader;
      }

      try {
        const response = await fetch(org.siemEndpointUrl, {
          method: 'POST',
          headers,
          body: formattedPayload,
        });

        if (!response.ok) {
          throw new Error(`Endpoint returned status ${response.status}`);
        }

        return { success: true, message: 'Test connection successful' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }),

  updateOrgSettings: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      legalName: z.string().optional().nullable(),
      slug: z.string().optional(),
      registrationNumber: z.string().optional().nullable(),
      countryCode: z.string().length(2).optional().or(z.literal('')),
      address: z.any().optional().nullable(),
      hasDpo: z.boolean().optional(),
      dpoName: z.string().optional().nullable(),
      dpoEmail: z.string().email().optional().or(z.literal('')).nullable(),
      dpoIsExternal: z.boolean().optional(),
      leadSupervisoryAuthority: z.string().optional().nullable(),
      slackWebhookUrl: z.string().url().optional().or(z.literal('').transform(() => null)).nullable(),
      notificationPreferences: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      if (ctx.user!.role !== 'admin' && ctx.user!.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Must be admin or owner' });
      }

      // Convert empty strings to null for DB constraints if needed
      const updateData = { ...input };
      if (updateData.countryCode === '') updateData.countryCode = undefined; // Assuming DB schema handles it or allows it
      if (updateData.dpoEmail === '') updateData.dpoEmail = null;

      const [updated] = await ctx.db.update(organizations)
        .set({
            ...updateData,
            updatedAt: new Date(),
        })
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning();

      return updated;
    }),

  getUserSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const [user] = await ctx.db.select().from(users).where(eq(users.id, ctx.user!.id));
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),

  updateUserSettings: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      notificationOverrides: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { ...input };

      const [updated] = await ctx.db.update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user!.id))
        .returning();

      return updated;
    }),
});
