/**
 * Fixtures for the register's lifecycle rules.
 *
 *   npx tsx src/lib/ropaLifecycle.test.ts
 *
 * Standalone style, like `transferDestinations.test.ts`, because apps/api has no
 * vitest — the vitest-style suites here typecheck but never execute. The module is
 * pure and imports one type, so no environment shim is needed.
 *
 * These exist for the same reason `ropaCompleteness.test.ts` does. Everything under
 * test decides something on the user's behalf and fails silently when it is wrong:
 * a review date that drifts three days a cycle looks fine in a browser; a reminder
 * ladder that matches "anything in the past" looks fine until an owner has been
 * emailed about the same record forty nights running; a diff that pairs child rows
 * by position looks fine and is a lie somebody will act on.
 */
import {
  addMonths,
  nextReviewFrom,
  effectiveCadenceMonths,
  reviewStanding,
  reminderRungFor,
  REVIEW_REMINDER_LADDER,
  canTransition,
  editInvalidatesApproval,
  buildSnapshot,
  diffSnapshots,
  COMPLETENESS_BANDS,
  escapeLikePattern,
  normaliseTags,
  extractMentions,
  DEFAULT_REVIEW_CADENCE_MONTHS,
  type VersionSnapshot,
} from './ropaLifecycle.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';

let failures = 0;
let checks = 0;

function check(ok: boolean, label: string, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : 'null');
const at = (s: string) => new Date(`${s}T00:00:00.000Z`);

console.log('\nropaLifecycle\n');

// --- addMonths -----------------------------------------------------------------

check(iso(addMonths(at('2026-01-15'), 12)) === '2027-01-15', 'twelve months from mid-January');
check(iso(addMonths(at('2026-08-19'), 3)) === '2026-11-19', 'three months crosses into November');

// The one that matters. setMonth overflows rather than clamping, so the naive
// version turns 31 January into 3 March and every subsequent cycle drifts further.
check(
  iso(addMonths(at('2026-01-31'), 1)) === '2026-02-28',
  '31 January plus one month is the last day of February, not 3 March',
  `Got ${iso(addMonths(at('2026-01-31'), 1))}.`,
);
check(
  iso(addMonths(at('2024-01-31'), 1)) === '2024-02-29',
  'the clamp knows about leap years',
  `Got ${iso(addMonths(at('2024-01-31'), 1))}.`,
);
check(
  iso(addMonths(at('2026-05-31'), 1)) === '2026-06-30',
  '31 May plus one month is 30 June',
  `Got ${iso(addMonths(at('2026-05-31'), 1))}.`,
);
check(iso(addMonths(at('2026-12-15'), 1)) === '2027-01-15', 'December rolls the year over');

// --- effectiveCadenceMonths ----------------------------------------------------

check(effectiveCadenceMonths(6, 24) === 6, 'the activity wins over the org default');
check(effectiveCadenceMonths(null, 24) === 24, 'null on the activity inherits the org default');
check(
  effectiveCadenceMonths(undefined, undefined) === DEFAULT_REVIEW_CADENCE_MONTHS,
  'with nothing configured, twelve months',
);
// The distinction the whole function exists for: 0 is falsy, so a `??` chain would
// swallow a deliberate exemption and put the record back in the nagging queue.
check(
  effectiveCadenceMonths(0, 12) === 0,
  'a cadence of 0 is an exemption, not "unset"',
  'A ?? chain would return the org default here and re-enrol an exempt record.',
);

// --- nextReviewFrom ------------------------------------------------------------

check(iso(nextReviewFrom(at('2026-08-19'), 12)) === '2027-08-19', 'annual review lands a year out');
check(nextReviewFrom(at('2026-08-19'), 0) === null, 'an exempt record gets no review date');
check(nextReviewFrom(at('2026-08-19'), -3) === null, 'a negative cadence is refused rather than reversed');

// --- reviewStanding ------------------------------------------------------------

const now = at('2026-08-19');

