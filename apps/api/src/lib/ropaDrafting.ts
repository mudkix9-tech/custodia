/**
 * C37. AI drafting of a full activity, field by field, with a decision per field.
 *
 * The panel this replaces returns a blob of prose and can apply two fields of it.
 * The finding is not that the model is bad at the task — it is that a draft a DPO
 * cannot audit is a draft a DPO has to retype, so the unit of work has to be the
 * *field*, and every proposed value has to arrive with the reasoning and the
 * Article behind it.
 *
 * Three rules this module enforces, and each of them is a place the naive version
 * gets a register into trouble:
 *
 *   1. **The model may not invent a vocabulary.** A lawful basis that is not one
 *      of the six, an Art. 9(2) condition that is not one of the ten, a country
 *      that is not two letters — all are dropped, with the reason recorded, rather
 *      than written into a column the register then filters on.
 *   2. **A proposal is not evidence.** Every field carries a `confidence` and the
 *      accept flow records who accepted it. "The model said so" is not a lawful
 *      basis, and Art. 5(2) asks the controller to demonstrate the reasoning.
 *   3. **Some fields are never proposed.** Whether an activity is published,
 *      whether a DPIA is required, who owns it, whether a TIA is complete — these
 *      are decisions with consequences, and a model that could set them would be
 *      making them.
 *
 * Pure: the router calls the model, this validates and shapes what comes back.
 */

import {
  ARTICLE_9_CONDITIONS,
  RECIPIENT_ROLES,
  RECIPIENT_CATEGORIES,
  RETENTION_TRIGGERS,
  VOLUME_BANDS,
} from '../constants/ropaVocabularies.js';

export const LAWFUL_BASES = [
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interest',
] as const;

/** A single field the model may propose, and what makes a proposal valid. */
export type DraftFieldSpec = {
  id: string;
  /** The register field or child collection this lands in. */
  target: string;
  article: string;
  label: string;
  tab: string;
  kind: 'text' | 'enum' | 'boolean' | 'rows';
  enumValues?: readonly string[];
  maxLength?: number;
};

/**
 * The fields a draft covers.
 *
 * This is the Article 30 record minus the decisions. Notably absent: `status`,
 * `requiresDpia`, `businessOwnerId`, `privacyOwnerId`, `riskLevel`, and every
 * assessment outcome. Those are the fields whose value *is* a judgement someone is
 * accountable for, and proposing them would put a model's opinion in the column an
 * auditor reads as the controller's.
 */
export const DRAFT_FIELDS: DraftFieldSpec[] = [
  { id: 'name', target: 'name', article: 'Art. 30(1)(b)', label: 'Activity name', tab: 'general', kind: 'text', maxLength: 255 },
  { id: 'purpose', target: 'purpose', article: 'Art. 30(1)(b)', label: 'Purpose of processing', tab: 'general', kind: 'text', maxLength: 2000 },
  { id: 'description', target: 'description', article: 'Art. 30(1)(b)', label: 'Description', tab: 'general', kind: 'text', maxLength: 2000 },
  { id: 'lawfulBasis', target: 'lawfulBasis', article: 'Art. 6(1)', label: 'Lawful basis', tab: 'legal', kind: 'enum', enumValues: LAWFUL_BASES },
  { id: 'lawfulBasisDetail', target: 'lawfulBasisDetail', article: 'Art. 6(1)', label: 'Why this basis', tab: 'legal', kind: 'text', maxLength: 2000 },
  { id: 'dataSubjects', target: 'dataSubjects', article: 'Art. 30(1)(c)', label: 'Categories of data subject', tab: 'data', kind: 'rows' },
  { id: 'dataCategories', target: 'dataCategories', article: 'Art. 30(1)(c)', label: 'Categories of personal data', tab: 'data', kind: 'rows' },
  { id: 'recipients', target: 'recipients', article: 'Art. 30(1)(d)', label: 'Recipients', tab: 'recipients', kind: 'rows' },
  { id: 'transfers', target: 'transfers', article: 'Art. 30(1)(e)', label: 'Third-country transfers', tab: 'transfers', kind: 'rows' },
  { id: 'retentionPeriod', target: 'retentionPeriod', article: 'Art. 30(1)(f)', label: 'Retention period', tab: 'retention', kind: 'text', maxLength: 100 },
  { id: 'retentionJustification', target: 'retentionJustification', article: 'Art. 5(1)(e)', label: 'Retention justification', tab: 'retention', kind: 'text', maxLength: 2000 },
  { id: 'securityMeasures', target: 'securityMeasures', article: 'Art. 30(1)(g)', label: 'Technical and organisational measures', tab: 'security', kind: 'rows' },
  { id: 'involvesSpecialCategories', target: 'involvesSpecialCategories', article: 'Art. 9', label: 'Special-category data', tab: 'data', kind: 'boolean' },
  { id: 'involvesAutomatedDecisionMaking', target: 'involvesAutomatedDecisionMaking', article: 'Art. 22', label: 'Automated decision-making', tab: 'general', kind: 'boolean' },
  { id: 'involvesProfiling', target: 'involvesProfiling', article: 'Art. 4(4)', label: 'Profiling', tab: 'general', kind: 'boolean' },
];

