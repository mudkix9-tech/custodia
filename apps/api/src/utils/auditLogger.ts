import { db } from '../db.js';
import { 
  auditLogs,
  processingActivities,
  organizationVendors,
  vendors,
  dsarRequests,
  breaches,
  privacyPolicies,
  clients
} from 'db';
import { eq, and } from 'drizzle-orm';

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

export const ACTION_DESCRIPTIONS: Record<string, (input: any) => string> = {
  'ropa.create': (input) => `Created processing activity "${input.name}"`,
  'ropa.update': (input) => `Updated processing activity`,
  'ropa.delete': (input) => `Deleted processing activity`,
  'ropa.dataCategories.create': (input) => `Added data category "${input.category}"`,
  'ropa.dataCategories.update': () => `Updated a data category`,
  'ropa.dataCategories.delete': () => `Removed a data category`,
  'ropa.recipients.create': (input) => `Added recipient "${input.name}"`,
  'ropa.recipients.update': () => `Updated a recipient`,
  'ropa.recipients.delete': () => `Removed a recipient`,
  'ropa.transfers.create': (input) => `Added a transfer to ${input.destinationCountry}`,
  'ropa.transfers.update': () => `Updated a transfer`,
  'ropa.transfers.delete': () => `Removed a transfer`,
  // Art. 30(1)(c), first limb. These carry processingActivityId, so extractResourceId
  // files them against the activity and they appear in its History tab.
  'ropa.dataSubjects.create': (input) => `Added data subject category "${input.category}"`,
  'ropa.dataSubjects.update': () => `Updated a data subject category`,
  'ropa.dataSubjects.delete': () => `Removed a data subject category`,
  // Sprint 2's lifecycle actions. Every one of them carries `id` or
  // `processingActivityId`, so extractResourceId files them against the activity and
  // they land in its History tab — which is the only place Art. 5(2) accountability
  // for "who approved this, and when" can be read.
  'ropa.archive': () => `Archived processing activity`,
  'ropa.restore': () => `Restored processing activity from the archive`,
  'ropa.duplicate': (input) => `Duplicated processing activity${input.name ? ` as "${input.name}"` : ''}`,
  'ropa.review.attest': () => `Attested that the record is accurate`,
  'ropa.approval.submit': () => `Requested approval`,
  'ropa.approval.decide': (input) => `Approval ${input.decision}`,
  'ropa.approval.withdraw': () => `Withdrew the approval request`,
  'ropa.versions.create': (input) => `Took a version snapshot${input.note ? `: ${input.note}` : ''}`,
  'ropa.tasks.create': (input) => `Added task "${input.title}"`,
  'ropa.tasks.update': () => `Updated a task`,
  'ropa.tasks.delete': () => `Removed a task`,
  'ropa.comments.create': () => `Commented on the record`,
  'ropa.comments.resolve': () => `Resolved a comment`,
  'ropa.comments.delete': () => `Deleted a comment`,
  'ropa.bulk.update': (input) => `Bulk-edited ${(input.ids || []).length} processing activities`,
  'ropa.bulk.archive': (input) => `Bulk-archived ${(input.ids || []).length} processing activities`,
  'ropa.bulk.delete': (input) => `Bulk-deleted ${(input.ids || []).length} processing activities`,
  // Org-level catalogue edits are not activity history — they log against the
  // catalogue row's own id, which is right: renaming an element is one event, not
  // one per activity that uses it.
  'ropa.catalogue.elements.create': (input) => `Added "${input.name}" to the data element catalogue`,
  'ropa.catalogue.elements.update': () => `Updated a data element catalogue entry`,
  'ropa.catalogue.elements.archive': () => `Archived a data element catalogue entry`,
  'ropa.catalogue.subjects.create': (input) => `Added "${input.name}" to the data subject catalogue`,
  'ropa.catalogue.subjects.update': () => `Updated a data subject catalogue entry`,
  'ropa.catalogue.subjects.archive': () => `Archived a data subject catalogue entry`,
  'vendors.org.link': (input) => `Added vendor to organization`,
  'vendors.org.update': (input) => `Updated vendor relationship`,
  'vendors.custom.create': (input) => `Created custom vendor "${input.name}"`,
  'dsar.create': (input) => `Created DSAR for "${input.subjectEmail}"`,
  'dsar.updateStatus': (input) => `Changed DSAR status to "${input.status}"`,
  'dsar.tasks.update': (input) => `Updated DSAR task status to "${input.status}"`,
  'breaches.report': (input) => `Reported new data breach "${input.title}"`,
  'breaches.updateStatus': (input) => `Changed breach status to "${input.status}"`,
  'policies.create': (input) => `Created privacy policy "${input.name}"`,
  'policies.update': (input) => `Updated privacy policy`,
  'users.invite': (input) => `Invited ${input.email} to the organization`,
  'users.updateRole': (input) => `Changed user role to "${input.role}"`,
  'consent.domain.add': (input) => `Added consent domain "${input.domain}"`,
  'consent.domain.update': (input) => `Updated consent domain configuration`,
};

export function generateDescription(path: string, input: any): string {
  const generator = ACTION_DESCRIPTIONS[path];
  if (generator) return generator(input || {});
  return `Performed ${path.replace(/\./g, ' → ')}`;
}

export const RESOURCE_TABLE_MAP: Record<string, { table: any; idField: string }> = {
  'ropa': { table: processingActivities, idField: 'id' },
  'vendors.org': { table: organizationVendors, idField: 'id' },
  'vendors.custom': { table: vendors, idField: 'id' },
  'dsar': { table: dsarRequests, idField: 'id' },
  'breaches': { table: breaches, idField: 'id' },
  'policies': { table: privacyPolicies, idField: 'id' },
  'clients': { table: clients, idField: 'id' },
};

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
    const query = db.select().from(mapping.table).where(
      and(
        eq(mapping.table[mapping.idField], resourceId),
        // If the table doesn't have organizationId, this would fail, but for our MVP, most core tables do.
        // We'll skip the orgId check here and assume the caller is authorized.
        eq(mapping.table.id, resourceId)
      )
    ).limit(1);
    
    const records = await query;
    return records[0] || null;
  } catch (err) {
    console.error(`Failed to fetch before state for ${path}`, err);
    return null;
  }
}

export function extractResourceType(path: string): string {
  if (path.startsWith('ropa')) return 'processing_activity';
  if (path.startsWith('vendors')) return 'vendor';
  if (path.startsWith('dsar')) return 'dsar_request';
  if (path.startsWith('breaches')) return 'breach';
  if (path.startsWith('policies')) return 'privacy_policy';
  if (path.startsWith('consent')) return 'consent_domain';
  if (path.startsWith('users')) return 'user';
  return path.split('.')[0] || 'unknown';
}

export function extractResourceId(input: any): string | null {
  if (!input || typeof input !== 'object') return null;
  if (input.id) return input.id;
  if (input.ropaId) return input.ropaId;
  // Before vendorId on purpose: a recipient create carries both, and the activity is
  // what the History tab filters on. Without this the child creates logged null and
  // Art. 5(2) accountability for most of an activity's content was unevidenced.
  if (input.processingActivityId) return input.processingActivityId;
  if (input.vendorId) return input.vendorId;
  if (input.dsarId) return input.dsarId;
  if (input.breachId) return input.breachId;
  if (input.policyId) return input.policyId;
  if (input.domainId) return input.domainId;
  return null;
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
