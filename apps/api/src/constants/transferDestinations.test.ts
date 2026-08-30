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
  adequacyState,
  isRecipientConditional,
  conditionMetByMechanism,
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
// --- VD-23: the US decision is a fact about the recipient, not about the US ----
//
// This block replaces a single assertion that read `isAdequateDestination('US')`
// is true, annotated "callers still have to check DPF certification". Thirteen of
// the fourteen callers did not, and had no way to: the condition lived inline in
// `calculateVendorRisk` where nothing else could reach it. So the Art. 44 gap
// rule excused every US vendor, the Article 30 export printed them adequate, and
// the TIA queue said they needed no assessment — including the ones whose
// certification had lapsed, which is 6,719 of the register's 16,534 rows.

check(
  !isAdequateDestination('US'),
  'the US is not adequate to a caller that has not evidenced certification',
  'Unknown is not yes. This is the same direction VD-14 settled for an unrecorded country.',
);
check(
  isAdequateDestination('US', { conditionMet: true }),
  'and it is adequate to one that has',
);
check(
  adequacyState('US') === 'conditional',
  'an unevidenced US transfer is conditional rather than either answer',
  'The fourth state is the point: "go and find out" reads differently from "you have a Chapter V problem".',
);
check(
  adequacyState('US', { conditionMet: true }) === 'adequate',
  'and evidenced it is plainly adequate',
);
check(isRecipientConditional('US'), 'the US decision depends on the recipient');

// Canada is the deliberate non-case. Its scope narrows by *sector*, and nothing
// in this product records a recipient's sector, so treating CA as unevidenced
// would fail every Canadian transfer on a distinction nobody can act on. A scope
// nothing can check is documentation; a scope something can check is a gate.
check(
  !isRecipientConditional('CA'),
  'Canada is scoped but not conditional, because nothing here can evidence the condition',
);
check(isAdequateDestination('CA'), 'so Canada stays adequate with no evidence required');
check(adequacyState('CA') === 'adequate', 'and reports as adequate rather than conditional');

// Neither an EEA state nor a full-scope decision is affected by the new argument,
// which is what makes this change safe to make everywhere at once.
check(isAdequateDestination('DE', { conditionMet: false }), 'an EEA state ignores the condition');
check(isAdequateDestination('JP', { conditionMet: false }), 'and so does a full-scope decision');
check(
  !isAdequateDestination('CN', { conditionMet: true }),
  'and a third country cannot be talked into adequacy by asserting a condition it does not have',
);

// The mechanism reading, which is what every ROPA caller passes.
check(
  conditionMetByMechanism('US', ['data_privacy_framework']),
  'a recorded DPF mechanism evidences the US condition',
);
check(
  conditionMetByMechanism('US', ['Data_Privacy_Framework']),
  'case-insensitively, because the column holds display strings and slugs both (D43)',
);
check(
  !conditionMetByMechanism('US', ['scc', null, undefined]),
  'SCCs do not evidence it — they are the other answer to the same question',
);
check(
  !conditionMetByMechanism('CA', ['data_privacy_framework']),
  'and the DPF says nothing about a non-conditional country',
);

// The gap this exists to stop, stated as the ordering rather than as a number.
check(
  !isAdequateDestination('US', { conditionMet: false })
    && isAdequateDestination('US', { conditionMet: true }),
  'an uncertified US importer never reads as well as a certified one',
  'If these ever agree, the register is back to rewarding not looking.',
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