export const DRAFT_FIELD_IDS = DRAFT_FIELDS.map((f) => f.id);

export type ProposedField = {
  value: unknown;
  /** Why the model proposed this. Shown next to the field; part of what makes it auditable. */
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
  article: string;
  label: string;
  tab: string;
  kind: DraftFieldSpec['kind'];
};

export type Proposal = Record<string, ProposedField>;

export type DraftDecision = {
  decision: 'accepted' | 'rejected' | 'pending';
  /** The value as accepted, which may be an edit of what was proposed. */
  value?: unknown;
  decidedAt?: string;
  decidedBy?: string;
};

export type Rejection = { field: string; reason: string };

/**
 * The JSON schema the model is asked for, as a string, so the prompt and the
 * validator cannot drift apart.
 *
 * Written out rather than generated from `DRAFT_FIELDS` because the shapes of the
 * four `rows` fields differ from each other and a generated schema would have to
 * describe that anyway — at which point the generator is longer than the string.
 */
export const DRAFT_JSON_SCHEMA = `{
  "name": { "value": "string", "rationale": "string", "confidence": "high|medium|low" },
  "purpose": { "value": "string", "rationale": "string", "confidence": "high|medium|low" },
  "description": { "value": "string", "rationale": "string", "confidence": "high|medium|low" },
  "lawfulBasis": { "value": "consent|contract|legal_obligation|vital_interests|public_task|legitimate_interest", "rationale": "string citing the Article and why the alternatives do not fit", "confidence": "high|medium|low" },
  "lawfulBasisDetail": { "value": "string", "rationale": "string", "confidence": "high|medium|low" },
  "dataSubjects": { "value": [{ "category": "string", "isChild": false, "isVulnerable": false, "volumeBand": "under_100|100_999|1k_10k|10k_100k|100k_1m|over_1m|null" }], "rationale": "string", "confidence": "high|medium|low" },
  "dataCategories": { "value": [{ "category": "string", "categoryGroup": "string", "source": "string", "isSpecialCategory": false, "article9Condition": "a..j or null", "retentionPeriod": "string or null" }], "rationale": "string", "confidence": "high|medium|low" },
  "recipients": { "value": [{ "name": "string", "role": "processor|sub_processor|joint_controller|independent_controller", "recipientCategory": "string or null", "purpose": "string or null" }], "rationale": "string", "confidence": "high|medium|low" },
  "transfers": { "value": [{ "destinationCountry": "ISO 3166-1 alpha-2", "destinationEntity": "string", "transferMechanism": "scc|bcr|dpf|adequacy_decision|art49_derogation|codes_of_conduct|certification|other|null" }], "rationale": "string", "confidence": "high|medium|low" },
  "retentionPeriod": { "value": "string, e.g. '6 years'", "rationale": "string", "confidence": "high|medium|low" },
  "retentionJustification": { "value": "string", "rationale": "string", "confidence": "high|medium|low" },
  "securityMeasures": { "value": ["string"], "rationale": "string", "confidence": "high|medium|low" },
  "involvesSpecialCategories": { "value": false, "rationale": "string", "confidence": "high|medium|low" },
  "involvesAutomatedDecisionMaking": { "value": false, "rationale": "string", "confidence": "high|medium|low" },
  "involvesProfiling": { "value": false, "rationale": "string", "confidence": "high|medium|low" }
}`;

/**
 * The system instruction.
 *
 * The last two sentences carry most of the weight. A model asked for an Article 30
 * record will fill every field, because filling fields is what it is for — and a
 * register full of confidently invented retention periods is worse than an empty
 * one, because the empty one tells you it is empty. `completenessScore` cannot see
 * the difference; only a human reading the rationale can.
 */
export const DRAFT_SYSTEM_PROMPT = [
  'You are a data protection specialist drafting an Article 30 record of processing activities.',
  'Return strictly valid JSON matching the schema given, and nothing else.',
  'Every field carries a rationale that names the provision it answers and, where a choice was made, why the alternatives do not fit.',
  'Omit any field you cannot answer from what you were told. An omitted field is reviewed as a gap; an invented one is reviewed as a fact, and it is the second that reaches a supervisory authority.',
  'Never assert a lawful basis of consent unless the description says consent is collected, and never assert legitimate interests without naming the interest.',
].join(' ');