check(reviewStanding({ nextReviewAt: at('2026-08-01') }, now) === 'overdue', 'a past date is overdue');
check(reviewStanding({ nextReviewAt: at('2026-09-01') }, now) === 'due_soon', 'thirteen days out is due soon');
check(reviewStanding({ nextReviewAt: at('2027-01-01') }, now) === 'current', 'four months out is current');
check(reviewStanding({ nextReviewAt: at('2026-09-18') }, now) === 'due_soon', 'the 30-day window is inclusive at its edge');
check(reviewStanding({ nextReviewAt: at('2026-09-19') }, now) === 'current', 'one day past the window is current');

// A freshly imported register is not delinquent. Reporting three hundred overdue
// records on day one is how a queue gets ignored for good.
check(
  reviewStanding({ nextReviewAt: null, lastReviewedAt: null }, now) === 'never_reviewed',
  'a record with no review date is "never reviewed", not overdue',
);
check(
  reviewStanding({ nextReviewAt: null, lastReviewedAt: at('2026-01-01') }, now) === 'current',
  'reviewed once with no next date scheduled is current, not overdue',
);
check(reviewStanding({ nextReviewAt: at('2020-01-01'), reviewCadenceMonths: 0 }, now) === 'exempt',
  'an exempt record is exempt even with a stale date on it');
check(reviewStanding({ nextReviewAt: 'not a date' as any }, now) === 'never_reviewed',
  'an unparseable date does not become "overdue since 1970"');

// --- reminderRungFor -----------------------------------------------------------

check(reminderRungFor(at('2026-09-18'), now) === 30, 'thirty days out is a rung');
check(reminderRungFor(at('2026-08-26'), now) === 7, 'seven days out is a rung');
check(reminderRungFor(at('2026-08-19'), now) === 0, 'the day itself is a rung');
check(reminderRungFor(at('2026-08-05'), now) === -14, 'fourteen days overdue is the escalation');

// The property that stops the nightly-email failure mode: every other day is silent.
check(reminderRungFor(at('2026-08-18'), now) === null, 'one day overdue is not a rung');
check(reminderRungFor(at('2026-08-04'), now) === null, 'fifteen days overdue is not a rung');
check(reminderRungFor(at('2026-08-25'), now) === null, 'eight days out is not a rung');
check(
  REVIEW_REMINDER_LADDER.filter((d) => reminderRungFor(at('2026-08-19'), now) === d).length === 1,
  'a date matches exactly one rung',
);

// Times of day must not shift the rung, or a job that runs at 03:00 and one that
// runs at 23:00 disagree about which day it is and the 7-day reminder fires twice.
check(
  reminderRungFor(new Date('2026-08-26T23:30:00Z'), new Date('2026-08-19T03:00:00Z')) === 7,
  'rungs are whole UTC days, not elapsed hours',
);

// --- approval transitions ------------------------------------------------------

check(canTransition('submit', 'draft'), 'a draft can be submitted');
check(canTransition('submit', 'rejected'), 'a rejected record can be resubmitted');
check(canTransition('submit', 'approved'), 'an approved record can be resubmitted after a change');
check(!canTransition('submit', 'in_review'), 'a record already in review cannot be submitted twice',
  'The partial unique index would refuse it, but a 500 is a worse answer than a 409.');
check(canTransition('approve', 'in_review'), 'only an in-review record can be approved');
check(!canTransition('approve', 'draft'), 'approving something nobody submitted is refused');
check(!canTransition('reject', 'approved'), 'an approved record is not rejectable without resubmission');
check(!canTransition('withdraw', 'draft'), 'there is nothing to withdraw from a draft');

// --- editInvalidatesApproval ---------------------------------------------------

check(editInvalidatesApproval(['purpose']), 'rewriting the purpose un-approves the record');
check(editInvalidatesApproval(['lawfulBasis', 'businessOwnerId']), 'one substantive field is enough');
check(editInvalidatesApproval(['securityMeasures']), 'Art. 30(1)(g) measures are substantive');
check(
  !editInvalidatesApproval(['businessOwnerId', 'privacyOwnerId', 'tags', 'reviewCadenceMonths']),
  'ownership, tags and cadence do not un-approve a record',
  'If every save re-opened approval, nothing would ever stay approved and the workflow would be switched off.',
);
check(!editInvalidatesApproval([]), 'a save that changed nothing changes nothing');

