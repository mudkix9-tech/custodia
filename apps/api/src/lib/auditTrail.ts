/**
 * I85–I89. Turning the audit log into a trail somebody can read.
 *
 * The log has always recorded *what procedure ran* and a raw jsonb diff of
 * whatever the payload happened to contain. That is a record of the software's
 * behaviour, not of the organisation's — and Art. 5(2) asks for the second. Three
 * things separate them:
 *
 *   - a field name a reader recognises (`lawfulBasisDetail` → "Lawful basis
 *     detail"), which is I85's "human-readable field labels";
 *   - values rendered as what they are, so a boolean does not print `false` and a
 *     date does not print an ISO instant with a timezone offset;
 *   - the noise dropped. `updatedAt` moves on every save and `completenessScore`
 *     is recomputed by the API, so both appear in every diff and neither is a
 *     change anybody made.
 *
 * Pure, for the usual reason: this decides what an auditor is shown, and a
 * mislabelled field is a wrong answer that looks like a right one.
 */

// ---------------------------------------------------------------------------
// Field labels.
//
// English fallbacks. The web resolves `ropa.fields.<name>` from the catalogue and
// falls back to these; the API needs its own copy because the CSV and PDF exports
// of the trail (I89) are produced server-side, where no catalogue exists.
// ---------------------------------------------------------------------------

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  // The activity.
  name: 'Name',
  description: 'Description',
  purpose: 'Purpose',
  role: 'Role',
  controllerName: 'Controller',
  lawfulBasis: 'Lawful basis',
  lawfulBasisDetail: 'Lawful basis detail',
  liaId: 'Legitimate interest assessment',
  dataSubjectCategories: 'Data subject categories',
  estimatedDataSubjects: 'Estimated data subjects',
  isSystematicMonitoring: 'Systematic monitoring',
  involvesSpecialCategories: 'Special category data',
  involvesChildren: "Children's data",
  involvesProfiling: 'Profiling',
  involvesAutomatedDecisionMaking: 'Automated decision-making',
  admLogic: 'Automated decision logic',
  admSignificance: 'Significance and consequences',
  admHumanIntervention: 'Human intervention',
  retentionPeriod: 'Retention period',
  retentionJustification: 'Retention justification',
  retentionReviewDate: 'Retention review date',
  deletionProcedure: 'Deletion procedure',
  securityMeasures: 'Security measures',
  securityMeasuresDetail: 'Security measures detail',
  status: 'Status',
  riskLevel: 'Risk level',
  requiresDpia: 'DPIA required',
  dpiaId: 'DPIA',
  clientId: 'Client',
  tags: 'Tags',
  businessOwnerId: 'Business owner',
  privacyOwnerId: 'Privacy owner',
  reviewCadenceMonths: 'Review cadence',
  nextReviewAt: 'Next review',
  lastReviewedAt: 'Last reviewed',
  approvalState: 'Approval state',
  publishedAt: 'Published',
  publicationExceptionReason: 'Publication exception',
  archivedAt: 'Archived',

  // Child rows.
  category: 'Category',
  categoryGroup: 'Category group',
  isSpecialCategory: 'Special category',
  specialCategoryType: 'Special category type',
  article9Condition: 'Article 9(2) condition',
  article9NationalLawBasis: 'Article 9(2) national law basis',
  isCriminalData: 'Criminal offence data',
  article10Basis: 'Article 10 basis',
  identifiability: 'Identifiability',
  source: 'Source',
  volumeBand: 'Volume',
  recipientCategory: 'Recipient category',
  vendorId: 'Vendor',
  destinationCountry: 'Destination country',
  destinationEntity: 'Destination entity',
  transferMechanism: 'Transfer mechanism',
  mechanismDetail: 'Mechanism detail',
  sccYear: 'SCC year',
  sccModule: 'SCC module',
  executionDate: 'Execution date',
  bcrReference: 'BCR reference',
  adequacyDecisionReference: 'Adequacy decision',
  article49SubReason: 'Article 49 derogation',
  tiaCompleted: 'TIA completed',
  tiaRiskLevel: 'TIA risk level',

  // Assessments.
  outcome: 'Outcome',
  outcomeRationale: 'Outcome rationale',
  verdict: 'Screening verdict',
  decision: 'Decision',
  rationale: 'Rationale',
  signOffDecision: 'Sign-off decision',
  dpoOpinion: 'DPO opinion',
  residualRiskLevel: 'Residual risk',
  conclusion: 'Conclusion',
};

