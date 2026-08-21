/**
 * E47–E52. Retention schedules, disposal dates, and what a register actually
 * answers when it is asked "how long do you keep this".
 *
 * Pure, for the same reason `ropaCompleteness.ts` is: it decides legal questions
 * and returns plausible-looking values when it is wrong. A disposal date that is
 * out by a month reads exactly like one that is right, and the only thing that can
 * tell them apart is a fixture. No database, no dates beyond what is passed in.
 *
 * The one judgement worth stating up front: a *period* and a *trigger* are both
 * required for a retention rule to mean anything, and the register has spent its
 * whole life storing only the first. "Six years" is not an answer to Art. 30(1)(f);
 * "six years from the end of the contract" is, and the two produce disposal dates a
 * decade apart for the same employment record.
 */

import {
  LEGACY_PERIOD_PRESETS,
  SELF_ANCHORING_TRIGGERS,
  UNCOUNTED_PERIOD_UNITS,
  type RetentionPeriodUnit,
  type RetentionTriggerEvent,
} from '../constants/retentionVocabularies.js';

export type ScheduleInput = {
  id?: string | null;
  name?: string | null;
  periodValue?: number | null;
  periodUnit?: string | null;
  trigger?: string | null;
  triggerDetail?: string | null;
  statutoryCitation?: string | null;
  jurisdiction?: string | null;
  justification?: string | null;
  disposalMethod?: string | null;
  status?: string | null;
};

/**
 * A period expressed the same way whatever it came from — a schedule, a legacy
 * preset slug, or prose someone typed.
 *
 * `source` is what makes the register able to say *why* it believes the answer. A
 * period parsed out of the word "custom" and a period read off an owned, cited
 * schedule are both strings on screen and are not the same evidence.
 */
export type ResolvedPeriod = {
  value: number | null;
  unit: RetentionPeriodUnit;
  /** Human-readable, English. The web renders its own through the catalogue. */
  label: string;
  /** schedule | preset | free_text | none */
  source: 'schedule' | 'preset' | 'free_text' | 'none';
  /** True when the period has a number and a unit the arithmetic understands. */
  computable: boolean;
};

const UNIT_LABELS: Record<string, [string, string]> = {
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months'],
  years: ['year', 'years'],
};

/**
 * D38. Anything that reaches a reader goes through here.
 *
 * The register printed `6_months` and `duration_of_contract` into the list, the
 * CSV and both PDFs for a year. A formatter is cheap; the alternative is a
 * regulator reading a snake_case identifier in a document that calls itself an
 * Article 30 record.
 */
export function formatRetentionPeriod(value: number | null | undefined, unit?: string | null): string {
  const u = (unit ?? '') as RetentionPeriodUnit;
  if (u === 'indefinite') return 'Indefinite';
  if (u === 'until_event') return 'Until the trigger event';
  const labels = UNIT_LABELS[u];
  if (!labels || value === null || value === undefined || !Number.isFinite(value)) return 'Not recorded';
  return `${value} ${value === 1 ? labels[0] : labels[1]}`;
}

/** The trigger, in words, for a document rather than a form. */
export function formatTrigger(trigger?: string | null): string {
  switch (trigger) {
    case 'collection': return 'from collection';
    case 'last_interaction': return 'from the last interaction';
    case 'end_of_contract': return 'from the end of the contract';
    case 'end_of_employment': return 'from the end of employment';
    case 'account_closure': return 'from account closure';
    case 'consent_withdrawal': return 'from withdrawal of consent';
    case 'case_closure': return 'from closure of the case';
    case 'statutory_period_end': return 'from the end of the statutory period';
    default: return '';
  }
}

/**
 * E49. A free-text period, parsed where it can be and left alone where it cannot.
 *
 * Deliberately forgiving in one direction only: it recognises what the product has
 * actually written into the column (the presets, plus the "7 years" shape a human
 * types) and returns `free_text` for everything else rather than guessing. A parser
 * that guessed would turn "reviewed annually" into a one-year disposal date and
 * delete something.
 */
