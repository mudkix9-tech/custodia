import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { db } from '../db.js';
import { organizations } from 'db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Use sandbox environment if not explicitly set to production
const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' 
  ? Environment.production 
  : Environment.sandbox;

const paddle = new Paddle(process.env.PADDLE_API_KEY || 'dummy_key', { environment });

export async function paddleWebhookHandler(fastify: FastifyInstance) {
  fastify.post('/api/webhooks/paddle', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['paddle-signature'] as string;
    // Fastify request.rawBody requires fastify-raw-body plugin, which should be registered
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);
    
    // Skip signature verification in dev if secret is missing
    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    
    if (secret) {
      try {
        const unmarshalledEvent = paddle.webhooks.unmarshal(rawBody, secret, signature);
        if (!unmarshalledEvent) return reply.code(401).send('Invalid signature');
      } catch (err) {
        fastify.log.error('Paddle signature verification failed: ' + String(err));
        return reply.code(401).send('Invalid signature');
      }
    }

    const event = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const eventType = event.event_type;
    const data = event.data;

    try {
      switch (eventType) {
        case 'subscription.created':
        case 'subscription.updated': {
          const orgId = data.custom_data?.organizationId;
          if (!orgId) break;

          const status = data.status; // active, past_due, canceled, paused
          const priceId = data.items[0]?.price?.id;
          
          // Map price ID to tier
          let tier = 'starter';
          if (priceId === process.env.PADDLE_PROFESSIONAL_PRICE_ID) tier = 'professional';
          if (priceId === process.env.PADDLE_AGENCY_PRICE_ID) tier = 'agency';
          
          await db.update(organizations)
            .set({
              paddleCustomerId: data.customer_id,
              paddleSubscriptionId: data.id,
              subscriptionTier: tier,
              subscriptionStatus: status,
              updatedAt: new Date()
            })
            .where(eq(organizations.id, orgId));
          break;
        }
        
        case 'subscription.canceled': {
          const orgId = data.custom_data?.organizationId;
          if (!orgId) break;

          await db.update(organizations)
            .set({ 
              subscriptionStatus: 'canceled',
              updatedAt: new Date()
            })
            .where(eq(organizations.id, orgId));
          break;
        }
        
        case 'transaction.payment_failed': {
          const orgId = data.custom_data?.organizationId;
          if (!orgId) break;

          await db.update(organizations)
            .set({ 
              subscriptionStatus: 'past_due',
              updatedAt: new Date()
            })
            .where(eq(organizations.id, orgId));
          break;
        }
      }
      return reply.code(200).send({ status: 'ok' });
    } catch (error) {
      fastify.log.error('Error processing Paddle webhook: ' + String(error));
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
