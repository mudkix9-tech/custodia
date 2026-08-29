/**
 * Unit tests for the Chapter V destination test.
 *
 *   npx tsx src/constants/transferDestinations.test.ts
 *
 * Standalone style, like consentEvaluator.fixtures.test.ts, because apps/api has no
 * vitest — the vitest-style suites here typecheck but never execute. This module is
 * pure and imports nothing, so no standaloneEnv shim is needed.
 *
 * These exist because `ropa.recipients.create` carried its own hardcoded EU-27 array
 * and auto-created a draft transfer "requiring SCCs" for every vendor headquartered
 * in Norway, the UK, Switzerland, Japan, Canada and thirteen other adequate
 * destinations. Two copies of the same list is how that happens; a test on the
 * surviving one is what stops it happening again.
 */
import {
  EU_EEA_COUNTRIES,
  ADEQUACY_DECISIONS,
  ADEQUACY_REVIEWED_ON,
  ADEQUACY_REVIEW_INTERVAL_MONTHS,
  isAdequacyReviewOverdue,
  isAdequateDestination,
  getDestinationContext,
} from './transferDestinations.js';

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

console.log('\ntransferDestinations\n');

// --- the EEA -------------------------------------------------------------------

check(EU_EEA_COUNTRIES.length === 30, 'the EEA is 27 member states plus IS, LI and NO',
  `Got ${EU_EEA_COUNTRIES.length}.`);

for (const code of ['DE', 'FR', 'IE', 'NO', 'IS', 'LI']) {
  check(isAdequateDestination(code), `${code} needs no transfer mechanism`);
  check(getDestinationContext(code).status === 'eu_eea', `${code} is eu_eea, not merely adequate`);
}

// --- adequacy decisions --------------------------------------------------------

// The exact set the ROPA router's private EU-27 array was getting wrong.
const ADEQUATE_NON_EEA = ['GB', 'CH', 'JP', 'KR', 'CA', 'NZ', 'IL', 'AR', 'UY', 'AD', 'FO', 'GG', 'IM', 'JE'];
for (const code of ADEQUATE_NON_EEA) {
  check(isAdequateDestination(code), `${code} holds an adequacy decision`);
  check(
    getDestinationContext(code).requiresTransferMechanism === false,
    `${code} does not require SCCs`,
    'This is the case that produced fabricated Chapter V transfers.',
  );
}

check(
  getDestinationContext('GB').status === 'adequate',
  'the UK is adequate rather than eu_eea',
  'Right for EU GDPR. It says nothing about UK GDPR scope — see H82.',
);

// --- third countries -----------------------------------------------------------

for (const code of ['CN', 'IN', 'RU', 'BR', 'ZA']) {
  check(!isAdequateDestination(code), `${code} is a third country`);
  check(getDestinationContext(code).requiresTransferMechanism, `${code} requires a mechanism`);
}

// --- scope caveats -------------------------------------------------------------

check(
  ADEQUACY_DECISIONS['CA']?.scope === 'commercial',
  'Canada is recorded as commercial-only',
  'PIPEDA adequacy does not reach public-sector or employee data.',
);
check(
  ADEQUACY_DECISIONS['US']?.scope === 'data_privacy_framework',
  'the US is recorded as DPF-scoped',
  'Adequacy covers certified entities only, so isAdequateDestination is not the whole answer for US transfers.',
);
check(
  isAdequateDestination('US'),
  'the US is adequate by the coarse test',
  'Callers still have to check DPF certification — see H77.',
);

// --- input hygiene -------------------------------------------------------------

check(!isAdequateDestination(''), 'an empty country code is not adequate');
check(!isAdequateDestination('de'), 'the test is case-sensitive on ISO-3166 alpha-2',
  'Callers pass headquartersCountry straight through, so lowercase must not silently pass.');

// --- VD-10: the list is hand-maintained, so its age is the tested thing --------

// This check is designed to fail on its own one day. An adequacy decision can be
// withdrawn — the Commission has opened reviews before — and a withdrawn one
// leaves the table above asserting a Chapter V safeguard that no longer exists,
// reading exactly like a correct entry. Nothing in this file can detect that;
// only a person comparing against the Commission's page can. So what is enforced
// is that somebody has looked recently, and the build going red is how the ask
// arrives. When it does: re-check the list, *then* move ADEQUACY_REVIEWED_ON.
// Moving the date without looking defeats the mechanism entirely and leaves it
// looking green.
check(
  /^\d{4}-\d{2}-\d{2}$/.test(ADEQUACY_REVIEWED_ON) && !Number.isNaN(Date.parse(ADEQUACY_REVIEWED_ON)),
  'the adequacy list records a real review date',
);
check(
  !isAdequacyReviewOverdue(),
  `the adequacy list has been reviewed within ${ADEQUACY_REVIEW_INTERVAL_MONTHS} months`,
  `Last reviewed ${ADEQUACY_REVIEWED_ON}. Compare ADEQUACY_DECISIONS against the Commission's ` +
  'adequacy-decisions page, correct any drift, then move ADEQUACY_REVIEWED_ON.',
);

// The mechanism itself, so a broken clock cannot make the check above pass for
// ever — which is the failure mode of every staleness test that is only ever
// observed green.
const reviewedOn = new Date(`${ADEQUACY_REVIEWED_ON}T00:00:00Z`);
const dayBeforeDue = new Date(reviewedOn);
dayBeforeDue.setUTCMonth(dayBeforeDue.getUTCMonth() + ADEQUACY_REVIEW_INTERVAL_MONTHS);
dayBeforeDue.setUTCDate(dayBeforeDue.getUTCDate() - 1);
check(!isAdequacyReviewOverdue(dayBeforeDue), 'a review one day short of the interval still stands');
const dayAfterDue = new Date(dayBeforeDue);
dayAfterDue.setUTCDate(dayAfterDue.getUTCDate() + 2);
check(isAdequacyReviewOverdue(dayAfterDue), 'and one day past it is overdue');
check(
  isAdequacyReviewOverdue(new Date('2100-01-01T00:00:00Z')),
  'a review from years ago is overdue however the months are counted',
);

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('transferDestinations OK.\n');
