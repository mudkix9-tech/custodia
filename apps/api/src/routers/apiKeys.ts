import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import * as schema from '../../../../packages/db/src/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';

export const apiKeysRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const keys = await db.query.apiKeys.findMany({
        where: eq(schema.apiKeys.organizationId, ctx.user.orgId),
        orderBy: desc(schema.apiKeys.createdAt),
      });
      return keys;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      scopes: z.array(z.string()).default(['read']),
      allowedIps: z.array(z.string()).nullable().default(null),
      expiresAt: z.string().nullable().default(null),
    }))
    .mutation(async ({ ctx, input }) => {
      const random = randomBytes(32).toString('hex');
      const fullKey = `pvr_live_${random}`;
      const hash = createHash('sha256').update(fullKey).digest('hex');
      const prefix = `pvr_live_${random.substring(0, 8)}`;

      const [newKey] = await db.insert(schema.apiKeys).values({
        organizationId: ctx.user.orgId,
        name: input.name,
        keyHash: hash,
        prefix,
        scopes: input.scopes,
        allowedIps: input.allowedIps,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdBy: ctx.user.id,
      }).returning();

      return {
        ...newKey,
        fullKey, // Return only once
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(schema.apiKeys)
        .set({
          revokedAt: new Date(),
          revokedBy: ctx.user.id,
        })
        .where(
          and(
            eq(schema.apiKeys.id, input.id),
            eq(schema.apiKeys.organizationId, ctx.user.orgId)
          )
        );
      return { success: true };
    }),
});
