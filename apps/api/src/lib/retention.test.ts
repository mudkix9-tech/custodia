/**
 * Fixtures for retention schedules and the data maps.
 *
 *   npx tsx src/lib/retention.test.ts
 *
 * Standalone style, like `ropaLifecycle.test.ts`, because apps/api has no vitest —
 * the vitest-style suites here typecheck but never execute. Both modules under test
 * are pure and import no database.
 *
 * Why these two together: they are the pair whose failures are invisible. A
 * disposal date that is out by a month reads exactly like one that is right, and
 * nothing downstream can tell them apart — the whole product between here and the
 * customer is a table of dates. A transfer map that counts `pending_assessment` as
 * a Chapter V mechanism renders a green row over an unsafeguarded transfer, which
 * is worse than no map at all: it is a map somebody will believe.
 */
import {
  formatRetentionPeriod,
  formatTrigger,
  parseFreeTextPeriod,
  retentionAnswer,
  computeDisposalDate,
  addPeriod,
  disposalDueKey,
  nextScheduleReview,
  validateSchedule,
  holdIsActive,
} from './retention.js';
import { buildActivityFlow, buildDataMap, buildTransferMap, type DataMapRow } from './ropaDataMap.js';

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

const at = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : 'null');

console.log('\nretention\n');

// --- formatRetentionPeriod (D38) ------------------------------------------------

check(formatRetentionPeriod(6, 'months') === '6 months', 'a counted period reads as words');
check(formatRetentionPeriod(1, 'years') === '1 year', 'one year is singular');
check(formatRetentionPeriod(null, 'indefinite') === 'Indefinite', 'indefinite has no number');
check(formatRetentionPeriod(null, 'until_event') === 'Until the trigger event', 'an event-bound period says so');
check(formatRetentionPeriod(null, 'years') === 'Not recorded', 'a counted unit with no number is not a period');
check(formatRetentionPeriod(7, 'fortnights') === 'Not recorded', 'an unknown unit is not silently printed');

check(formatTrigger('end_of_employment') === 'from the end of employment', 'a trigger reads as a phrase');
check(formatTrigger('nonsense') === '', 'an unknown trigger prints nothing rather than its own key');

// --- parseFreeTextPeriod (E49) --------------------------------------------------

check(parseFreeTextPeriod('6_months').value === 6, 'the legacy preset slug parses');
check(parseFreeTextPeriod('6_months').label === '6 months', 'and prints as words');
check(parseFreeTextPeriod('7 years').computable === true, 'the shape a human types parses');
check(parseFreeTextPeriod('duration_of_contract').unit === 'until_event', 'contract duration is event-bound');
check(parseFreeTextPeriod('duration_of_contract').computable === false, 'and produces no disposal date');

// The one that matters most. 'custom' was written by the old Custom option with
// nothing behind it, so scoring it as an answer is how a register reports itself
// complete while saying nothing about how long it keeps anything.
check(parseFreeTextPeriod('custom').source === 'none', 'the literal "custom" is nothing recorded, not a period');
check(parseFreeTextPeriod('').source === 'none', 'an empty string is nothing recorded');

// And the one that must NOT parse. A parser that guessed here would turn a note
// into a disposal date and delete something.
check(parseFreeTextPeriod('reviewed annually').source === 'free_text', 'prose is kept as prose');
check(parseFreeTextPeriod('reviewed annually').computable === false, 'and never produces a disposal date');
check(parseFreeTextPeriod('reviewed annually').label === 'reviewed annually', 'and is shown verbatim');

// --- retentionAnswer precedence -------------------------------------------------

const schedule = { periodValue: 6, periodUnit: 'years', trigger: 'end_of_employment', statutoryCitation: 'Limitation Act 1980 s.5' };

check(retentionAnswer({ schedule, freeText: '1_year' }).value === 6,
  'a schedule beats a free-text period on the same record',
  'A schedule is owned, cited and reviewed; a string is a note somebody left.');