export function fieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  // A column nobody has labelled still has to read as something. camelCase and
  // snake_case both become sentence case rather than being printed raw.
  const spaced = field.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Fields excluded from a rendered diff.
 *
 * Not the same list as the audit middleware's `SENSITIVE_FIELDS` — nothing here
 * is secret. These are fields that change without anybody changing them, and
 * showing them means every entry in the timeline reads "updated the record" with
 * two rows of machinery under it. `completenessScore` is the sharpest case: the
 * API recomputes it after fourteen mutations, so it moves on saves that did not
 * touch it.
 */
export const NOISE_FIELDS: readonly string[] = [
  'updatedAt', 'updated_at', 'createdAt', 'created_at',
  'completenessScore', 'completeness_score',
  'version', 'previousVersionId',
  'id', 'organizationId', 'processingActivityId',
];

export type RenderedChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const MAX_VALUE_CHARS = 400;

/** ISO 8601 instant, as a drizzle timestamp round-trips through jsonb. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * One stored value, as a sentence.
 *
 * Dates print as a date, because the time of day an SCC was executed is not what
 * anybody is reading the trail for and a raw instant is the single most common
 * reason an audit export looks machine-generated. Long values are truncated
 * rather than wrapped: the trail says *that* the purpose changed and by roughly
 * how much, and the record itself says what it now is.
 */
export function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const trimmed = ISO_INSTANT.test(value) ? value.slice(0, 10) : value;
    return trimmed.length > MAX_VALUE_CHARS ? `${trimmed.slice(0, MAX_VALUE_CHARS)}…` : trimmed;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ').slice(0, MAX_VALUE_CHARS);
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, MAX_VALUE_CHARS);
  return String(value);
}

/**
 * I85. A stored `changes` blob, rendered field by field.
 *
 * Accepts the shape the audit middleware writes — `{ field: { old, new } }` —
 * and tolerates a null, because most entries have no diff at all: a create logs
 * its payload in `metadata` and a delete has nothing to compare against.
 */