export function parseFreeTextPeriod(raw?: string | null): ResolvedPeriod {
  const text = (raw ?? '').trim();
  // 'custom' is the literal the old Custom option wrote with nothing behind it,
  // which is "nothing was recorded" rather than a period — the same judgement
  // `hasRetention` makes in ropaCompleteness.ts.
  if (!text || text.toLowerCase() === 'custom') {
    return { value: null, unit: 'until_event', label: 'Not recorded', source: 'none', computable: false };
  }

  const preset = LEGACY_PERIOD_PRESETS[text.toLowerCase()];
  if (preset) {
    return {
      value: preset.value,
      unit: preset.unit,
      label: formatRetentionPeriod(preset.value, preset.unit),
      source: 'preset',
      computable: preset.value !== null && !UNCOUNTED_PERIOD_UNITS.includes(preset.unit),
    };
  }

  const m = /^(\d{1,3})\s*(day|week|month|year)s?\b/i.exec(text);
  if (m) {
    const value = Number(m[1]);
    const unit = `${m[2]!.toLowerCase()}s` as RetentionPeriodUnit;
    return { value, unit, label: formatRetentionPeriod(value, unit), source: 'preset', computable: true };
  }

  return { value: null, unit: 'until_event', label: text, source: 'free_text', computable: false };
}

/**
 * Art. 30(1)(f), answered once, from whichever source the register actually holds.
 *
 * The precedence is the point. A schedule is an owned, cited, reviewed object and a
 * free-text string is a note someone left; when both exist the schedule wins, and
 * the register says which one it used rather than silently preferring one.
 */
export function retentionAnswer(opts: {
  schedule?: ScheduleInput | null;
  freeText?: string | null;
}): ResolvedPeriod & { trigger: string | null; citation: string | null } {
  const { schedule, freeText } = opts;

  if (schedule && schedule.periodUnit) {
    const unit = schedule.periodUnit as RetentionPeriodUnit;
    const value = schedule.periodValue ?? null;
    return {
      value,
      unit,
      label: formatRetentionPeriod(value, unit),
      source: 'schedule',
      computable: value !== null && !UNCOUNTED_PERIOD_UNITS.includes(unit),
      trigger: schedule.trigger ?? null,
      citation: schedule.statutoryCitation ?? null,
    };
  }

  const parsed = parseFreeTextPeriod(freeText);
  return { ...parsed, trigger: null, citation: null };
}

/**
 * E48. The disposal date, or a stated reason there is not one.
 *
 * Three outcomes rather than a nullable date, because "we have not decided how
 * long" and "the clock has not started" are different findings and a report that
 * flattened them would send someone to fix the wrong thing. `no_anchor` in
 * particular is the ordinary state of a correctly configured employment schedule
 * until an employment actually ends.
 *
 * Months and years are added by calendar rather than by 30/365, so a seven-year
 * period from 29 February lands on a real date and a monthly period does not drift.
 */
export function computeDisposalDate(opts: {
  schedule?: ScheduleInput | null;
  freeText?: string | null;
  /** When the trigger event happened, where anything recorded it. */
  anchorAt?: Date | string | null;
  /** Stands in for the anchor when the trigger is one the register can start itself. */
  createdAt?: Date | string | null;
}): { dueAt: Date | null; reason: 'computed' | 'no_period' | 'no_anchor' | 'indefinite'; period: ResolvedPeriod } {
  const period = retentionAnswer({ schedule: opts.schedule, freeText: opts.freeText });

  if (period.unit === 'indefinite') return { dueAt: null, reason: 'indefinite', period };
  if (!period.computable || period.value === null) return { dueAt: null, reason: 'no_period', period };

  const trigger = (opts.schedule?.trigger ?? 'collection') as RetentionTriggerEvent;
  const explicit = toDate(opts.anchorAt);
  const anchor = explicit
    ?? (SELF_ANCHORING_TRIGGERS.includes(trigger) ? toDate(opts.createdAt) : null);

  if (!anchor) return { dueAt: null, reason: 'no_anchor', period };

  return { dueAt: addPeriod(anchor, period.value, period.unit), reason: 'computed', period };
}

