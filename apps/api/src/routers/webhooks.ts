import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { db } from '../db.js';
import * as schema from '../../../../packages/db/src/schema.js';
import { eq, and, desc } from 'drizzle-orm';


import { randomBytes } from 'crypto';

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

export const WEBHOOK_EVENTS = {
  // Processing Activities
  'ropa.created': 'A new processing activity was created',
  'ropa.updated': 'A processing activity was updated',
  'ropa.deleted': 'A processing activity was deleted',

  // Vendors
  'vendor.added': 'A vendor was added to the organization',
  'vendor.removed': 'A vendor was removed',
  'vendor.dpa_status_changed': 'A vendor\'s DPA status changed',
  'vendor.risk_level_changed': 'A vendor\'s risk level changed',
  'vendor.subprocessor_changed': 'A vendor\'s sub-processors changed',
  'vendor.breach_reported': 'A vendor breach was detected',

  // DSARs
  'dsar.created': 'A new DSAR was received',
  'dsar.status_changed': 'A DSAR\'s status changed',
  'dsar.deadline_approaching': 'A DSAR deadline is within 7 days',
  'dsar.overdue': 'A DSAR deadline has passed',
  'dsar.completed': 'A DSAR was completed',

  // Breaches
  'breach.reported': 'A data breach was reported',
  'breach.status_changed': 'A breach status changed',
  'breach.deadline_approaching': 'A breach notification deadline is approaching',
  'breach.notification_sent': 'A breach notification was sent to the authority',

  // Compliance
  'compliance.score_changed': 'The compliance score changed significantly (±5 points)',
  'compliance.gap_detected': 'A new compliance gap was detected',
  'compliance.gap_resolved': 'A compliance gap was resolved',

  // Consent
  'consent.new_cookies_detected': 'New cookies were detected on a domain',

  // Regulatory
  'regulatory.update_published': 'A new regulatory update was published',

  // Training
  'training.completed': 'A team member completed training',
  'training.overdue': 'A team member\'s training is overdue',
} as const;

export const webhooksRouter = router({
  list: protectedProcedure
    .use(requireRole("admin"))
    .query(async ({ ctx }) => {
      const hooks = await ctx.db.query.webhooks.findMany({
        where: eq(schema.webhooks.organizationId, ctx.user!.orgId),
        orderBy: desc(schema.webhooks.createdAt),
      });
      return hooks;
    }),

  create: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({
      url: z.string().url(),
      events: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const secret = `whsec_${randomBytes(32).toString('hex')}`;
      const [hook] = await ctx.db.insert(schema.webhooks).values({
        organizationId: ctx.user!.orgId,
        url: input.url,
        events: input.events,
        secret,
        createdBy: ctx.user!.id,
      }).returning();
      return hook;
    }),

  delete: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(schema.webhooks)
        .where(
          and(
            eq(schema.webhooks.id, input.id),
            eq(schema.webhooks.organizationId, ctx.user!.orgId)
          )
        );
      return { success: true };
    }),

  test: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { dispatchWebhook } = require('../utils/webhookDispatcher');
      await dispatchWebhook(ctx.user!.orgId, 'webhook.test', { message: 'Test webhook delivery' }, input.id as any);
      return { success: true };
    }),

  getDeliveries: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ webhookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [hook] = await ctx.db.select().from(schema.webhooks).where(
        and(
          eq(schema.webhooks.id, input.webhookId),
          eq(schema.webhooks.organizationId, ctx.user!.orgId)
        )
      );
      if (!hook) throw new Error('Not found');

      return ctx.db.query.webhookDeliveries.findMany({
        where: eq(schema.webhookDeliveries.webhookId, input.webhookId),
        orderBy: desc(schema.webhookDeliveries.createdAt),
        limit: 50,
      });
    }),

  redeliver: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ webhookId: z.string(), deliveryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [hook] = await ctx.db.select().from(schema.webhooks).where(
        and(
          eq(schema.webhooks.id, input.webhookId),
          eq(schema.webhooks.organizationId, ctx.user!.orgId)
        )
      );
      if (!hook) throw new Error('Webhook not found');

      const [delivery] = await ctx.db.select().from(schema.webhookDeliveries).where(
        and(
          eq(schema.webhookDeliveries.id, input.deliveryId),
          eq(schema.webhookDeliveries.webhookId, input.webhookId)
        )
      );
      if (!delivery) throw new Error('Delivery not found');

      const { v4: uuidv4 } = await import('uuid');
      const { webhookQueue } = require('../utils/webhookDispatcher');
      const eventId = uuidv4();

      const newPayload = {
        ...delivery.payload as any,
        id: eventId,
        timestamp: new Date().toISOString()
      };

      const [newDelivery] = await ctx.db.insert(schema.webhookDeliveries).values({
        webhookId: hook.id,
        eventId,
        eventType: delivery.eventType,
        payload: newPayload,
        status: 'pending',
      }).returning();

      await webhookQueue.add('deliver', { deliveryId: newDelivery?.id }, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000,
        }
      });

      return { success: true };
    })
});