// --- snapshots and diffs -------------------------------------------------------

const baseActivity = {
  id: 'a1', name: 'Payroll', purpose: 'Paying people', retentionPeriod: '6_years',
  updatedAt: new Date('2026-08-19'), version: 3, completenessScore: 71, approvalState: 'approved',
};
const bundleOf = (activity: any, categories: any[]) => ({
  activity, dataSubjects: [], dataCategories: categories, recipients: [], transfers: [],
} as any);

const snapA = buildSnapshot(bundleOf(baseActivity, [
  { id: 'c1', category: 'Bank details', retentionPeriod: '6_years' },
  { id: 'c2', category: 'Salary', retentionPeriod: '6_years' },
  { id: 'c3', category: 'NI number', retentionPeriod: '6_years' },
]), at('2026-08-19'));

check(snapA.schema === 1, 'a snapshot records its own shape version');
check(!('updatedAt' in snapA.activity), 'volatile row metadata is stripped from the snapshot');
check(!('completenessScore' in snapA.activity), 'the derived score is not part of the document');
check(
  !('approvalState' in snapA.activity),
  'approval state is not part of the document',
  'Otherwise approving a record makes the next diff report that approving it changed it.',
);

// The same data in a different order must diff as identical, or every snapshot
// looks like a change because Postgres returned the rows differently.
const snapAReordered = buildSnapshot(bundleOf({ ...baseActivity }, [
  { id: 'c3', category: 'NI number', retentionPeriod: '6_years' },
  { id: 'c1', category: 'Bank details', retentionPeriod: '6_years' },
  { id: 'c2', category: 'Salary', retentionPeriod: '6_years' },
]), at('2026-08-20'));

const noopDiff = diffSnapshots(snapA, snapAReordered);
check(noopDiff.activity.length === 0, 'an unchanged activity produces an empty diff');
check(
  noopDiff.children.dataCategories!.changed.length === 0
  && noopDiff.children.dataCategories!.added === 0
  && noopDiff.children.dataCategories!.removed === 0,
  'child rows returned in a different order are not a change',
  `Got ${JSON.stringify(noopDiff.children.dataCategories)}.`,
);

// The failure a positional diff produces: delete from the middle and it reports
// that everything after it changed.
const snapB = buildSnapshot(bundleOf(
  { ...baseActivity, purpose: 'Paying people and reporting to HMRC' },
  [
    { id: 'c1', category: 'Bank details', retentionPeriod: '6_years' },
    { id: 'c3', category: 'NI number', retentionPeriod: '10_years' },
    { id: 'c4', category: 'Pension', retentionPeriod: '6_years' },
  ],
), at('2026-08-21'));

const realDiff = diffSnapshots(snapA, snapB);
check(realDiff.activity.length === 1 && realDiff.activity[0]!.field === 'purpose',
  'exactly the field that changed is reported',
  `Got ${JSON.stringify(realDiff.activity)}.`);
check(realDiff.activity[0]!.from === 'Paying people', 'the diff carries the old value');
check(realDiff.children.dataCategories!.removed === 1, 'the deleted category is counted as removed');
check(realDiff.children.dataCategories!.added === 1, 'the new category is counted as added');
check(
  realDiff.children.dataCategories!.changed.length === 1
  && realDiff.children.dataCategories!.changed[0]!.field === 'retentionPeriod',
  'only the row that actually changed is reported as changed',
  `A positional diff reports three here. Got ${JSON.stringify(realDiff.children.dataCategories!.changed)}.`,
);

// --- completeness bands --------------------------------------------------------

const bandFor = (score: number) =>
  Object.entries(COMPLETENESS_BANDS).find(([, r]) => score >= r.min && score < r.max)?.[0];

