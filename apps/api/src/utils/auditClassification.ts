/**
 * The pure half of the audit middleware: what a mutation is called, which row it
 * addresses, and whether it creates, updates or deletes.
 *
 * Its own module, and not part of `auditLogger.ts`, because that file imports
 * `../db.js` at module scope and that throws without `DATABASE_URL`. None of the
 * decisions below need a connection — they are lookups against tables and
 * strings — and they are exactly the decisions that were silently wrong for a
 * year, so they need to be reachable from the standalone fixtures, which are the
 * only test style that runs in this workspace. Same split, and the same reason,
 * as `utils/cursor.ts` against `utils/pagination.ts`.
 *
 * Re-exported from `auditLogger.ts` so every existing importer keeps working.
 */
import {
  processingActivities,
  organizationVendors,
  vendors,
  dsarRequests,
  breaches,
  privacyPolicies,
  clients,
} from 'db';

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
  // The vendor module's paths, spelled as the router actually spells them.
  // These read `vendors.org.link` / `vendors.org.update` / `vendors.custom.create`
  // until August 2026 — a shape the router has never had — so every vendor
  // mutation fell through to "Performed vendors → updateOrgVendor" and the
  // History tab was a list of tRPC procedure names.
  'vendors.linkVendor': () => `Added vendor to the register`,
  'vendors.updateOrgVendor': () => `Updated the vendor relationship`,
  'vendors.createCustom': (input) => `Created custom vendor "${input.name}"`,
  'vendors.setStatus': (input) => (
    input.status === 'offboarded' ? `Offboarded the vendor`
      : input.status === 'paused' ? `Paused the vendor relationship`
      : `Reactivated the vendor relationship`
  ),
  'vendors.unlinkVendor': () => `Removed the vendor from the register`,
  'vendors.importCsv': (input) => (
    input.commit ? `Imported vendors from a spreadsheet` : `Previewed a vendor import`
  ),
  'vendors.attestReview': () => `Attested that the vendor record is accurate`,
  'vendors.confirmDpaAnalysis': () => `Confirmed the DPA clause analysis`,
  'vendors.saveDpaAnalysisDraft': () => `Saved the DPA clause analysis`,
  'vendors.createQuestionnaire': () => `Sent a security questionnaire`,
  'vendors.confirmQuestionnaire': () => `Confirmed a questionnaire response`,
  'vendors.reviewSubProcessorChange': (input) => `Reviewed a sub-processor change (${input.decision ?? 'reviewed'})`,
  'vendors.verifyVendorProfile': () => `Verified the vendor profile`,
  'vendors.exportHistoryCsv': () => `Exported the vendor audit trail`,
  // Chapter V events belong in the vendor's timeline too — they are the reason
  // the transfer is lawful, and a reader looking for them looks at the vendor.
  'tia.save': (input) => (
    input.status === 'completed' ? `Completed the transfer impact assessment` : `Saved a draft transfer impact assessment`
  ),
  'tia.exportPdf': () => `Exported the transfer impact assessment`,
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

/**
 * Which row a mutation's `resourceId` addresses, so the middleware can read the
 * before state and diff it.
 *
 * `idField` is the column the resource id matches. It is not always `id`: the
 * vendor router addresses a relationship by its *catalogue* vendor id, because
 * that is the id every other part of the module and the whole web app uses. A
 * map that could only express `id` is why `vendors.org` was the key here for a
 * year — a path that has never existed — and why no vendor mutation has ever
 * recorded a field-level diff.
 */
export const RESOURCE_TABLE_MAP: Record<string, { table: any; idField: string }> = {
  'ropa': { table: processingActivities, idField: 'id' },
  'vendors.updateOrgVendor': { table: organizationVendors, idField: 'vendorId' },
  'vendors.setStatus': { table: organizationVendors, idField: 'vendorId' },
  'vendors.unlinkVendor': { table: organizationVendors, idField: 'vendorId' },
  'vendors.attestReview': { table: organizationVendors, idField: 'vendorId' },
  'vendors.confirmDpaAnalysis': { table: organizationVendors, idField: 'vendorId' },
  'vendors.saveDpaAnalysisDraft': { table: organizationVendors, idField: 'vendorId' },
  'vendors.verifyVendorProfile': { table: vendors, idField: 'id' },
  'dsar': { table: dsarRequests, idField: 'id' },
  'breaches': { table: breaches, idField: 'id' },
  'policies': { table: privacyPolicies, idField: 'id' },
  'clients': { table: clients, idField: 'id' },
};

/**
 * Whether a mutation creates, updates or deletes — the question the middleware
 * asks before deciding to compute a diff.
 *
 * It used to be answered purely by the path suffix (`.create` / `.update` /
 * `.delete`), which is a convention the ROPA router follows and nothing else
 * does. `vendors.updateOrgVendor` classified as "other", so no before state was
 * fetched, no diff was computed, and the vendor History tab rendered every entry
 * with an empty changes blob — a timeline of procedure names. The suffix rule
 * stays as the default; the exceptions are named.
 */
const ACTION_TYPE_OVERRIDES: Readonly<Record<string, 'create' | 'update' | 'delete'>> = {
  'vendors.linkVendor': 'create',
  'vendors.createCustom': 'create',
  'vendors.updateOrgVendor': 'update',
  'vendors.setStatus': 'update',
  'vendors.attestReview': 'update',
  'vendors.confirmDpaAnalysis': 'update',
  'vendors.saveDpaAnalysisDraft': 'update',
  'vendors.verifyVendorProfile': 'update',
  'vendors.unlinkVendor': 'delete',
  'vendors.createQuestionnaire': 'create',
  'vendors.confirmQuestionnaire': 'update',
  'vendors.publishIncident': 'create',
  'dsar.updateStatus': 'update',
  'breaches.updateStatus': 'update',
  'users.updateRole': 'update',
  'consent.domain.update': 'update',
};

export function classifyActionType(path: string): 'create' | 'update' | 'delete' | 'other' {
  const override = ACTION_TYPE_OVERRIDES[path];
  if (override) return override;
  if (path.endsWith('.create')) return 'create';
  if (path.endsWith('.update')) return 'update';
  if (path.endsWith('.delete')) return 'delete';
  return 'other';
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
  // A questionnaire, an incident alert and a DPA analysis address the join row
  // rather than the catalogue. Without this key they logged `resource_id: null`
  // and the vendor's History tab — which looks rows up by id — could not find
  // them, so the timeline was missing exactly the events that involve a third
  // party writing into the register.
  if (input.orgVendorId) return input.orgVendorId;
  if (input.dsarId) return input.dsarId;
  if (input.breachId) return input.breachId;
  if (input.policyId) return input.policyId;
  if (input.domainId) return input.domainId;
  return null;
}
