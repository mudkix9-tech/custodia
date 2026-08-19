/**
 * The register's lifecycle rules — review cadence, approval transitions and
 * version diffing.
 *
 * Pure, for the same reason `ropaCompleteness.ts` is pure: these are the decisions
 * that get made on the user's behalf, and the only test style that runs in
 * `apps/api` is a standalone `tsx` fixture over a function with no database
 * behind it. A review date that lands a month late is invisible in a browser and
 * invisible to `tsc`; it shows up as a register that quietly stopped nagging.
 *
 * Nothing here touches the clock on its own. Every function that needs "now" takes
 * it as an argument, which is what makes an overdue queue testable at all.
 */

import type { ActivityBundle } from './ropaCompleteness.js';

// ---------------------------------------------------------------------------
// Review cycle (B19)
// ---------------------------------------------------------------------------

/**
 * Cadences offered per activity. Twelve months is the default because that is what
 * most supervisory authorities expect of a register, and 0 is *not* one of these —
 * exemption is expressed by choosing "no cadence", which stores null, not by a
 * zero that would read as "review immediately" to anything doing arithmetic.
 */
export const REVIEW_CADENCES = [3, 6, 12, 24] as const;
export type ReviewCadence = (typeof REVIEW_CADENCES)[number];

export const DEFAULT_REVIEW_CADENCE_MONTHS = 12;

/**
 * The cadence that applies to one activity: its own, else the organisation's
 * default, else twelve months.
 *
 * `null` on the activity means "inherit"; a *number* means the activity has
 * decided for itself and the org default must not override it. Those two states
 * are why this cannot be a `??` chain at the call site — `0` is falsy and would
 * silently inherit, turning a deliberate exemption back into a nagging record.
 */
export function effectiveCadenceMonths(
  activityCadence: number | null | undefined,
  orgDefault?: number | null,
): number {
  if (typeof activityCadence === 'number') return activityCadence;
  if (typeof orgDefault === 'number' && orgDefault > 0) return orgDefault;
  return DEFAULT_REVIEW_CADENCE_MONTHS;
}

/**
 * The next review date, `months` after `from`.
 *
 * `setMonth` overflows rather than clamping — 31 January plus one month is 3 March
 * — which would drift a review date forward by up to three days every cycle. The
 * clamp keeps "the 31st" meaning "the last day of the month".
 */
export function addMonths(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const next = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth() + months,
    1,
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  ));
  const lastDayOfTarget = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDayOfTarget));
  return next;
}

/** `null` when the cadence is 0 or negative — a record deliberately exempt from review. */
export function nextReviewFrom(reviewedAt: Date, cadenceMonths: number): Date | null {
  if (!Number.isFinite(cadenceMonths) || cadenceMonths <= 0) return null;
  return addMonths(reviewedAt, cadenceMonths);
}

export type ReviewStanding = 'never_reviewed' | 'overdue' | 'due_soon' | 'current' | 'exempt';

/**
 * Where one activity stands against its review cycle.
 *
 * "Never reviewed" is deliberately not the same as "overdue": a register that has
 * just been imported is not delinquent, it is new, and reporting three hundred
 * overdue records on day one trains people to ignore the queue. It becomes overdue
 * the moment somebody sets a review date and lets it pass.
 */
export function reviewStanding(
  activity: { nextReviewAt?: Date | string | null; lastReviewedAt?: Date | string | null; reviewCadenceMonths?: number | null },
  now: Date,
  dueSoonDays = 30,
): ReviewStanding {
  if (activity.reviewCadenceMonths === 0) return 'exempt';
  if (!activity.nextReviewAt) {
    return activity.lastReviewedAt ? 'current' : 'never_reviewed';
  }
  const next = activity.nextReviewAt instanceof Date ? activity.nextReviewAt : new Date(activity.nextReviewAt);
  if (Number.isNaN(next.getTime())) return 'never_reviewed';

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.floor((next.getTime() - now.getTime()) / msPerDay);
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= dueSoonDays) return 'due_soon';
  return 'current';
}

/**
 * The reminder ladder B19 asks for, expressed as "how many days before the review
 * date does each rung fire".
 *
 * Negative numbers are the escalations *after* the date has passed. The worker
 * matches a review date against exactly one rung per run rather than "anything in
 * the past", which is what stops an overdue record emailing its owner nightly
 * forever.
 */
