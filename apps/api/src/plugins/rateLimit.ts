import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const TIER_LIMITS: Record<string, number> = {
  starter: 100,
  professional: 500,
  agency: 2000,
  enterprise: 5000,
};

class PostgresStore {
  options: any;
  constructor(options: any) {
    this.options = options;
  }
  
  async increment(key: string, window: number, max: number) {
    const expiresAt = new Date(Date.now() + window);
    
    // Atomic insert or increment.
    // If expired, reset hits to 1 and update expiresAt.
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, hits, expires_at)
      VALUES (${key}, 1, ${expiresAt.toISOString()})
      ON CONFLICT (key) DO UPDATE
      SET hits = CASE 
          WHEN rate_limits.expires_at < NOW() THEN 1 
          ELSE rate_limits.hits + 1 
        END,
        expires_at = CASE 
          WHEN rate_limits.expires_at < NOW() THEN ${expiresAt.toISOString()}::timestamp with time zone 
          ELSE rate_limits.expires_at 
        END
      RETURNING hits, (EXTRACT(EPOCH FROM expires_at) * 1000) as expires_ts;
    `);

    const row = result.rows[0] as any;
    const current = parseInt(row.hits, 10);
    const ttl = Math.max(0, parseInt(row.expires_ts, 10) - Date.now());

    return {
      current,
      ttl
    };
  }
}

export default fp(async function (fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    store: PostgresStore as any,
    max: async (request: any, key) => {
      const tier = request.orgTier || 'starter';
      return TIER_LIMITS[tier] || 100;
    },
    timeWindow: 60000,
    keyGenerator: (request: any) => {
      return request.orgId || request.ip;
    },
    errorResponseBuilder: (request: any, context) => {
      return {
        error: {
          type: 'rate_limit_exceeded',
          message: `Rate limit exceeded. ${context.max} requests per minute allowed on this tier.`,
          code: 'RATE_LIMITED',
          retry_after: context.after,
          request_id: request.id
        }
      };
    }
  });
});
