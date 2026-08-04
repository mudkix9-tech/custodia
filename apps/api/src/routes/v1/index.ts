// NOT REGISTERED - future public API
// Do not wire this up until the public API feature is fully built and security reviewed.

import { FastifyInstance } from 'fastify';
import vendorRoutes from './vendors.js';

export default async function v1Routes(fastify: FastifyInstance) {
  // Register Swagger for OpenAPI 3.0 docs if @fastify/swagger is added
  // fastify.register(require('@fastify/swagger'), { ... });

  fastify.register(vendorRoutes, { prefix: '/vendors' });

  // Future: fastify.register(ropaRoutes, { prefix: '/processing-activities' });
  // Future: fastify.register(dsarRoutes, { prefix: '/dsars' });
}
