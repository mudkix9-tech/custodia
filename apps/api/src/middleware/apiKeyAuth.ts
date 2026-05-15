import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as schema from 'db';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

export async function apiKeyAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } });
  }

  const token = authHeader.split(' ')[1];
  const hash = createHash('sha256').update(token || "").digest('hex');

  const [apiKey] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hash));

  if (!apiKey) {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
  }

  if (apiKey.revokedAt) {
    return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'API key has been revoked' } });
  }

  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'API key has expired' } });
  }

  // IP Whitelisting Check
  if (apiKey.allowedIps && Array.isArray(apiKey.allowedIps) && apiKey.allowedIps.length > 0) {
    const clientIp = request.ip;
    if (!apiKey.allowedIps.includes(clientIp)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'IP address not allowed' } });
    }
  }

  // Determine required scope based on HTTP method
  let requiredScope = 'read';
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    requiredScope = 'write';
  } else if (request.method === 'DELETE') {
    requiredScope = 'delete';
  }

  const scopes = (apiKey.scopes as string[]) || [];
  if (requiredScope === 'delete' && !scopes.includes('delete')) {
    return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient scope. Requires delete scope.' } });
  }
  if (requiredScope === 'write' && !scopes.includes('write') && !scopes.includes('delete')) {
    return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient scope. Requires write scope.' } });
  }
  if (requiredScope === 'read' && !scopes.includes('read') && !scopes.includes('write') && !scopes.includes('delete')) {
    return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient scope. Requires read scope.' } });
  }

  // Update last used asynchronously
  db.update(schema.apiKeys)
    .set({
      lastUsedAt: new Date(),
      requestCount: (apiKey.requestCount || 0) + 1
    })
    .where(eq(schema.apiKeys.id, apiKey.id))
    .execute()
    .catch(err => request.log.error('Failed to update API key usage', err));

  // Attach org context to the request
  (request as any).orgId = apiKey.organizationId;
  // Fetch org tier
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, apiKey.organizationId));
  (request as any).orgTier = org?.subscriptionTier || "starter";
}
