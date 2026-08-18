/**
 * Unit tests for the two pure helpers that decide what a customer's register says.
 *
 *   npx tsx src/constants/ropaVocabularies.test.ts
 *
 * Standalone style, like transferDestinations.test.ts, because apps/api has no
 * vitest. Both modules under test are pure and import nothing.
 *
 * `humaniseSubjectCategory` runs once per activity, during the backfill that turns
 * the onboarding templates' jsonb slugs into real rows. It is a one-way door: get it
 * wrong and a customer's Art. 30(1)(c) record permanently reads "website_visitors",
 * or worse, two categories collapse into one and a category silently disappears.
 *
 * `normaliseTransferMechanism` is what stops D43's two vocabularies rendering as an
 * empty picker over an existing row — a transfer whose mechanism looks unset is one
 * a DPO will "fix" by choosing a different one.
 */
import { humaniseSubjectCategory } from './ropaCatalogueSeeds.js';
import {
  normaliseTransferMechanism,
  article9RequiresNationalLaw,
  MECHANISM_REQUIRED_FIELDS,
  TRANSFER_MECHANISMS,
  ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW,
} from './ropaVocabularies.js';

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

console.log('\nropaVocabularies\n');

// --- the slugs the 32 onboarding templates actually write ----------------------

const TEMPLATE_SLUGS: Array<[string, string]> = [
  ['employees', 'Employees'],
  ['candidates', 'Job applicants'],
  ['customers', 'Customers'],
  ['website_visitors', 'Website visitors'],
  ['prospects', 'Prospective customers'],
  ['users', 'Customers'],
  ['clients', 'Customers'],
  ['prospective_clients', 'Prospective customers'],
  ['patients', 'Patients'],
  ['third_parties', 'Suppliers and vendor contacts'],
];

for (const [slug, expected] of TEMPLATE_SLUGS) {
  const got = humaniseSubjectCategory(slug);
  check(got === expected, `"${slug}" becomes "${expected}"`, `Got "${got}".`);
}

// --- prose is left alone -------------------------------------------------------

check(
  humaniseSubjectCategory('Next of kin and emergency contacts') === 'Next of kin and emergency contacts',
  'a catalogue name passes through untouched',
  'Title-casing it would produce "Next Of Kin And Emergency Contacts".',
);
check(
  humaniseSubjectCategory('Shareholders') === 'Shareholders',
  'a single capitalised word is already prose',
);
check(humaniseSubjectCategory('  employees  ') === 'Employees', 'surrounding whitespace is trimmed');
check(humaniseSubjectCategory('') === '', 'an empty string stays empty rather than becoming a row');

// --- an unmapped slug still reads like English ---------------------------------

check(
  humaniseSubjectCategory('scheme_trustees') === 'Scheme trustees',
  'an unmapped slug is humanised rather than shown raw',
  'CSV imports and hand-edited templates produce slugs the alias table has never seen.',
);
check(
  humaniseSubjectCategory('ex-employees') === 'Former employees',
  'hyphens normalise to the same key as underscores',
);

// --- collapsing is intentional, and the caller must dedupe ---------------------

check(
  humaniseSubjectCategory('users') === humaniseSubjectCategory('customers'),
  'two template slugs deliberately collapse onto one category',
  'Which is why backfillDataSubjects dedupes — the (activity, category) unique constraint would reject the second.',
);

// --- D43: both vocabularies in transfer_mechanism resolve ----------------------

const MECHANISM_CASES: Array<[string, string | null]> = [
  ['Standard Contractual Clauses (SCCs)', 'scc'],   // what the Transfers tab shipped
  ['pending_assessment', 'pending_assessment'],      // what the vendor auto-create writes
  ['scc', 'scc'],
  ['SCCs', 'scc'],
  ['Adequacy Decision', 'adequacy_decision'],
  ['Binding Corporate Rules (BCRs)', 'bcr'],
  ['Derogation (Art. 49)', 'art49_derogation'],
  ['EU-US Data Privacy Framework', 'dpf'],
  ['Other', 'other'],
];

for (const [stored, expected] of MECHANISM_CASES) {
  const got = normaliseTransferMechanism(stored);
  check(got === expected, `"${stored}" resolves to ${expected}`, `Got ${got}.`);
}

check(normaliseTransferMechanism(null) === null, 'a null mechanism resolves to null, not a default');
check(normaliseTransferMechanism('') === null, 'an empty mechanism resolves to null');
check(
  normaliseTransferMechanism('Something nobody has seen') === null,
  'an unrecognised mechanism resolves to null rather than guessing',
  'Guessing here would assert a Chapter V safeguard the customer never chose.',
);

// --- every mechanism states what it needs -------------------------------------

for (const mech of TRANSFER_MECHANISMS) {
  check(
    Object.prototype.hasOwnProperty.call(MECHANISM_REQUIRED_FIELDS, mech),
    `${mech} declares its required fields`,
    'A mechanism with no entry would silently score as complete with nothing recorded.',
  );
}

check(
  MECHANISM_REQUIRED_FIELDS.pending_assessment.length === 0,
  'pending_assessment requires nothing of its own',
  'It is a placeholder, not a mechanism. Demanding fields of it reports every freshly linked vendor as incomplete for a reason the user cannot act on.',
);
check(
  MECHANISM_REQUIRED_FIELDS.scc.includes('sccYear'),
  'SCCs require the clause set',
  'The 2010 clauses were repealed with effect from 27 December 2022, so the year decides whether the transfer is covered at all.',
);
check(
  MECHANISM_REQUIRED_FIELDS.dpf.includes('dpfScope'),
  'the DPF requires the certified scope',
  'An HR transfer to an importer certified for non-HR data alone has no mechanism.',
);

// --- Art. 9(2): which conditions rest on national law -------------------------

for (const condition of ['b', 'h', 'i', 'j']) {
  check(article9RequiresNationalLaw(condition), `9(2)(${condition}) requires Union or Member State law`);
}
for (const condition of ['a', 'c', 'd', 'e', 'f', 'g']) {
  check(!article9RequiresNationalLaw(condition), `9(2)(${condition}) does not`);
}
check(!article9RequiresNationalLaw(null), 'no condition recorded is not a national-law requirement');
check(
  ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW.length === 4,
  'exactly four conditions rest on national law',
  `Got ${ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW.length}.`,
);

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('ropaVocabularies OK.\n');