check(retentionAnswer({ schedule, freeText: '1_year' }).source === 'schedule', 'and the register says which it used');
check(retentionAnswer({ schedule: null, freeText: '1_year' }).source === 'preset', 'with no schedule the string is used');
check(retentionAnswer({ schedule, freeText: null }).citation === 'Limitation Act 1980 s.5', 'the citation travels with the answer');

// --- addPeriod, the calendar arithmetic -----------------------------------------

check(iso(addPeriod(at('2026-01-15'), 6, 'months')) === '2026-07-15', 'six months from mid-January');
check(iso(addPeriod(at('2026-03-01'), 2, 'weeks')) === '2026-03-15', 'two weeks is fourteen days');
check(iso(addPeriod(at('2026-01-15'), 7, 'years')) === '2033-01-15', 'seven years lands on the same day');

// setUTCMonth overflows a short month — 31 January plus one is 3 March — and every
// statutory period that says "one month later" means the last day of February.
check(iso(addPeriod(at('2026-01-31'), 1, 'months')) === '2026-02-28',
  '31 January plus one month is 28 February, not 3 March',
  `Got ${iso(addPeriod(at('2026-01-31'), 1, 'months'))}.`);
check(iso(addPeriod(at('2024-02-29'), 1, 'years')) === '2025-02-28',
  '29 February plus a year clamps to 28 February in a non-leap year');
check(iso(addPeriod(at('2026-01-31'), 12, 'months')) === '2027-01-31',
  'a full year from 31 January does not drift');

// --- computeDisposalDate (E48) --------------------------------------------------

const collection = { periodValue: 2, periodUnit: 'years', trigger: 'collection' };
const employment = { periodValue: 6, periodUnit: 'years', trigger: 'end_of_employment' };

const computed = computeDisposalDate({ schedule: collection, createdAt: at('2024-01-10') });
check(computed.reason === 'computed', 'a collection-triggered schedule starts its own clock');
check(iso(computed.dueAt) === '2026-01-10', 'and lands two years after the activity was created');

// The distinction the whole report rests on. "The clock has not started" and "we
// have not decided how long" are different findings and send someone to fix
// different things.
const noAnchor = computeDisposalDate({ schedule: employment, createdAt: at('2024-01-10') });
check(noAnchor.reason === 'no_anchor', 'an employment schedule has no clock until an employment ends');
check(noAnchor.dueAt === null, 'and produces no date');

const anchored = computeDisposalDate({ schedule: employment, anchorAt: at('2025-06-30'), createdAt: at('2020-01-01') });
check(anchored.reason === 'computed' && iso(anchored.dueAt) === '2031-06-30',
  'a recorded anchor overrides the creation date entirely');

check(computeDisposalDate({ freeText: 'custom', createdAt: at('2024-01-10') }).reason === 'no_period',
  'no period recorded is no_period, not a date');
check(computeDisposalDate({ schedule: { periodUnit: 'indefinite' }, createdAt: at('2024-01-10') }).reason === 'indefinite',
  'indefinite retention is its own outcome');

// --- disposalDueKey, the idempotency key ----------------------------------------

const k1 = disposalDueKey('sched-1', at('2026-01-10'));
const k2 = disposalDueKey('sched-1', at('2026-01-10'));
check(k1 === k2, 'the same obligation produces the same key on every run',
  'The nightly scan has to find yesterday\'s row rather than write a second one.');
check(disposalDueKey('sched-1', at('2026-01-11')) !== k1, 'a moved due date is a new obligation');
check(disposalDueKey(null, at('2026-01-10')).startsWith('inline:'), 'a period with no schedule still keys stably');

// --- nextScheduleReview ---------------------------------------------------------

check(iso(nextScheduleReview(at('2026-01-15'), 12)) === '2027-01-15', 'a twelve-month cadence');
check(nextScheduleReview(at('2026-01-15'), null) === null,
  'no cadence means no review date',
  'A statutory period does not change because a year passed.');
check(nextScheduleReview(at('2026-01-15'), 0) === null, 'zero months is not a cadence');

// --- validateSchedule -----------------------------------------------------------