check(bandFor(0) === 'low', '0 falls in the low band');
check(bandFor(49) === 'low', '49 is low');
check(bandFor(50) === 'medium', '50 is medium, not low');
check(bandFor(79) === 'medium', '79 is medium');
check(bandFor(80) === 'high', '80 is high');
check(bandFor(100) === 'high', '100 is high — the top band is open at 101 so nothing falls out');

// --- cursor round-trip ---------------------------------------------------------
//
// Not part of ropaLifecycle, but reachable only because K102's sort options are: the
// register can now be ordered by name and by completeness score, and the cursor
// decoder used to decide whether a value was a date by trying to parse it. Both new
// options produce values that parse — an activity called "2024", a score of 85 — and
// the failure is a list that silently stops after one page.

check(decodeCursor(encodeCursor(at('2026-08-19'), 'x')).isDate === true, 'a Date round-trips as a date');
check(
  decodeCursor(encodeCursor(at('2026-08-19'), 'x')).sortValue === '2026-08-19T00:00:00.000Z',
  'a Date round-trips as its ISO string',
);
check(
  decodeCursor(encodeCursor('2024', 'x')).isDate === false,
  'an activity named "2024" is not a date',
  'new Date("2024") parses, which is what made the second page of a name-sorted list empty.',
);
check(
  decodeCursor(encodeCursor('March 2024', 'x')).isDate === false,
  'an activity named "March 2024" is not a date',
);
check(
  decodeCursor(encodeCursor(85, 'x')).isDate === false && decodeCursor(encodeCursor(85, 'x')).sortValue === 85,
  'a completeness score stays a number',
  'new Date(85) is 85ms past the epoch, which would compare an integer column against a timestamp.',
);
check(decodeCursor(encodeCursor('Payroll', 'x')).sortValue === 'Payroll', 'an ordinary name round-trips unchanged');
check(decodeCursor(encodeCursor('Payroll', 'x')).id === 'x', 'the id round-trips');

// Cursors minted before the flag existed are held in open tabs; they must keep working.
const legacy = Buffer.from(JSON.stringify({ s: '2026-08-19T00:00:00.000Z', i: 'x' })).toString('base64url');
check(decodeCursor(legacy).isDate === true, 'a cursor with no flag falls back to sniffing');

// --- escapeLikePattern ---------------------------------------------------------

check(escapeLikePattern('100%') === '100\\%', 'a percent sign is escaped');
check(escapeLikePattern('a_b') === 'a\\_b', 'an underscore is escaped');
check(escapeLikePattern('back\\slash') === 'back\\\\slash', 'a backslash is escaped first');
check(escapeLikePattern('payroll') === 'payroll', 'ordinary text is untouched');

// --- normaliseTags -------------------------------------------------------------

check(JSON.stringify(normaliseTags([' Payroll ', 'payroll', 'HR'])) === JSON.stringify(['payroll', 'hr']),
  'tags are trimmed, lowercased and de-duplicated');
check(JSON.stringify(normaliseTags(['finance  team'])) === JSON.stringify(['finance team']),
  'runs of whitespace collapse');
check(normaliseTags(['', '   ']).length === 0, 'empty tags are dropped');
check(JSON.stringify(normaliseTags(['b', 'a'])) === JSON.stringify(['b', 'a']), 'order is preserved');

// --- extractMentions -----------------------------------------------------------

const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';

check(JSON.stringify(extractMentions(`hi @[Ana](${id1})`)) === JSON.stringify([id1]), 'one mention is found');
check(extractMentions(`@[Ana](${id1}) and @[Bo](${id2})`).length === 2, 'two mentions are found');
check(extractMentions(`@[Ana](${id1}) @[Ana Again](${id1})`).length === 1, 'the same person twice is one mention');
check(extractMentions('email me at ana@example.com').length === 0, 'a bare email address is not a mention');
check(extractMentions('@ana').length === 0, 'a bare @name is not a mention',
  'Matching on a name would resolve to whoever happens to be called that today.');
check(extractMentions(`@[Ana](${id1.toUpperCase()})`)[0] === id1, 'mention ids are lowercased for comparison');

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('ropaLifecycle OK.\n');
