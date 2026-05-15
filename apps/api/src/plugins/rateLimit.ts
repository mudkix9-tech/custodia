import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

const TIER_LIMITS: Record<string, number> = {
  starter: 100,
  professional: 500,
  agency: 2000,
  enterprise: 5000,
};

export default fp(async function (fastify: FastifyInstance) {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  await fastify.register(fastifyRateLimit, {
    redis,
    max: async (request: any, key) => {
      const tier = request.orgTier || 'starter';
      return TIER_LIMITS[tier] || 100;
    },
    timeWindow: '1 minute',
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
