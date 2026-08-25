import { db } from '../db.js';
import { auditLogs } from 'db';
import { eq, and } from 'drizzle-orm';
// The classification half lives in its own module so the fixtures can reach it
// without a database. Re-exported here so nothing that already imports from
// this file has to change.
export {
  ACTION_DESCRIPTIONS,
  generateDescription,
  RESOURCE_TABLE_MAP,
  classifyActionType,
  extractResourceType,
  extractResourceId,
} from './auditClassification.js';
import { RESOURCE_TABLE_MAP } from './auditClassification.js';

const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'password_hash',
  'mfaSecret', 'mfa_secret', 'token',
  'portalToken', 'portal_token',
  'apiKey', 'api_key',
];

export function sanitizeForAuditLog(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  
  // Handle arrays
  if (Array.isArray(input)) {
    return input.map(sanitizeForAuditLog);
  }
  
  const sanitized = { ...input as Record<string, unknown> };
  
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeForAuditLog(sanitized[key]);
    }
  }
  
  return sanitized;
}

export function calculateDiff(before: Record<string, any>, after: Record<string, any>) {
  const changes: Record<string, { old: any; new: any }> = {};
  
  for (const key of Object.keys(after)) {
    if (SENSITIVE_FIELDS.includes(key)) continue;
    // Don't diff timestamps that are naturally updated
    if (['updatedAt', 'updated_at'].includes(key)) continue;
    
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = {
        old: before[key] ?? null,
        new: after[key] ?? null,
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

export async function fetchResourceBeforeState(path: string, resourceId: string, orgId: string) {
  // Try exact match first, then prefix match
  let mapping = RESOURCE_TABLE_MAP[path];
  if (!mapping) {
    const parts = path.split('.');
    while (parts.length > 0 && !mapping) {
      parts.pop();
      mapping = RESOURCE_TABLE_MAP[parts.join('.')];
    }
  }

  if (!mapping) return null;

  try {
    // The id predicate used to be ANDed with `eq(table.id, resourceId)`, which
    // made any `idField` other than `id` unsatisfiable — the field was declared
    // and then contradicted. And `orgId` was accepted and dropped, so a
    // resource id belonging to another tenant read that tenant's row and its
    // values landed in this tenant's `changes` blob.
    const predicates = [eq(mapping.table[mapping.idField], resourceId)];
    if (mapping.table.organizationId && orgId) {
      predicates.push(eq(mapping.table.organizationId, orgId));
    }

    const records = await db.select().from(mapping.table)
      .where(and(...predicates))
      .limit(1);

    return records[0] || null;
  } catch (err) {
    console.error(`Failed to fetch before state for ${path}`, err);
    return null;
  }
}



export async function logSystemAction(
  orgId: string, 
  action: string, 
  resourceType: string, 
  resourceId: string, 
  description: string, 
  metadata?: any
) {
  try {
    await db.insert(auditLogs).values({
      organizationId: orgId,
      userId: null,
      userEmail: 'system',
      ipAddress: null,
      userAgent: null,
      action,
      resourceType,
      resourceId,
      description,
      changes: null,
      metadata: metadata ? sanitizeForAuditLog(metadata) : null,
    });
  } catch (err) {
    console.error('System audit log failed:', err);
  }
}