export const REVIEW_REMINDER_LADDER = [30, 7, 0, -14] as const;

export type ReviewReminderRung = (typeof REVIEW_REMINDER_LADDER)[number];

/**
 * The rung a review date falls on today, or null for a date on none of them.
 *
 * Compared in whole UTC days so a job that runs at 03:00 and one that runs at
 * 23:00 agree about which day it is — a comparison on raw timestamps fires the
 * "7 days out" reminder twice for records whose review date sits either side of
 * the run time.
 */
export function reminderRungFor(nextReviewAt: Date, now: Date): ReviewReminderRung | null {
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(nextReviewAt) - startOfDay(now)) / (24 * 60 * 60 * 1000));
  return (REVIEW_REMINDER_LADDER as readonly number[]).includes(days) ? (days as ReviewReminderRung) : null;
}

// ---------------------------------------------------------------------------
// Approval workflow (B20)
// ---------------------------------------------------------------------------

export const APPROVAL_STATES = ['draft', 'in_review', 'approved', 'rejected'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

/**
 * Which transitions the API will perform, keyed by the action requesting them.
 *
 * Written out rather than checked ad hoc in each mutation because the interesting
 * cases are the ones nobody thinks of: re-submitting a record that is already in
 * review would open a second approval row against the same activity (the partial
 * unique index refuses it, but a 500 is a worse answer than a 409), and approving
 * something nobody submitted would produce an approval record with no request
 * behind it.
 */
export const APPROVAL_TRANSITIONS: Record<'submit' | 'approve' | 'reject' | 'withdraw', readonly ApprovalState[]> = {
  submit: ['draft', 'rejected', 'approved'],
  approve: ['in_review'],
  reject: ['in_review'],
  withdraw: ['in_review'],
};

export function canTransition(action: keyof typeof APPROVAL_TRANSITIONS, from: string): boolean {
  return (APPROVAL_TRANSITIONS[action] as readonly string[]).includes(from);
}

/**
 * Whether an edit to an activity should knock it out of `approved`.
 *
 * Only substantive fields count. An approved record whose owner changes has not
 * become unapproved — approval is about what the register *says*, and the owner is
 * about who looks after it. Getting this wrong in the other direction is worse:
 * if every save re-opened approval, nobody would ever approve anything, which is
 * exactly the failure mode that makes approval workflows get switched off.
 */
export const APPROVAL_INVALIDATING_FIELDS: readonly string[] = [
  'name',
  'purpose',
  'description',
  'role',
  'controllerName',
  'lawfulBasis',
  'lawfulBasisDetail',
  'retentionPeriod',
  'retentionJustification',
  'deletionProcedure',
  'securityMeasures',
  'securityMeasuresDetail',
  'involvesProfiling',
  'involvesAutomatedDecisionMaking',
  'admLogic',
  'admSignificance',
  'admHumanIntervention',
  'isSystematicMonitoring',
];

export function editInvalidatesApproval(changedKeys: readonly string[]): boolean {
  return changedKeys.some((k) => APPROVAL_INVALIDATING_FIELDS.includes(k));
}

// ---------------------------------------------------------------------------
// Versioning (B21)
// ---------------------------------------------------------------------------

export type VersionSnapshot = {
  /** Bumped when the shape changes, so an old snapshot can still be read. */
  schema: 1;
  takenAt: string;
  activity: Record<string, any>;
  dataSubjects: Record<string, any>[];
  dataCategories: Record<string, any>[];
  recipients: Record<string, any>[];
  transfers: Record<string, any>[];
};

/**
 * Columns excluded from a snapshot, because they describe the *row* rather than
 * the record: keeping them would make every diff report that the version changed
 * because the version changed.
 */
const VOLATILE_KEYS = new Set([
  'updatedAt',
  'version',
  'previousVersionId',
  'completenessScore',
  'approvalState',
  'approvalRequestedAt',
  'approvalRequestedBy',
  'currentReviewerId',
  'approvedAt',
  'approvedBy',
]);

const stripVolatile = (row: Record<string, any>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !VOLATILE_KEYS.has(k)));

