import { db } from '../db.js';
import { webhooks, webhookDeliveries , createRedisClient } from 'db';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { Queue } from 'bullmq';

const connection = createRedisClient({
  maxRetriesPerRequest: null,
});

export const webhookQueue = new Queue('webhooks', { connection });

export async function dispatchWebhook(organizationId: string, eventType: string, payload: any, specificWebhookId?: string) {
  // 1. Find active webhooks for this org that subscribe to this event
  const hooks = await db.query.webhooks.findMany({
    where: and(
      eq(webhooks.organizationId, organizationId),
      eq(webhooks.isActive, true)
    )
  });

  const relevantHooks = hooks.filter((h: any) =>
    (specificWebhookId ? h.id === specificWebhookId : true) &&
    (h.events.includes(eventType) || h.events.includes('*'))
  );

  if (relevantHooks.length === 0) return;

  const { v4: uuidv4 } = await import('uuid');

  // 2. Prepare payload wrapper
  const eventPayload = {
    id: uuidv4(),
    type: eventType,
    created: new Date().toISOString(),
    data: payload
  };

  // 3. Create delivery records
  for (const hook of relevantHooks) {
    const [delivery] = await db.insert(webhookDeliveries).values({
      webhookId: hook.id,
      eventId: eventPayload.id,
      eventType: eventType,
      payload: eventPayload,
      status: 'pending',
    }).returning();

    // 4. Enqueue job
    if (delivery) {
      await webhookQueue.add('deliver', { deliveryId: delivery.id }, {
        attempts: (hook as any).maxAttempts || 5,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        }
      });
    }
  }
}
