/**
 * What a reviewer taught the scraper about one vendor's site.
 *
 * The pipeline guesses well in general and badly in particular. A path list plus
 * a token scan cannot know that this vendor publishes its DPA behind a slug
 * nobody would enumerate, or that the page tripping every DPA signal is a
 * marketing summary of one. Correcting the *value* fixes a row and teaches
 * nothing; the next run repeats the mistake and the reviewer corrects it again.
 * A rule is the correction that survives.
 *
 * Four kinds, kept deliberately small so each is checkable:
 *
 *   `pin_url`       this doc type is at this URL — probe it first
 *   `deny_url`      never accept this URL, whatever its text says
 *   `field_extract` read this field out of this page, using `locator`
 *   `vocabulary`    this site's own word for a document type
 *
 * The rule this module exists to enforce is that **a rule that stops working
 * says so**. `markRuleOutcome` flips a rule to `broken` the first run it applies
 * and fails to match, and a broken `field_extract` writes no column and no
 * provenance row. Falling back to generic enumeration would be worse than never
 * having taught it, because a taught pipeline would decay into an untaught one
 * with nobody noticing — the field would still be populated, by a guess, at a
 * confidence the reviewer thought they had vouched for.
 */
import { eq, and, inArray } from 'drizzle-orm';
import { vendorExtractionRules } from 'db';
import { applyLocator, isLocator, type Locator } from './vendorLocator.js';
import { normaliseTransferMechanism, TRANSFER_MECHANISMS } from '../constants/ropaVocabularies.js';