/**
 * Validates a model response into a proposal, dropping anything that does not fit
 * the register's own vocabularies.
 *
 * Rejections are returned rather than swallowed, and they are shown to the user.
 * A field silently discarded is a field the reviewer believes was considered and
 * found not to apply — which is exactly the distinction F56 spent a sprint making
 * about DPIA screening criteria, and it is the same mistake in a different tab.
 */
export function validateProposal(raw: unknown): { proposal: Proposal; rejected: Rejection[] } {
  const proposal: Proposal = {};
  const rejected: Rejection[] = [];

  if (!raw || typeof raw !== 'object') return { proposal, rejected: [{ field: '*', reason: 'The model did not return an object.' }] };
  const input = raw as Record<string, any>;

  for (const spec of DRAFT_FIELDS) {
    const entry = input[spec.id];
    if (entry === undefined || entry === null) continue;

    // The model is asked for { value, rationale, confidence }, and sometimes
    // returns the bare value. Accepted, with the rationale recorded as absent —
    // refusing it would throw away a correct answer over its packaging.
    const wrapped = typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry;
    const value = wrapped ? entry.value : entry;
    const rationale = wrapped && typeof entry.rationale === 'string' ? entry.rationale.trim() : '';
    const confidence = wrapped && ['high', 'medium', 'low'].includes(entry.confidence) ? entry.confidence : 'medium';

    const checked = coerce(spec, value);
    if (checked.error) { rejected.push({ field: spec.id, reason: checked.error }); continue; }
    if (checked.value === null || checked.value === undefined) continue;
    if (Array.isArray(checked.value) && checked.value.length === 0) continue;

    proposal[spec.id] = {
      value: checked.value,
      rationale: rationale || 'No reasoning was returned for this field.',
      confidence: rationale ? confidence : 'low',
      article: spec.article,
      label: spec.label,
      tab: spec.tab,
      kind: spec.kind,
    };
    for (const note of checked.notes ?? []) rejected.push({ field: spec.id, reason: note });
  }

  return { proposal, rejected };
}

function coerce(spec: DraftFieldSpec, value: unknown): { value?: unknown; error?: string; notes?: string[] } {
  switch (spec.kind) {
    case 'text': {
      if (typeof value !== 'string') return { error: 'Expected text.' };
      const trimmed = value.trim();
      if (!trimmed) return {};
      return { value: spec.maxLength ? trimmed.slice(0, spec.maxLength) : trimmed };
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return { error: 'Expected true or false.' };
      return { value };
    }
    case 'enum': {
      if (typeof value !== 'string') return { error: 'Expected one of the permitted values.' };
      const v = value.trim().toLowerCase();
      // `legitimate_interests` plural is what the onboarding templates seeded and
      // what a model trained on the web will say; accepted and normalised rather
      // than rejected, because the value is right and the spelling is not.
      const normalised = v === 'legitimate_interests' ? 'legitimate_interest' : v;
      if (!spec.enumValues?.includes(normalised)) {
        return { error: `"${value}" is not a value this register can hold for ${spec.label}.` };
      }
      return { value: normalised };
    }
    case 'rows':
      return coerceRows(spec, value);
    default:
      return { error: 'Unknown field kind.' };
  }
}

