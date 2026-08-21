/**
 * The public REST API.
 *
 * Registered in `index.ts` under `/api/v1` since O119. Every route in here is
 * behind `apiKeyAuthMiddleware`, which resolves the organisation from the key —
 * there is no endpoint that takes an organisation id, so a key can only ever
 * address its own tenant.
 */

import { FastifyInstance } from 'fastify';
import vendorRoutes from './vendors.js';
import ropaRoutes from './ropa.js';

export default async function v1Routes(fastify: FastifyInstance) {
  // Register Swagger for OpenAPI 3.0 docs if @fastify/swagger is added
  // fastify.register(require('@fastify/swagger'), { ... });

  fastify.register(vendorRoutes, { prefix: '/vendors' });
  // O119/D40. Vendors have had a v1 API since the feature shipped and the register
  // — the one object this product is built around — did not.
  fastify.register(ropaRoutes, { prefix: '/processing-activities' });

  // Future: fastify.register(dsarRoutes, { prefix: '/dsars' });
}