/** Child rows sorted by id, so two snapshots of unchanged data diff as identical. */
const normaliseChildren = (rows: any[]) =>
  [...rows]
    .map((r) => stripVolatile(r))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

export function buildSnapshot(bundle: ActivityBundle, takenAt: Date): VersionSnapshot {
  return {
    schema: 1,
    takenAt: takenAt.toISOString(),
    activity: stripVolatile(bundle.activity as Record<string, any>),
    dataSubjects: normaliseChildren(bundle.dataSubjects as any[]),
    dataCategories: normaliseChildren(bundle.dataCategories as any[]),
    recipients: normaliseChildren(bundle.recipients as any[]),
    transfers: normaliseChildren(bundle.transfers as any[]),
  };
}

export type FieldChange = { field: string; from: unknown; to: unknown };

export type SnapshotDiff = {
  activity: FieldChange[];
  /** Per child collection, what was added, removed and altered. */
  children: Record<string, { added: number; removed: number; changed: FieldChange[] }>;
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diffRows(from: Record<string, any>, to: Record<string, any>, prefix = ''): FieldChange[] {
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  const out: FieldChange[] = [];
  for (const key of keys) {
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
    if (!sameValue(from[key], to[key])) out.push({ field: prefix + key, from: from[key] ?? null, to: to[key] ?? null });
  }
  return out.sort((a, b) => a.field.localeCompare(b.field));
}

/**
 * What changed between two snapshots.
 *
 * Child rows are matched on their primary key rather than on position: a diff that
 * pairs rows by index reports "every data category changed" the moment one is
 * deleted from the middle, which is worse than no diff at all — it is a diff
 * somebody will believe.
 */
export function diffSnapshots(from: VersionSnapshot, to: VersionSnapshot): SnapshotDiff {
  const collections = ['dataSubjects', 'dataCategories', 'recipients', 'transfers'] as const;
  const children: SnapshotDiff['children'] = {};

  for (const name of collections) {
    const before = new Map((from[name] ?? []).map((r) => [String(r.id), r]));
    const after = new Map((to[name] ?? []).map((r) => [String(r.id), r]));
    const changed: FieldChange[] = [];

    for (const [id, row] of after) {
      const previous = before.get(id);
      if (previous) changed.push(...diffRows(previous, row, ''));
    }

    children[name] = {
      added: [...after.keys()].filter((id) => !before.has(id)).length,
      removed: [...before.keys()].filter((id) => !after.has(id)).length,
      changed,
    };
  }

  return { activity: diffRows(from.activity, to.activity), children };
}

// ---------------------------------------------------------------------------
// Search and filters (K102, K103)
// ---------------------------------------------------------------------------

/**
 * Completeness bands the register filters on.
 *
 * Bands rather than a slider because "show me everything under half-complete" is
 * the question, and a numeric range control invites people to ask questions the
 * score is not precise enough to answer. Ranges are inclusive of `min`, exclusive
 * of `max`, so the bands tile 0–100 with no row falling between two of them.
 */
export const COMPLETENESS_BANDS = {
  low: { min: 0, max: 50 },
  medium: { min: 50, max: 80 },
  high: { min: 80, max: 101 },
} as const;

export type CompletenessBand = keyof typeof COMPLETENESS_BANDS;

/**
 * Escapes a user's search term for a SQL `LIKE` pattern.
 *
 * Without this, a purpose containing "100%" typed into the search box matches
 * every row in the register, and an underscore matches any character — which reads
 * as "search is broken" rather than "search has metacharacters".
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Tag vocabulary hygiene: trimmed, lowercased, de-duplicated, order preserved. */
export function normaliseTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Comments (M111)
// ---------------------------------------------------------------------------

/**
 * The user ids named in a comment body, as `@[Name](uuid)`.
 *
 * The display name travels in the text and the id in the link, because a mention
 * has to survive the person changing their name — and matching on a bare `@name`
 * would resolve to whoever happens to be called that today, which in a compliance
 * tool means notifying the wrong person about the wrong record.
 */
export function extractMentions(body: string): string[] {
  const pattern = /@\[[^\]]*\]\(([0-9a-fA-F-]{36})\)/g;
  const found = new Set<string>();
  for (const match of body.matchAll(pattern)) found.add(match[1]!.toLowerCase());
  return [...found];
}
