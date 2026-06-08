import { router, protectedProcedure } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
import { organizationIntegrations } from 'db';
import { eq, and } from 'drizzle-orm';
import { PROVIDERS } from '../integrations/registry.js';

export const integrationsRouter = router({
  listProviders: protectedProcedure
    .query(async ({ ctx }) => {
      return Object.values(PROVIDERS).map((p: any) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        scopes: p.scopes
      }));
    }),

  listConnections: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // In a real app, verify ctx.user has access to organizationId
      return ctx.db.select({
        id: organizationIntegrations.id,
        provider: organizationIntegrations.provider,
        providerAccountName: organizationIntegrations.providerAccountName,
        status: organizationIntegrations.status,
        lastSyncAt: organizationIntegrations.lastSyncAt,
        createdAt: organizationIntegrations.createdAt
      })
      .from(organizationIntegrations)
      .where(eq(organizationIntegrations.organizationId, input.organizationId));
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [integration] = await ctx.db.select()
        .from(organizationIntegrations)
        .where(eq(organizationIntegrations.id, input.id));

      if (!integration) {
        throw new Error('Integration not found');
      }

      // 1. In a real app, call provider's revocation endpoint here
      // e.g. if provider === 'hubspot', call DELETE /oauth/v1/refresh-tokens/:token

      // 2. Soft-revoke: update status and delete tokens
      await ctx.db.update(organizationIntegrations)
        .set({
          status: 'revoked',
          accessToken: 'REVOKED', // Don't leave encrypted tokens around
          refreshToken: 'REVOKED',
          updatedAt: new Date()
        })
        .where(eq(organizationIntegrations.id, input.id));

      // 3. Log in audit trail (mocked)
      console.log(`Integration ${integration.provider} disconnected`);

      return { success: true };
    })
});