check(validateSchedule({ periodUnit: 'years', trigger: 'collection' }).some((i) => i.field === 'periodValue'),
  'a counted period with no number is reported');
check(validateSchedule({ periodUnit: 'indefinite', periodValue: 7, trigger: 'collection', justification: 'x' })
  .some((i) => i.field === 'periodValue'),
  'indefinite with a number is a contradiction, and is stated as one');
check(validateSchedule({ periodUnit: 'indefinite', trigger: 'collection' }).some((i) => i.field === 'justification'),
  'indefinite retention with no justification is a finding under Art. 5(1)(e)');
check(validateSchedule({ periodUnit: 'indefinite', trigger: 'collection', justification: 'Statutory archive duty.' })
  .every((i) => i.field !== 'justification'),
  'indefinite retention WITH a justification is lawful and is not reported',
  'Art. 5(1)(e) forbids undocumented indefinite retention, not indefinite retention.');
check(validateSchedule({ periodUnit: 'years', periodValue: 6, trigger: '' }).some((i) => i.field === 'trigger'),
  'a period with no trigger cannot produce a disposal date');
check(validateSchedule({ periodUnit: 'years', periodValue: 6, trigger: 'collection' }).length === 0,
  'a complete schedule reports nothing');

// --- holdIsActive (E52) ---------------------------------------------------------

const now = at('2026-08-21');
check(holdIsActive({ status: 'active', expiresAt: null }, now) === true, 'an open-ended active hold is in force');
check(holdIsActive({ status: 'active', expiresAt: at('2027-01-01') }, now) === true, 'a future expiry is in force');
check(holdIsActive({ status: 'active', expiresAt: at('2026-01-01') }, now) === false,
  'a hold whose expiry has passed is NOT in force even though nobody released it',
  'Treating it as active is how a register stops deleting altogether and nobody notices for years.');
check(holdIsActive({ status: 'active', releasedAt: at('2026-05-01') }, now) === false, 'a released hold is not in force');
check(holdIsActive({ status: 'released' }, now) === false, 'a released status is not in force');

console.log('\nropaDataMap\n');

// --- buildActivityFlow (D41) ----------------------------------------------------

const flow = buildActivityFlow({
  activity: { id: 'a1', name: 'Recruitment', purpose: 'Screen applications', lawfulBasis: 'legitimate_interest', role: 'controller' },
  dataSubjects: [{ id: 's1', category: 'Job applicants', volumeBand: '1k_10k' }],
  dataCategories: [
    { id: 'c1', category: 'CV', categoryGroup: 'Employment', source: 'The data subject' },
    { id: 'c2', category: 'Right to work', categoryGroup: 'Identity', source: 'The data subject' },
  ],
  recipients: [{ id: 'r1', name: 'Greenhouse', role: 'processor', vendorId: 'v1' }],
  transfers: [{ id: 't1', destinationCountry: 'US', vendorId: 'v1', transferMechanism: 'scc' }],
});

check(flow.nodes.some((n) => n.kind === 'activity'), 'the activity is a node');
check(flow.nodes.filter((n) => n.kind === 'source').length === 1,
  'two categories from one source is one source node',
  'Six categories collected on one web form is one arrow, not six.');
check(flow.edges.some((e) => e.from === 'recipient:r1' && e.to === 'transfer:t1'),
  'a transfer sharing the recipient\'s vendor hangs off the recipient',
  '"We send it to Greenhouse, and Greenhouse holds it in the US" is one path, not two facts.');

const flowNoVendor = buildActivityFlow({
  activity: { id: 'a1', name: 'X', purpose: 'Y' },
  dataSubjects: [], dataCategories: [], recipients: [],
  transfers: [{ id: 't9', destinationCountry: 'IN', transferMechanism: null }],
});
check(flowNoVendor.edges.some((e) => e.from === 'activity:a1' && e.to === 'transfer:t9'),
  'a transfer with no matching recipient hangs off the activity');
check(flowNoVendor.nodes.find((n) => n.id === 'transfer:t9')?.emphasis === 'high',
  'a transfer with no mechanism is emphasised — it is the finding');

