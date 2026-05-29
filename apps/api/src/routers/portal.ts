import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { db } from '../db.js';
import { 
  clients,
  organizations,
  processingActivities,
  organizationVendors,
  clientProcessingActivities
} from 'db';
import { eq, and, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const portalRouter = router({
  getPortalData: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      // Validate token
      const client = await ctx.db.query.clients.findFirst({
        where: eq(clients.portalToken, input.token),
      });
      
      if (!client || !client.portalEnabled) {
        throw new TRPCError({ 
          code: 'NOT_FOUND',
          message: 'Portal link is invalid or has been disabled.'
        });
      }

      // ONLY fetch data scoped to this client via the junction table
      const cpas = await ctx.db.query.clientProcessingActivities.findMany({
        where: eq(clientProcessingActivities.clientId, client.id),
        with: { processingActivity: true }
      });
      
      const activities = cpas
        .map((cpa: any) => cpa.processingActivity)
        .filter((a: any) => a && !a.deletedAt && a.organizationId === client.organizationId);
      
      const activityIds = activities.map((a: any) => a.id);
      
      const dataCategoriesList = activityIds.length > 0 
        ? await ctx.db.query.processingDataCategories.findMany() // simplified fetch, filter below
        : [];
        
      const recipientsList = activityIds.length > 0
        ? await ctx.db.query.processingRecipients.findMany()
        : [];
        
      const transfersList = activityIds.length > 0
        ? await ctx.db.query.processingTransfers.findMany()
        : [];

      // Org-wide vendor DPA statuses (not client-specific directly, but relates to vendors the client data might be passed to)
      // Note: A more strict approach would only fetch vendors used by the activities above.
      const vendorIds = new Set<string>();
      recipientsList.forEach((r: any) => {
        if (r.vendorId && activityIds.includes(r.processingActivityId)) vendorIds.add(r.vendorId);
      });
      transfersList.forEach((t: any) => {
        if (t.vendorId && activityIds.includes(t.processingActivityId)) vendorIds.add(t.vendorId);
      });

      const vendorsList = await ctx.db.query.organizationVendors.findMany({
        where: eq(organizationVendors.organizationId, client.organizationId),
        with: { vendor: true },
      });

      // Filter to only vendors relevant to this client
      const relevantVendors = vendorsList.filter(v => vendorIds.has(v.vendorId));

      // Calculate client-specific compliance score
      let score = 100;
      if (activities.length > 0) {
         // simplistic mock score logic based on completeness
         score -= activities.filter(a => a.status === 'draft').length * 5;
      }
      if (relevantVendors.length > 0) {
         score -= relevantVendors.filter(v => v.dpaStatus !== 'signed').length * 10;
      }
      const clientScore = Math.max(0, score);

      // Get org branding for white-label
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, client.organizationId),
        columns: { name: true, branding: true },
      });

      if (!org) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }

      return {
        orgName: org.name,
        branding: org.branding, // logo, colors
        clientName: client.name,
        complianceScore: clientScore,
        processingActivities: activities.map((a: any) => {
          const actsDc = dataCategoriesList.filter((dc: any) => dc.processingActivityId === a.id);
          return {
            name: a.name,
            purpose: a.purpose,
            lawfulBasis: a.lawfulBasis,
            dataCategories: actsDc.map((dc: any) => dc.category).join(', '),
            securityMeasures: a.securityMeasures,
          };
        }),
        vendorDpaStatuses: relevantVendors.map((v: any) => ({
          name: v.vendor?.name || 'Unknown Vendor',
          dpaStatus: v.dpaStatus,
          dpaSignedAt: v.dpaSignedAt,
        })),
        lastUpdated: new Date()
      };
    }),
});
