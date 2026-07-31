import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import * as schema from 'db';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';


function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export const webhookWorker = createWorker('webhook-deliveries', async (job) => {
  const { deliveryId } = job.data;

  const [delivery] = await db.query.webhookDeliveries.findMany({
    where: eq(schema.webhookDeliveries.id, deliveryId),
    with: {
      webhook: true
    }
  }) as any;

  if (!delivery || !delivery.webhook) return;

  const hook = delivery.webhook;
  const attemptCount = (delivery.attempts || 0) + 1;

  try {
    const payloadString = JSON.stringify(delivery.payload);
    const signature = signWebhookPayload(payloadString, hook.secret);

    const startTime = Date.now();
    const response = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custodia-Signature': signature,
        'X-Custodia-Event': delivery.eventType,
        'X-Custodia-Delivery': delivery.eventId,
        'X-Custodia-Timestamp': delivery.payload.timestamp,
      },
      body: payloadString,
    });
    const duration = Date.now() - startTime;

    const bodyText = await response.text().catch(() => '');

    await db.update(schema.webhookDeliveries).set({
      status: response.ok ? 'success' : 'failed',
      attempts: attemptCount,
      responseStatus: response.status,
      responseBody: bodyText.substring(0, 1000),
      responseTimeMs: duration,
      deliveredAt: response.ok ? new Date() : null,
      lastError: response.ok ? null : `HTTP ${response.status}`,
    }).where(eq(schema.webhookDeliveries.id, deliveryId));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

  } catch (error: any) {
    const isExhausted = attemptCount >= (delivery.maxAttempts || 5);

    await db.update(schema.webhookDeliveries).set({
      status: isExhausted ? 'exhausted' : 'failed',
      attempts: attemptCount,
      lastError: error.message,
      // Simple custom backoff for DB representation, bullmq handles actual retry
      nextRetryAt: isExhausted ? null : new Date(Date.now() + Math.pow(2, attemptCount) * 60000)
    }).where(eq(schema.webhookDeliveries.id, deliveryId));

    if (isExhausted) {
      // Check for auto-disable logic
      const recentFailures = await db.query.webhookDeliveries.findMany({
        where: eq(schema.webhookDeliveries.webhookId, hook.id),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        limit: 10,
      });

      if (recentFailures.length === 10 && recentFailures.every(f => f.status === 'exhausted' || f.status === 'failed')) {
        await db.update(schema.webhooks).set({ isActive: false }).where(eq(schema.webhooks.id, hook.id));
        // Would emit notification to org admin here about disabled webhook
      }
    }

    throw error; // Let BullMQ handle retry mechanism
  }
}, { drainDelay: 15 });

webhookWorker.on('failed', (job: any, err: any) => {
  console.error(`Webhook job ${job?.id} failed:`, err);
});
