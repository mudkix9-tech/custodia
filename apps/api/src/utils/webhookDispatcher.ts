import { createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { webhooks, webhookDeliveries } from 'db';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';


/**
 * O120. The queue name is `webhook-deliveries` because that is the name the worker
 * passes to `createWorker`, and pg-boss routes by queue name.
 *
 * It used to be `webhooks`. Nothing consumed that queue, so every delivery row this
 * function wrote sat at `status: 'pending'` for ever and no webhook this product has
 * ever offered was actually delivered — including the test button, which reported
 * success because enqueueing succeeded. `tsc` cannot see a string mismatch between
 * two files, and there is no integration test that would have.
 */
export const webhookQueue = createQueue('webhook-deliveries');

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

  // 3. Create delivery records, then 4. enqueue each one. The enqueue needs its
  // own delivery row back, so that pairing stays sequential inside a hook — but
  // one subscriber's delivery has nothing to do with another's, so the hooks run
  // together.
  await Promise.all(relevantHooks.map(async (hook: any) => {
    const [delivery] = await db.insert(webhookDeliveries).values({
      webhookId: hook.id,
      eventId: eventPayload.id,
      eventType: eventType,
      payload: eventPayload,
      status: 'pending',
    }).returning();

    if (delivery) {
      await webhookQueue.add('deliver', { deliveryId: delivery.id }, {
        attempts: (hook as any).maxAttempts || 5,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        }
      });
    }
  }));
}
