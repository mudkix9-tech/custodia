import { FastifyInstance } from 'fastify';
import { db } from '../../db.js';
import * as schema from 'db';
import { eq, desc, and, lt } from 'drizzle-orm';


import { apiKeyAuthMiddleware } from '../../middleware/apiKeyAuth.js';
import { randomUUID } from 'crypto';
import { paginatedQuery } from '../../utils/pagination.js';

export default async function vendorRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', apiKeyAuthMiddleware);

  fastify.get('/', {
    schema: {
      summary: 'List vendors',
      description: 'Returns a paginated list of vendors linked to your organization, including DPA status and risk scores.',
      tags: ['Vendors'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25, description: 'Number of results per page' },
          after: { type: 'string', description: 'Cursor for pagination (from previous response)' },
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  organizationId: { type: 'string' },
                  vendorId: { type: 'string' },
                  status: { type: 'string' },
                  dpaStatus: { type: 'string' },
                  tiaRequired: { type: 'boolean' },
                  createdAt: { type: 'string' },
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                has_more: { type: 'boolean' },
                next_cursor: { type: 'string', nullable: true },
                previous_cursor: { type: 'string', nullable: true }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                message: { type: 'string' },
                code: { type: 'string' },
                request_id: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                type: { type: 'string', default: 'unauthorized' },
                message: { type: 'string', default: 'Missing or invalid Authorization header' },
                code: { type: 'string', default: 'UNAUTHORIZED' }
              }
            }
          }
        },
        429: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                type: { type: 'string', default: 'rate_limit_exceeded' },
                message: { type: 'string', default: 'Rate limit exceeded' },
                code: { type: 'string', default: 'RATE_LIMITED' },
                retry_after: { type: 'integer' },
                request_id: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { limit = 25, after } = request.query as { limit?: number, after?: string };
    const orgId = (request as any).orgId;

    try {
      const response = await paginatedQuery(schema.organizationVendors, orgId, { limit, after });

      reply.header('X-API-Version', '2026-01-01');
      return response;
    } catch (err: any) {
      return reply.status(400).send({
        error: { type: 'validation_error', message: err.message, code: 'INVALID_CURSOR', request_id: request.id || randomUUID() }
      });
    }
  });

  fastify.setErrorHandler((error, request, reply) => {
    const reqId = request.id || randomUUID();
    const err = error as any;
    reply.status(err.statusCode || 500).send({
      error: {
        type: err.name || 'internal_error',
        message: err.message,
        code: err.code || 'UNKNOWN',
        request_id: reqId,
      }
    });
  });
}