export const RULE_KINDS = ['pin_url', 'deny_url', 'field_extract', 'vocabulary'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export interface ExtractionRule {
  id: string;
  vendorId: string;
  kind: RuleKind | string;
  docType: string | null;
  fieldName: string | null;
  url: string | null;
  locator: unknown;
  note: string | null;
  status: string;
}

/**
 * Fields whose column is a controlled vocabulary, and what a taught value has to
 * normalise to before it is worth storing.
 *
 * This exists because of a real near-miss. A reviewer can select a perfectly
 * true sentence — "EU Standard Contractual Clauses approved by the European
 * Commission" — teach it as `transferMechanisms`, and watch the Article 44 gap
 * rule go on reporting "no documented safeguards", because that rule matches the
 * token `standard_contractual_clauses` and prose is not a token. The reviewer
 * would have done everything right and the product would still be wrong, which
 * is the exact failure this module spends its whole design avoiding — only now
 * with the reviewer's own name against it.
 *
 * So a taught value for one of these fields must be something the readers
 * downstream actually recognise. Refusing at teach time is the only place the
 * message can be useful: the reviewer is looking at the page and can select the
 * term instead, or decide the page does not state one.
 */
const VOCABULARY_FIELDS: Record<string, (value: string) => boolean> = {
  transferMechanisms: (value) => normaliseTransferMechanism(value) !== null,
  // ISO-3166 alpha-2. `isAdequateDestination` is case-sensitive on exactly this
  // shape, so "United States" taught here would read as a third country.
  headquartersCountry: (value) => /^[A-Za-z]{2}$/.test(value.trim()),
};

/** Human-readable guidance for a field that refused a value. */
const VOCABULARY_HELP: Record<string, string> = {
  transferMechanisms:
    `must be one of: ${TRANSFER_MECHANISMS.join(', ')}. Select the term the page uses, ` +
    'or record a correction instead if the page only describes it in prose.',
  headquartersCountry: 'must be a two-letter ISO-3166 country code, such as US or IE.',
};

/**
 * Does what this locator produced land in the vocabulary its field reads?
 *
 * Checked against `expect` — what the selection actually was — because that is
 * the value the reviewer is proposing, and checking it later would mean the
 * refusal arrives on a run nobody is watching.
 */
export function validateTaughtValue(fieldName: string, value: unknown): string[] {
  const check = VOCABULARY_FIELDS[fieldName];
  if (!check) return [];

  const parts = Array.isArray(value) ? value.map(String) : [String(value ?? '')];
  const bad = parts.filter((part) => part.trim() && !check(part));
  if (bad.length === 0) return [];

  return [
    `${fieldName} is a controlled vocabulary and ${bad.map((b) => `"${b.slice(0, 60)}"`).join(', ')} ` +
      `${bad.length === 1 ? 'is not in it' : 'are not in it'} — ${VOCABULARY_HELP[fieldName] ?? 'see the field\'s vocabulary'} ` +
      'A value the gap rules and risk score cannot read is worse than an absent one: ' +
      'it looks answered and behaves unanswered.',
  ];
}

export class RuleError extends Error {
  constructor(message: string, readonly kind: 'not_found' | 'bad_request') {
    super(message);
    this.name = 'RuleError';
  }
}

/**
 * Everything a rule needs to be worth storing.
 *
 * The note is required here rather than by the column, for the reason
 * `validateAnalystCorrection` asks for an excerpt: the check belongs where the
 * message can say what is missing and why. A rule with no reason is one nobody
 * can review — including whoever wrote it, six months on, looking at a URL they
 * no longer remember rejecting.
 */
export function validateRule(input: {
  kind: string;
  docType?: string | null;
  fieldName?: string | null;
  url?: string | null;
  locator?: unknown;
  note?: string | null;
}): string[] {
  const problems: string[] = [];

  if (!(RULE_KINDS as readonly string[]).includes(input.kind)) {
    problems.push(`kind must be one of ${RULE_KINDS.join(', ')}`);
    return problems;
  }

  const note = (input.note ?? '').trim();
  if (note.length < 10) {
    problems.push('a note of at least 10 characters saying why — a rule nobody can review is not a rule');
  }

  if (input.kind === 'pin_url' || input.kind === 'deny_url') {
    if (!input.url) problems.push(`${input.kind} needs the URL it is about`);
    if (!input.docType) problems.push(`${input.kind} needs a document type`);
  }

  if (input.kind === 'field_extract') {
    if (!input.url) problems.push('field_extract needs the page to read from');
    if (!input.fieldName) problems.push('field_extract needs the field it fills');
    if (!isLocator(input.locator)) {
      problems.push('field_extract needs a locator derived from a selection');
    } else if (input.fieldName) {
      const locator = input.locator as Locator;
      const proposed = locator.split
        ? locator.expect.split(locator.split).map((v) => v.trim()).filter(Boolean)
        : locator.expect;
      problems.push(...validateTaughtValue(input.fieldName, proposed));
    }
  }

  if (input.kind === 'vocabulary') {
    if (!input.docType) problems.push('vocabulary needs the document type its word means');
    const token = typeof input.locator === 'object' && input.locator !== null
      ? (input.locator as { token?: unknown }).token
      : null;
    if (typeof token !== 'string' || token.trim().length < 3) {
      problems.push('vocabulary needs a token of at least 3 characters');
    }
  }

  return problems;
}

/** Every active rule for a set of vendors, in one query. */
export async function loadRulesFor(
  dbInstance: any,
  vendorIds: readonly string[],
): Promise<Map<string, ExtractionRule[]>> {
  const out = new Map<string, ExtractionRule[]>();
  if (vendorIds.length === 0) return out;

  const rows: ExtractionRule[] = await dbInstance
    .select()
    .from(vendorExtractionRules)
    .where(inArray(vendorExtractionRules.vendorId, [...vendorIds]));

  for (const row of rows) {
    const list = out.get(row.vendorId);
    if (list) list.push(row);
    else out.set(row.vendorId, [row]);
  }
  return out;
}

/**
 * The pinned and denied URLs for one vendor, in the shape
 * `enumerateCandidateUrls` takes.
 *
 * Broken rules are excluded from *pinning* and kept for *denying*. A pin that
 * stopped resolving should not keep sending the probe at a dead URL, but a deny
 * is a statement about a page that never becomes untrue — the marketing summary
 * that trips the DPA signals is still a marketing summary.
 */
export function urlRulesFor(rules: readonly ExtractionRule[]): {
  pinned: Array<{ url: string; docType: string }>;
  denied: string[];
} {
  const pinned: Array<{ url: string; docType: string }> = [];
  const denied: string[] = [];

  for (const rule of rules) {
    if (!rule.url) continue;
    if (rule.kind === 'pin_url' && rule.status === 'active' && rule.docType) {
      pinned.push({ url: rule.url, docType: rule.docType });
    } else if (rule.kind === 'deny_url') {
      denied.push(rule.url.toLowerCase());
    }
  }
  return { pinned, denied };
}

/** Per-host vocabulary tokens, grouped by the document type they name. */
export function vocabularyFor(rules: readonly ExtractionRule[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const rule of rules) {
    if (rule.kind !== 'vocabulary' || rule.status !== 'active' || !rule.docType) continue;
    const token = (rule.locator as { token?: string } | null)?.token;
    if (typeof token !== 'string' || !token.trim()) continue;
    (out[rule.docType] ??= []).push(token.trim());
  }
  return out;
}

export interface FieldExtractionOutcome {
  ruleId: string;
  fieldName: string;
  url: string;
  value: string | string[] | null;
  matched: boolean;
}

/**
 * Run every `field_extract` rule whose page this is.
 *
 * Pure: the caller supplies the text and persists the outcomes. A rule that does
 * not match returns `matched: false` with a null value, and it is the caller's
 * job to make sure that becomes *nothing written* rather than a stale value kept.
 */
export function applyFieldRules(
  rules: readonly ExtractionRule[],
  url: string,
  text: string,
): FieldExtractionOutcome[] {
  const here = url.toLowerCase();
  const out: FieldExtractionOutcome[] = [];

  for (const rule of rules) {
    if (rule.kind !== 'field_extract' || !rule.fieldName || !rule.url) continue;
    if (rule.url.toLowerCase() !== here) continue;
    if (!isLocator(rule.locator)) continue;

    const value = applyLocator(text, rule.locator as Locator);
    out.push({
      ruleId: rule.id,
      fieldName: rule.fieldName,
      url: rule.url,
      value,
      matched: value !== null,
    });
  }
  return out;
}

/**
 * Record that a rule ran, and whether it did what it promised.
 *
 * `last_applied_at` moves every run; `last_matched_at` only on a match. The two
 * diverging *is* the drift, and it is visible without reading the rule: a rule
 * applied yesterday and last matched in March has been failing since March.
 *
 * A rule is only marked broken after it applied — a rule whose page could not be
 * fetched at all has not been shown to be wrong, and calling it broken would
 * send the reviewer to re-teach a locator that is fine.
 */
export async function markRuleOutcome(
  dbInstance: any,
  ruleId: string,
  matched: boolean,
): Promise<void> {
  const now = new Date();
  await dbInstance
    .update(vendorExtractionRules)
    .set(
      matched
        ? { lastAppliedAt: now, lastMatchedAt: now, status: 'active' }
        : { lastAppliedAt: now, status: 'broken' },
    )
    .where(eq(vendorExtractionRules.id, ruleId));
}

export interface SaveRuleInput {
  db: any;
  vendorId: string;
  kind: string;
  docType?: string | null;
  fieldName?: string | null;
  url?: string | null;
  locator?: unknown;
  note?: string | null;
  authoredBy: string | null;
}

/**
 * Teach a rule, replacing any standing rule for the same target.
 *
 * Re-teaching upserts rather than stacks, so "what did I tell it about this
 * page" has one answer — the same reason an analyst correction upserts. Saving
 * also clears `broken`: re-teaching is the act that fixes a rule, and leaving
 * the old status would keep the vendor in the signal queue for a problem the
 * reviewer just solved.
 */
export async function saveRule(input: SaveRuleInput) {
  const problems = validateRule(input);
  if (problems.length > 0) throw new RuleError(problems.join('; '), 'bad_request');

  const now = new Date();
  const [row] = await input.db
    .insert(vendorExtractionRules)
    .values({
      vendorId: input.vendorId,
      kind: input.kind,
      docType: input.docType ?? null,
      fieldName: input.fieldName ?? null,
      url: input.url ?? null,
      locator: (input.locator ?? null) as Record<string, unknown> | null,
      note: (input.note ?? '').trim(),
      authoredBy: input.authoredBy,
      authoredAt: now,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [
        vendorExtractionRules.vendorId,
        vendorExtractionRules.kind,
        vendorExtractionRules.docType,
        vendorExtractionRules.fieldName,
        vendorExtractionRules.url,
      ],
      set: {
        locator: (input.locator ?? null) as Record<string, unknown> | null,
        note: (input.note ?? '').trim(),
        authoredBy: input.authoredBy,
        authoredAt: now,
        status: 'active',
        lastMatchedAt: null,
      },
    })
    .returning();

  return row;
}

/** Forget a rule. Deliberately a delete: an unlearned rule leaves no residue. */
export async function deleteRule(dbInstance: any, vendorId: string, ruleId: string) {
  const [row] = await dbInstance
    .delete(vendorExtractionRules)
    .where(and(eq(vendorExtractionRules.id, ruleId), eq(vendorExtractionRules.vendorId, vendorId)))
    .returning();
  if (!row) throw new RuleError('Rule not found for this vendor', 'not_found');
  return row;
}