export function describeChanges(changes: unknown): RenderedChange[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];

  const out: RenderedChange[] = [];
  for (const [field, entry] of Object.entries(changes as Record<string, any>)) {
    if (NOISE_FIELDS.includes(field)) continue;
    if (!entry || typeof entry !== 'object') continue;

    const before = renderValue((entry as any).old);
    const after = renderValue((entry as any).new);
    // A "change" whose two sides render identically is a formatting artefact —
    // a Date against its own ISO string, a null against an empty string — and
    // printing it tells a reader something happened that did not.
    if (before === after) continue;

    out.push({ field, label: fieldLabel(field), before, after });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * I86. Which child table a mutation acted on, from its tRPC path.
 *
 * The audit middleware knows the path; it does not know the table. Recording the
 * table is what lets the timeline say "Data category · added" against a row whose
 * `resource_type` is, correctly, `processing_activity` — the change belongs to
 * the activity and happened in a child of it, and both halves are true.
 */
export const CHILD_TABLE_BY_PATH: Readonly<Record<string, string>> = {
  'ropa.dataCategories': 'processing_data_categories',
  'ropa.dataSubjects': 'processing_data_subjects',
  'ropa.recipients': 'processing_recipients',
  'ropa.transfers': 'processing_transfers',
  'ropa.tasks': 'processing_activity_tasks',
  'ropa.comments': 'processing_activity_comments',
  'ropa.lia': 'legitimate_interest_assessments',
  'ropa.screening': 'dpia_screenings',
  'ropa.transfers.tia': 'transfer_impact_assessments',
  // E51. A disposal is addressed by its own id and belongs to an activity, so
  // without this entry "we deleted 12,400 payroll records on 3 March" would be
  // invisible in the History tab of the record it was deleted under — which is
  // the one place anyone would look for it.
  'ropa.retention.disposals': 'retention_disposals',
};

export function childTableForPath(path: string): string | null {
  // Longest prefix wins: 'ropa.transfers.tia.save' must not resolve as
  // 'ropa.transfers'.
  const prefixes = Object.keys(CHILD_TABLE_BY_PATH).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}.`)) return CHILD_TABLE_BY_PATH[prefix]!;
  }
  return null;
}

/**
 * I86. The activity a mutation's *result* belongs to.
 *
 * Read from the returned row rather than the input, which is the only place it is
 * reliably available: `ropa.dataCategories.update` takes `{ id, data }` where the
 * id is the *category's*, so the input alone cannot say which record changed. A
 * delete returns the row it deleted, which still carries the parent — which is
 * why the middleware reads this after the mutation rather than before.
 */
export function extractParentResourceId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const row = result as Record<string, unknown>;
  const candidate = row.processingActivityId ?? row.processing_activity_id;
  return typeof candidate === 'string' ? candidate : null;
}

// ---------------------------------------------------------------------------
// I88 — the timeline's own filters.
// ---------------------------------------------------------------------------

export const AUDIT_CHANGE_TYPES = ['create', 'update', 'delete', 'other'] as const;
export type AuditChangeType = (typeof AUDIT_CHANGE_TYPES)[number];

/**
 * The change type of a tRPC path.
 *
 * Kept here rather than inlined in the middleware because the *filter* has to
 * agree with what was written — a timeline that offers "created" and matches on a
 * different rule than the one that classified the row shows an empty list and
 * reads as broken data.
 */
export function changeTypeOf(path: string): AuditChangeType {
  if (/\.(create|bulkCreate|add|report|invite|submit)$/.test(path)) return 'create';
  if (/\.(update|save|edit|updateStatus|decide|restore|archive|attest|resolve)$/.test(path)) return 'update';
  if (/\.(delete|remove|withdraw)$/.test(path)) return 'delete';
  return 'other';
}

/**
 * SQL fragments are built by the caller; this is only the path-prefix set each
 * change type matches, so the filter and `changeTypeOf` cannot drift apart.
 */
export const CHANGE_TYPE_SUFFIXES: Readonly<Record<AuditChangeType, readonly string[]>> = {
  create: ['create', 'bulkCreate', 'add', 'report', 'invite', 'submit'],
  update: ['update', 'save', 'edit', 'updateStatus', 'decide', 'restore', 'archive', 'attest', 'resolve'],
  delete: ['delete', 'remove', 'withdraw'],
  other: [],
};

/**
 * I89. One audit row as a flat record, for CSV and for the PDF table.
 *
 * A row with three changed fields becomes three lines rather than one line with a
 * blob in it: a spreadsheet is the format a regulator asks for precisely so it
 * can be filtered on a field name, and that only works if the field is a column.
 * An entry with no diff still produces one line, because "approved this record"
 * is an event even though nothing about the record's content changed.
 */
export function flattenAuditRow(row: {
  createdAt?: Date | string | null;
  userEmail?: string | null;
  action?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  resourceId?: string | null;
  parentResourceId?: string | null;
  childResourceType?: string | null;
  changes?: unknown;
}): Array<Record<string, string>> {
  const base = {
    timestamp: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    user: row.userEmail || 'system',
    action: row.action || '',
    description: row.description || '',
    ip_address: row.ipAddress || '',
    record_id: row.parentResourceId || row.resourceId || '',
    changed_in: row.childResourceType || '',
  };

  const changes = describeChanges(row.changes);
  if (changes.length === 0) return [{ ...base, field: '', old_value: '', new_value: '' }];

  return changes.map((change) => ({
    ...base,
    field: change.label,
    old_value: change.before,
    new_value: change.after,
  }));
}