function coerceRows(spec: DraftFieldSpec, value: unknown): { value?: unknown; error?: string; notes?: string[] } {
  if (!Array.isArray(value)) return { error: 'Expected a list.' };
  const notes: string[] = [];

  if (spec.id === 'securityMeasures') {
    const rows = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim().slice(0, 200));
    return { value: rows.slice(0, 30) };
  }

  if (spec.id === 'dataSubjects') {
    const rows = value
      .map((row: any) => {
        const category = typeof row?.category === 'string' ? row.category.trim() : typeof row === 'string' ? row.trim() : '';
        if (!category) return null;
        const band = typeof row?.volumeBand === 'string' && (VOLUME_BANDS as readonly string[]).includes(row.volumeBand)
          ? row.volumeBand : null;
        if (row?.volumeBand && !band) notes.push(`Dropped an unrecognised volume band for "${category}".`);
        return {
          category: category.slice(0, 120),
          isChild: row?.isChild === true,
          isVulnerable: row?.isVulnerable === true,
          volumeBand: band,
        };
      })
      .filter(Boolean);
    return { value: rows.slice(0, 30), notes };
  }

  if (spec.id === 'dataCategories') {
    const rows = value
      .map((row: any) => {
        const category = typeof row?.category === 'string' ? row.category.trim() : typeof row === 'string' ? row.trim() : '';
        if (!category) return null;
        const condition = typeof row?.article9Condition === 'string' && (ARTICLE_9_CONDITIONS as readonly string[]).includes(row.article9Condition)
          ? row.article9Condition : null;
        if (row?.article9Condition && !condition) notes.push(`Dropped an unrecognised Art. 9(2) condition for "${category}".`);
        const trigger = typeof row?.retentionTrigger === 'string' && (RETENTION_TRIGGERS as readonly string[]).includes(row.retentionTrigger)
          ? row.retentionTrigger : null;
        // A special category with no condition is left as special with no
        // condition, not quietly downgraded: the completeness scorer treats it as
        // a publication blocker, which is the correct outcome and the visible one.
        return {
          category: category.slice(0, 100),
          categoryGroup: typeof row?.categoryGroup === 'string' ? row.categoryGroup.trim().slice(0, 100) : 'Other',
          source: typeof row?.source === 'string' ? row.source.trim().slice(0, 100) : null,
          isSpecialCategory: row?.isSpecialCategory === true,
          article9Condition: condition,
          retentionPeriod: typeof row?.retentionPeriod === 'string' ? row.retentionPeriod.trim().slice(0, 100) : null,
          retentionTrigger: trigger,
        };
      })
      .filter(Boolean);
    return { value: rows.slice(0, 40), notes };
  }

  if (spec.id === 'recipients') {
    const rows = value
      .map((row: any) => {
        const name = typeof row?.name === 'string' ? row.name.trim() : typeof row === 'string' ? row.trim() : '';
        if (!name) return null;
        const role = typeof row?.role === 'string' && (RECIPIENT_ROLES as readonly string[]).includes(row.role) ? row.role : null;
        if (row?.role && !role) notes.push(`Dropped an unrecognised recipient role for "${name}".`);
        const category = typeof row?.recipientCategory === 'string' && (RECIPIENT_CATEGORIES as readonly string[]).includes(row.recipientCategory)
          ? row.recipientCategory : null;
        return {
          name: name.slice(0, 255),
          role,
          recipientCategory: category,
          recipientType: 'vendor',
          purpose: typeof row?.purpose === 'string' ? row.purpose.trim().slice(0, 500) : null,
        };
      })
      .filter(Boolean);
    return { value: rows.slice(0, 30), notes };
  }

  if (spec.id === 'transfers') {
    const rows = value
      .map((row: any) => {
        const country = typeof row?.destinationCountry === 'string' ? row.destinationCountry.trim().toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(country)) {
          if (country) notes.push(`Dropped a transfer with "${country}" as its destination — a country has to be an ISO 3166-1 alpha-2 code.`);
          return null;
        }
        // The mechanism is left as whatever the model said and normalised on read
        // (D43), rather than validated here: the reviewer picks from the
        // enum-backed picker against the *served* adequacy list, and a mechanism
        // this module accepted would look like one the register had checked.
        return {
          destinationCountry: country,
          destinationEntity: typeof row?.destinationEntity === 'string' ? row.destinationEntity.trim().slice(0, 255) : null,
          transferMechanism: typeof row?.transferMechanism === 'string' ? row.transferMechanism.trim().slice(0, 100) : 'pending_assessment',
        };
      })
      .filter(Boolean);
    return { value: rows.slice(0, 30), notes };
  }

  return { error: 'Unknown row type.' };
}

/**
 * The accepted fields, in the shape the router writes.
 *
 * Splits scalars from rows because they land in different tables, and returns them
 * separately rather than as one object so a caller cannot spread rows into
 * `.set()` by accident — which is the shape of the bug that let one tenant's
 * update payload carry `organization_id`.
 */
export function acceptedValues(proposal: Proposal, decisions: Record<string, DraftDecision>): {
  scalars: Record<string, unknown>;
  rows: Record<string, unknown[]>;
} {
  const scalars: Record<string, unknown> = {};
  const rows: Record<string, unknown[]> = {};

  for (const spec of DRAFT_FIELDS) {
    const decision = decisions[spec.id];
    if (!decision || decision.decision !== 'accepted') continue;
    const proposed = proposal[spec.id];
    if (!proposed) continue;
    // An edited value beats the proposed one. That the reviewer edited it is the
    // whole point of a field-level accept.
    const value = decision.value !== undefined ? decision.value : proposed.value;
    if (spec.kind === 'rows') rows[spec.id] = Array.isArray(value) ? value : [];
    else scalars[spec.target] = value;
  }

  return { scalars, rows };
}

/** The draft's own status, derived from its decisions rather than set by a caller. */
export function draftStatus(proposal: Proposal, decisions: Record<string, DraftDecision>): 'proposed' | 'partially_applied' | 'applied' {
  const fields = Object.keys(proposal);
  if (fields.length === 0) return 'proposed';
  const accepted = fields.filter((f) => decisions[f]?.decision === 'accepted').length;
  const decided = fields.filter((f) => decisions[f]?.decision && decisions[f]!.decision !== 'pending').length;
  if (accepted === 0) return 'proposed';
  return decided === fields.length ? 'applied' : 'partially_applied';
}