const emptyFlow = buildActivityFlow({
  activity: { id: 'a2', name: 'Internal', purpose: 'Internal only' },
  dataSubjects: [], dataCategories: [], recipients: [], transfers: [],
});
check(emptyFlow.assertions.some((a) => a.includes('disclosed to any recipient')),
  'no recipients produces a negative assertion, not a blank column',
  'A reader cannot tell an empty diagram from an unfilled one.');
check(emptyFlow.assertions.some((a) => a.includes('third country')), 'no transfers produces a negative assertion');

// --- buildDataMap (D42/D44) -----------------------------------------------------

const rows: DataMapRow[] = [
  {
    activityId: 'a1', activityName: 'HR', status: 'active', role: 'controller', lawfulBasis: 'contract',
    subjectCategories: ['Employees'], dataCategories: ['Health records', 'Name'], specialCategories: ['Health records'],
    recipients: [{ name: 'BUPA', role: 'processor', vendorId: 'v9' }], countries: ['GB'], thirdCountries: [],
  },
  {
    activityId: 'a2', activityName: 'Marketing', status: 'active', role: 'controller', lawfulBasis: 'consent',
    subjectCategories: ['Prospective customers'], dataCategories: ['Email address'], specialCategories: [],
    recipients: [{ name: 'Mailchimp', role: 'processor', vendorId: null }], countries: ['US'], thirdCountries: ['US'],
  },
];

check(buildDataMap(rows, { specialCategoryOnly: true }).rows.length === 1,
  '"which activities process health data" is answerable');
check(buildDataMap(rows, { country: 'US' }).rows[0]?.activityId === 'a2',
  '"which send data to the US" is answerable');
check(buildDataMap(rows, { vendorId: 'v9' }).rows[0]?.activityId === 'a1',
  '"which involve this vendor" is answerable');
check(buildDataMap(rows, { dataCategory: 'name' }).rows.length === 1, 'category matching is case-insensitive');

const faceted = buildDataMap(rows, { country: 'US' });
check(faceted.facets.countries.length === 2,
  'facets are computed over everything, not over the filtered set',
  'A facet list that shrinks as you filter cannot be used to widen a search.');

// --- buildTransferMap (D43) -----------------------------------------------------

const map = buildTransferMap([
  { id: 't1', destinationCountry: 'US', transferMechanism: 'Standard Contractual Clauses (SCCs)', processingActivityId: 'a1', tiaRequired: true, tiaCompleted: true },
  { id: 't2', destinationCountry: 'US', transferMechanism: 'scc', processingActivityId: 'a2', tiaRequired: true, tiaCompleted: false },
  { id: 't3', destinationCountry: 'IN', transferMechanism: 'pending_assessment', processingActivityId: 'a3' },
  { id: 't4', destinationCountry: 'JP', transferMechanism: null, processingActivityId: 'a4' },
]);

const us = map.find((e) => e.country === 'US')!;
check(us.mechanisms.length === 1 && us.mechanisms[0]!.mechanism === 'scc',
  'the two vocabularies in the column collapse to one mechanism',
  'D43: the UI wrote English display strings and automation wrote slugs, into one varchar.');
check(us.transferCount === 2 && us.activityCount === 2, 'transfers and activities are counted separately');
check(us.unsafeguardedCount === 0, 'a real mechanism is not counted as unsafeguarded');
check(us.tiaRequired === 2 && us.tiaCompleted === 1, 'TIA position is carried per destination');

const india = map.find((e) => e.country === 'IN')!;
check(india.unsafeguardedCount === 1,
  'pending_assessment is the absence of a mechanism, not a mechanism',
  'It reads as one in the column, which is exactly why the map has to say otherwise.');
check(map.find((e) => e.country === 'JP')!.unsafeguardedCount === 1, 'a null mechanism is unsafeguarded');
check(map[0]!.unsafeguardedCount > 0, 'unsafeguarded destinations sort to the top');

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('retention + ropaDataMap OK.\n');
