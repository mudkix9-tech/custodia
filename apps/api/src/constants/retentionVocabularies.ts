/**
 * E47–E52. The controlled vocabularies a retention schedule is built from.
 *
 * Same split as `ropaVocabularies.ts`: the values live here and validate the API,
 * the wording lives in the web catalogue. A schedule that printed `6_months` to a
 * regulator is D38, and the reason `formatRetentionPeriod` in `lib/retention.ts`
 * exists rather than a template literal at each call site.
 */

/**
 * E49. The unit half of a period.
 *
 * `indefinite` and `until_event` are units rather than a separate flag because a
 * schedule has exactly one period and the three cases are mutually exclusive. They
 * carry no number: an indefinite schedule with a value of 7 is a contradiction the
 * validator should be able to state, not a state the column can hold.
 */
export const RETENTION_PERIOD_UNITS = [
  'days',
  'weeks',
  'months',
  'years',
  'indefinite',
  'until_event',
] as const;
export type RetentionPeriodUnit = (typeof RETENTION_PERIOD_UNITS)[number];

/** The two that take no number. */
export const UNCOUNTED_PERIOD_UNITS: readonly RetentionPeriodUnit[] = ['indefinite', 'until_event'];

/** Days per unit, for the disposal-date arithmetic that is not calendar-aware. */
export const APPROX_DAYS_PER_UNIT: Record<string, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
};

/**
 * E48. The event a period runs from.
 *
 * Deliberately the same list `ropaVocabularies.RETENTION_TRIGGERS` already carries,
 * plus `contract_end` — which is not a synonym for `end_of_contract` but the alias
 * the onboarding templates seeded, and both are in the column today.
 */
export const RETENTION_TRIGGER_EVENTS = [
  'collection',
  'last_interaction',
  'end_of_contract',
  'end_of_employment',
  'account_closure',
  'consent_withdrawal',
  'case_closure',
  'statutory_period_end',
] as const;
export type RetentionTriggerEvent = (typeof RETENTION_TRIGGER_EVENTS)[number];

/**
 * Which triggers have a clock the register itself can start.
 *
 * `collection` is the only one: the activity's own creation date is a defensible
 * proxy for when it started collecting. Every other trigger is an event in a
 * business system Custodia does not watch, so the disposal date is computable only
 * once someone records the anchor — which is what `retention_anchor_at` is for, and
 * why "the trigger has not happened yet" is a distinct state in the report rather
 * than a missing value.
 */
export const SELF_ANCHORING_TRIGGERS: readonly RetentionTriggerEvent[] = ['collection'];

/**
 * What happens at the end of the period. Deletion is not the only lawful answer —
 * Art. 5(1)(e) is satisfied by anonymisation too, and a processor's obligation
 * under Art. 28(3)(g) is usually to return *or* delete at the controller's choice.
 */
export const DISPOSAL_METHODS = [
  'deletion',
  'anonymisation',
  'pseudonymisation',
  'return_to_controller',
  'archive',
] as const;
export type DisposalMethod = (typeof DISPOSAL_METHODS)[number];

export const DISPOSAL_STATUSES = ['due', 'completed', 'deferred', 'on_hold', 'not_required'] as const;
export type DisposalStatus = (typeof DISPOSAL_STATUSES)[number];

export const RETENTION_SCHEDULE_STATUSES = ['draft', 'active', 'retired'] as const;

/** E52. Why a hold exists. The type decides nothing in code; it is what a reader needs. */
export const LEGAL_HOLD_TYPES = [
  'litigation',
  'regulatory_investigation',
  'audit',
  'internal_investigation',
  'other',
] as const;
export type LegalHoldType = (typeof LEGAL_HOLD_TYPES)[number];

export const LEGAL_HOLD_STATUSES = ['active', 'released', 'expired'] as const;

/**
 * The six presets the editor's retention dropdown has always written, mapped onto
 * a structured period.
 *
 * D14/D38: these are stored in `processing_activities.retention_period` as slugs
 * and printed raw to regulators. Parsing them here means an existing register gets
 * disposal dates and readable periods without anyone re-entering anything, and it
 * is the bridge that lets `retentionAnswer()` treat a legacy string and a schedule
 * as the same kind of answer.
 */
export const LEGACY_PERIOD_PRESETS: Record<string, { value: number | null; unit: RetentionPeriodUnit }> = {
  '6_months': { value: 6, unit: 'months' },
  '1_year': { value: 1, unit: 'years' },
  '2_years': { value: 2, unit: 'years' },
  '3_years': { value: 3, unit: 'years' },
  '5_years': { value: 5, unit: 'years' },
  '6_years': { value: 6, unit: 'years' },
  '7_years': { value: 7, unit: 'years' },
  '10_years': { value: 10, unit: 'years' },
  'duration_of_contract': { value: null, unit: 'until_event' },
  'indefinite': { value: null, unit: 'indefinite' },
};