function toDate(v?: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calendar-aware addition. `setUTCMonth` overflows a short month — 31 January plus
 * one month is 3 March — so the day is clamped to the end of the target month,
 * which is what every statutory period means by "one month later".
 */
export function addPeriod(from: Date, value: number, unit: RetentionPeriodUnit): Date {
  const d = new Date(from.getTime());
  if (unit === 'days') { d.setUTCDate(d.getUTCDate() + value); return d; }
  if (unit === 'weeks') { d.setUTCDate(d.getUTCDate() + value * 7); return d; }

  const months = unit === 'years' ? value * 12 : value;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * The idempotency key for one activity's disposal obligation.
 *
 * The scan runs nightly and must find yesterday's row rather than write a second
 * one, so the key has to be a function of the *obligation* and not of the run. The
 * due date is that function: it only moves when the schedule or the anchor moves,
 * which is exactly when a genuinely new obligation exists.
 */
export function disposalDueKey(scheduleId: string | null, dueAt: Date): string {
  return `${scheduleId ?? 'inline'}:${dueAt.toISOString().slice(0, 10)}`;
}

/**
 * E50. When the schedule should next be looked at.
 *
 * Null cadence means the schedule is not on a review cycle, which is a legitimate
 * answer for a rule fixed by statute — the Companies Act does not change because a
 * year passed. A zero would mean the same thing and read as a bug.
 */
export function nextScheduleReview(from: Date, intervalMonths?: number | null): Date | null {
  if (!intervalMonths || intervalMonths <= 0) return null;
  return addPeriod(from, intervalMonths, 'months');
}

export type ScheduleIssue = { field: string; message: string };

/**
 * What is wrong with a schedule, stated rather than rejected.
 *
 * Saving is not blocked on any of these: a schedule written over a week is a
 * schedule half-finished for most of that week, and a form that refuses to keep an
 * incomplete answer is a form people finish in Word — the same reasoning that took
 * five NOT NULLs off `legitimate_interest_assessments` in Sprint 3. The issues are
 * shown, and the two that matter feed the gap rules.
 */
export function validateSchedule(input: ScheduleInput): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const unit = (input.periodUnit ?? '') as RetentionPeriodUnit;
  const uncounted = UNCOUNTED_PERIOD_UNITS.includes(unit);

  if (!uncounted && (input.periodValue === null || input.periodValue === undefined)) {
    issues.push({ field: 'periodValue', message: 'A counted period needs a number.' });
  }
  if (uncounted && input.periodValue !== null && input.periodValue !== undefined) {
    issues.push({ field: 'periodValue', message: 'An indefinite or event-bound period cannot also carry a number.' });
  }
  // Art. 5(1)(e) does not forbid indefinite retention; it forbids undocumented
  // indefinite retention. This is the one issue that is a compliance finding rather
  // than a data-entry slip, which is why P124 has a rule for it too.
  if (unit === 'indefinite' && !(input.justification ?? '').trim()) {
    issues.push({ field: 'justification', message: 'Indefinite retention has to be justified under Art. 5(1)(e).' });
  }
  if (unit === 'until_event' && !(input.triggerDetail ?? '').trim()) {
    issues.push({ field: 'triggerDetail', message: 'Name the event the period ends on.' });
  }
  if (!(input.trigger ?? '').trim()) {
    issues.push({ field: 'trigger', message: 'A period with no trigger cannot produce a disposal date.' });
  }
  return issues;
}

/**
 * E52. Whether a hold covers this activity right now.
 *
 * Expiry is evaluated rather than trusted: a hold with a past expiry that nobody
 * released is not suspending anything, and treating it as active is how a register
 * stops deleting altogether and only notices years later.
 */
export function holdIsActive(
  hold: { status?: string | null; expiresAt?: Date | string | null; releasedAt?: Date | string | null },
  now: Date,
): boolean {
  if (hold.status === 'released' || hold.releasedAt) return false;
  const expires = toDate(hold.expiresAt ?? null);
  if (expires && expires.getTime() <= now.getTime()) return false;
  return hold.status !== 'expired';
}
