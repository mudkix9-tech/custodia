/**
 * Unit tests for the register completeness scorer and the publication gate.
 *
 *   npx tsx src/lib/ropaCompleteness.test.ts
 *
 * Standalone style, like transferDestinations.test.ts, because apps/api has no
 * vitest — the vitest-style suites here typecheck but never execute. The module
 * under test is pure and touches no database, so no env shim is needed.
 *
 * These exist because the scorer is the one piece of Sprint 1 that decides
 * something on the user's behalf. It gates publication, so a wrong "met" lets a
 * register go to a supervisory authority with an Article 30 field empty, and a
 * wrong "missing" trains people to reach for the exception. Both failures are
 * silent in a browser and invisible to `tsc`.
 */
import { scoreActivity, evaluatePublication, type ActivityBundle } from './ropaCompleteness.js';

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

const empty: ActivityBundle = {
  activity: {},
  dataSubjects: [],
  dataCategories: [],
  recipients: [],
  transfers: [],
};

/** A record that answers every Art. 30(1) limb an activity with no extras needs. */
function completeBundle(): ActivityBundle {
  return {
    activity: {
      name: 'Payroll administration',
      purpose: 'Calculating and paying employee salaries and statutory deductions.',
      role: 'controller',
      lawfulBasis: 'legal_obligation',
      retentionPeriod: '6_years_after_employment',
      retentionJustification: 'Statutory retention period for payroll records.',
      securityMeasures: ['encryption_at_rest', 'access_controls'],
      businessOwnerId: '11111111-1111-1111-1111-111111111111',
      privacyOwnerId: '22222222-2222-2222-2222-222222222222',
    },
    dataSubjects: [{ category: 'Employees', volumeBand: '100_999' }],
    dataCategories: [
      { category: 'Salary and compensation', categoryGroup: 'Financial', source: 'directly_from_subject', retentionPeriod: '6_years' },
    ],
    recipients: [{ name: 'HMRC', recipientCategory: 'public_authority', role: 'independent_controller' }],
    transfers: [],
  };
}

const idOf = (b: ActivityBundle, id: string) => scoreActivity(b).requirements.find((r) => r.id === id);

console.log('\nropaCompleteness\n');

// --- the two extremes ----------------------------------------------------------

const emptyResult = scoreActivity(empty);
check(
  emptyResult.requirements.every((r) => r.status !== 'met' || r.id === 'recipientCategories'),
  'an empty activity meets nothing it was actually asked',
  `Met: ${emptyResult.requirements.filter((r) => r.status === 'met').map((r) => r.id).join(', ')}`,
);
check(
  idOf(empty, 'recipientCategories')?.status === 'met',
  'no recipients is scored as an answer, not as a gap',
  'Otherwise an internal-only activity sits permanently below 100 for a question it has answered. The negative assertion that makes it explicit is J93.',
);
check(emptyResult.score < 10, 'an empty activity scores near zero', `Got ${emptyResult.score}.`);
check(emptyResult.blockers.length > 0, 'an empty activity has publication blockers');

const full = scoreActivity(completeBundle());
check(full.score === 100, 'a fully answered controller record scores 100',
  `Got ${full.score}. Unmet: ${full.missing.map((m) => m.id).join(', ')}`);
check(full.blockers.length === 0, 'a fully answered record has no blockers',
  full.blockers.map((b) => b.id).join(', '));

// --- the score is a proportion of what applies ---------------------------------

check(
  emptyResult.requirements.some((r) => r.status === 'not_applicable'),
  'requirements that do not apply are marked, not scored as missing',
);
check(
  !emptyResult.missing.some((r) => r.status === 'not_applicable'),
  'not-applicable requirements never appear in the "what is missing" list',
);

// --- Art. 30(2): the processor record ------------------------------------------

const processorBundle = completeBundle();
processorBundle.activity.role = 'processor';
check(
  idOf(processorBundle, 'controllerName')?.status === 'missing',
  'a processor record with no controller named is incomplete',
  'Art. 30(2)(a). auditExport already splits on this and both PDFs ignore it — D16.',
);
check(
  idOf(completeBundle(), 'controllerName')?.status === 'not_applicable',
  'a controller record is not marked down for naming no controller',
);

// --- Art. 9(2) -----------------------------------------------------------------

const art9 = completeBundle();
art9.dataCategories = [
  { category: 'Health and medical information', categoryGroup: 'Special category', source: 'directly_from_subject', isSpecialCategory: true, retentionPeriod: '6_years' },
];
check(
  idOf(art9, 'article9Condition')?.status === 'missing',
  'special-category data with no Art. 9(2) condition is a blocker',
);
check(
  scoreActivity(art9).blockers.some((b) => b.id === 'article9Condition'),
  'the Art. 9(2) condition blocks publication',
  'Asserting Art. 9 processing with no route through the 9(1) prohibition is the finding an auditor writes up.',
);

const art9WithCondition = completeBundle();
art9WithCondition.dataCategories = [
  { category: 'Health and medical information', categoryGroup: 'Special category', source: 'directly_from_subject', isSpecialCategory: true, article9Condition: 'a', retentionPeriod: '6_years' },
];
check(
  idOf(art9WithCondition, 'article9Condition')?.status === 'met',
  '9(2)(a) explicit consent needs no national-law citation',
);

const art9NeedsLaw = completeBundle();
art9NeedsLaw.dataCategories = [
  { category: 'Health and medical information', categoryGroup: 'Special category', source: 'directly_from_subject', isSpecialCategory: true, article9Condition: 'b', retentionPeriod: '6_years' },
];
check(
  idOf(art9NeedsLaw, 'article9Condition')?.status === 'partial',
  '9(2)(b) without the Union or Member State law it rests on is only half an answer',
  'Same for (h), (i) and (j).',
);

// --- Art. 10 is not Art. 9 -----------------------------------------------------

const criminal = completeBundle();
criminal.dataCategories = [
  { category: 'Criminal convictions and offences', categoryGroup: 'Criminal data', source: 'third_party', isCriminalData: true, article9Condition: 'a', retentionPeriod: '1_year' },
];
check(
  idOf(criminal, 'article10Basis')?.status === 'missing',
  'criminal-offence data needs an Art. 10 authority of its own',
  'An Art. 9(2) condition does not carry Art. 10 — the most common mistake in a hand-built register.',
);
check(
  idOf(completeBundle(), 'article10Basis')?.status === 'not_applicable',
  'an activity with no criminal data is not asked for an Art. 10 basis',
);

// --- Art. 30(1)(f): per-category retention with an activity-level fallback ------

const noRetentionAnywhere = completeBundle();
noRetentionAnywhere.activity.retentionPeriod = null;
noRetentionAnywhere.dataCategories = [{ category: 'Full name', categoryGroup: 'Identity', source: 'directly_from_subject' }];
check(
  idOf(noRetentionAnywhere, 'retentionPeriod')?.status === 'missing',
  'no retention at either level is missing',
);

const perCategoryOnly = completeBundle();
perCategoryOnly.activity.retentionPeriod = null;
check(
  idOf(perCategoryOnly, 'retentionPeriod')?.status === 'met',
  'per-category retention answers Art. 30(1)(f) without an activity-level period',
  'A4: the activity-level dropdown could only ever hold one answer for a record with several.',
);

const partialRetention = completeBundle();
partialRetention.activity.retentionPeriod = null;
partialRetention.dataCategories = [
  { category: 'Salary and compensation', categoryGroup: 'Financial', source: 'directly_from_subject', retentionPeriod: '6_years' },
  { category: 'Full name', categoryGroup: 'Identity', source: 'directly_from_subject' },
];
check(
  idOf(partialRetention, 'retentionPeriod')?.status === 'partial',
  'some categories with a retention rule and no fallback is partial',
);

const literalCustom = completeBundle();
literalCustom.activity.retentionPeriod = 'custom';
literalCustom.dataCategories = [{ category: 'Full name', categoryGroup: 'Identity', source: 'directly_from_subject' }];
check(
  idOf(literalCustom, 'retentionPeriod')?.status === 'missing',
  'the literal string "custom" is not a retention period',
  'The old Custom option wrote it with no field to put anything in — D14.',
);

// --- Chapter V ------------------------------------------------------------------

const pendingTransfer = completeBundle();
pendingTransfer.transfers = [{ destinationCountry: 'US', transferMechanism: 'pending_assessment' }];
check(
  idOf(pendingTransfer, 'transferMechanisms')?.status === 'missing',
  'a transfer left at pending_assessment has no mechanism',
);

const sccNoYear = completeBundle();
sccNoYear.transfers = [{ destinationCountry: 'US', transferMechanism: 'Standard Contractual Clauses (SCCs)' }];
check(
  idOf(sccNoYear, 'transferMechanisms')?.status === 'missing',
  'the prose mechanism value still resolves, and SCCs without year, module or execution date are incomplete',
  'D43 leaves two vocabularies in transfer_mechanism; normaliseTransferMechanism is what bridges them.',
);

const sccRepealed = completeBundle();
sccRepealed.transfers = [{
  destinationCountry: 'US', transferMechanism: 'scc',
  sccYear: '2010', sccModule: 'module_two', executionDate: new Date('2023-01-01'),
}];
const repealedDetail = idOf(sccRepealed, 'transferMechanisms');
check(
  repealedDetail?.status !== 'met' && !!repealedDetail?.detail?.includes('repealed'),
  'the 2010 clauses are flagged as repealed rather than accepted',
  `Got ${repealedDetail?.status}: ${repealedDetail?.detail}`,
);

const sccComplete = completeBundle();
sccComplete.transfers = [{
  destinationCountry: 'US', transferMechanism: 'scc',
  sccYear: '2021', sccModule: 'module_two', executionDate: new Date('2023-01-01'),
}];
check(
  idOf(sccComplete, 'transferMechanisms')?.status === 'met',
  '2021 SCCs with a module and an execution date are a documented mechanism',
);

const dpfPartial = completeBundle();
dpfPartial.transfers = [{ destinationCountry: 'US', transferMechanism: 'dpf', dpfCertificationNumber: 'DPF-1234' }];
check(
  idOf(dpfPartial, 'transferMechanisms')?.status === 'missing',
  'a DPF transfer with no certified scope is incomplete',
  'The framework covers only what the importer certified for; HR data is a separate scope.',
);

const art49 = completeBundle();
art49.transfers = [{ destinationCountry: 'IN', transferMechanism: 'art49_derogation', article49SubReason: 'a_explicit_consent' }];
check(
  idOf(art49, 'transferMechanisms')?.status === 'missing',
  'an Art. 49 derogation with no justification is not documented',
);

const outstandingTia = completeBundle();
outstandingTia.transfers = [{
  destinationCountry: 'US', transferMechanism: 'scc',
  sccYear: '2021', sccModule: 'module_two', executionDate: new Date('2023-01-01'),
  tiaRequired: true, tiaCompleted: false,
}];
check(
  idOf(outstandingTia, 'transferImpactAssessments')?.status === 'missing',
  'a transfer flagged as needing a TIA and having none is reported',
);
check(
  idOf(completeBundle(), 'transferImpactAssessments')?.status === 'not_applicable',
  'an activity with no transfers is not asked for a TIA',
);

// --- Art. 22 --------------------------------------------------------------------

const adm = completeBundle();
adm.activity.involvesAutomatedDecisionMaking = true;
check(
  idOf(adm, 'automatedDecisionMaking')?.status === 'missing',
  'declaring automated decision-making and describing none of it is incomplete',
);

adm.activity.admLogic = 'A scorecard weighting tenure, absence and appraisal ratings.';
check(
  idOf(adm, 'automatedDecisionMaking')?.status === 'partial',
  'the logic alone does not satisfy Art. 22 — significance and human intervention are also required',
);

adm.activity.admSignificance = 'Determines shortlisting for internal promotion.';
adm.activity.admHumanIntervention = 'An HR business partner reviews and may override every outcome.';
check(
  idOf(adm, 'automatedDecisionMaking')?.status === 'met',
  'logic, significance and the Art. 22(3) human safeguard together are met',
);
check(
  idOf(completeBundle(), 'automatedDecisionMaking')?.status === 'not_applicable',
  'an activity with no automated decision-making is not asked about it',
);

// --- Art. 35 --------------------------------------------------------------------

const needsDpia = completeBundle();
needsDpia.activity.requiresDpia = true;
check(
  idOf(needsDpia, 'dpia')?.status === 'missing',
  'an activity screened as high risk with no DPIA linked is reported',
);
check(
  !scoreActivity(needsDpia).blockers.some((b) => b.id === 'dpia'),
  'a missing DPIA does not block publication',
  'The register has to be able to record the activity that needs the DPIA before the DPIA exists.',
);

// --- ordering of the "what is missing" panel ------------------------------------

const ordering = scoreActivity(empty).missing;
const firstNonBlocker = ordering.findIndex((r) => !r.blocksPublication);
const lastBlocker = ordering.map((r) => r.blocksPublication).lastIndexOf(true);
check(
  firstNonBlocker === -1 || lastBlocker < firstNonBlocker,
  'blockers sort above advisory items',
);

// --- the publication gate -------------------------------------------------------

check(
  evaluatePublication(completeBundle()).canPublish,
  'a complete record may be published',
);

const gate = evaluatePublication(empty);
check(!gate.canPublish, 'an empty record may not be published');
check(gate.blockers.length > 0 && !gate.viaException, 'refusal names what blocks it');

check(
  !evaluatePublication(empty, { exceptionReason: 'n/a' }).canPublish,
  'a token exception reason does not open the gate',
  'Two characters is a keystroke, not a documented decision.',
);

const viaException = evaluatePublication(empty, {
  exceptionReason: 'Published ahead of the audit with the DPO aware; retention is being confirmed by Finance.',
});
check(viaException.canPublish, 'a real exception reason opens the gate');
check(viaException.viaException, 'the exception route is reported as such, not as compliance');
check(
  viaException.blockers.length > 0,
  'an exception records what was overridden rather than clearing it',
  'The register has to be able to say what was published incomplete, and why.',
);

// --- B20, the org-level approval requirement -----------------------------------
//
// Off by default, and when on it is the one blocker the exception may not clear.
// The Art. 30 blockers are about a record being *incomplete*, which a named and
// dated exception can legitimately override — that is B23's design. Approval is
// about a record being *unreviewed*, and a control anybody can wave through with
// ten characters is not a control.

check(
  evaluatePublication(completeBundle(), { approvalRequired: false, approvalState: 'draft' }).canPublish,
  'with the setting off, an unapproved record publishes exactly as before',
  'This is the default, and it is what stops the feature changing behaviour for every existing customer.',
);

const unapproved = evaluatePublication(completeBundle(), { approvalRequired: true, approvalState: 'draft' });
check(!unapproved.canPublish, 'with the setting on, an unapproved record is refused');
check(
  unapproved.blockers.some((b) => b.id === 'approval'),
  'the refusal appears as a blocker beside the Article 30 ones',
  'A bare error message would not tell the editor which tab to send the user to.',
);
check(
  unapproved.blockers.find((b) => b.id === 'approval')?.tab === 'governance',
  'the approval blocker deep-links to the tab that fixes it',
);

check(
  evaluatePublication(completeBundle(), { approvalRequired: true, approvalState: 'approved' }).canPublish,
  'an approved record publishes',
);
for (const state of ['in_review', 'rejected', null, undefined]) {
  check(
    !evaluatePublication(completeBundle(), { approvalRequired: true, approvalState: state as any }).canPublish,
    `"${state}" is not approved`,
  );
}

// The property that makes the setting worth having.
const forced = evaluatePublication(completeBundle(), {
  approvalRequired: true,
  approvalState: 'draft',
  exceptionReason: 'The DPO has accepted this risk pending the January review.',
});
check(
  !forced.canPublish,
  'a publication exception does not override the approval requirement',
  'An organisation that turns this on is saying nothing goes live unreviewed; an exceptable control is not one.',
);
check(!forced.viaException, 'and it is not reported as an exception either');

// An incomplete *and* unapproved record reports both, so fixing one does not
// surprise the user with the other.
const both = evaluatePublication(empty, { approvalRequired: true, approvalState: 'draft' });
check(both.blockers.length > 1, 'both kinds of blocker are listed together');
check(both.blockers.some((b) => b.id === 'approval'), 'including the approval one');

// --- F55: the LIA requirement --------------------------------------------------
//
// The one requirement whose answer lives outside the four child tables, and the
// only lawful basis that carries its own evidential burden. Every case below is
// one a browser cannot tell apart: a register asserting legitimate interests with
// no assessment looks exactly like one with a completed assessment behind it.

const liBundle = (lia: ActivityBundle['lia']): ActivityBundle => ({
  ...completeBundle(),
  activity: { ...completeBundle().activity, lawfulBasis: 'legitimate_interests' },
  lia,
});

check(
  idOf(completeBundle(), 'legitimateInterestAssessment')?.status === 'not_applicable',
  'an activity on another lawful basis is not asked for an LIA',
);
check(
  idOf(liBundle(null), 'legitimateInterestAssessment')?.status === 'missing',
  'legitimate interests with no assessment is missing',
);
check(
  idOf(liBundle({ status: 'draft', outcome: null }), 'legitimateInterestAssessment')?.status === 'partial',
  'a draft assessment is partial credit, not none',
  'Starting the balancing test is the act being required; finishing it is the next one.',
);
check(
  idOf(liBundle({ status: 'completed', outcome: 'proceed' }), 'legitimateInterestAssessment')?.status === 'met',
  'a completed assessment concluding "proceed" is met',
);
check(
  idOf(liBundle({ status: 'completed', outcome: 'do_not_proceed' }), 'legitimateInterestAssessment')?.status === 'missing',
  'a completed assessment concluding "do not proceed" is not an answer',
  'The register would be asserting a basis its own assessment rejected.',
);
check(
  !evaluatePublication(liBundle(null)).canPublish,
  'legitimate interests with no assessment blocks publication',
);
check(
  evaluatePublication(liBundle({ status: 'draft', outcome: null })).canPublish,
  'a draft assessment is enough to publish',
  'Art. 5(2) asks that the reasoning be documented, and a draft is documentation in progress. A gate demanding a finished one would refuse every record on the day its basis was chosen.',
);
check(
  evaluatePublication(liBundle(null), {
    exceptionReason: 'Reviewed by the DPO on 3 August; assessment due 15 August.',
  }).canPublish,
  'a named and dated exception clears it, like the other Art. 30 blockers',
  'Unlike the approval blocker, which is about a record being unreviewed rather than incomplete.',
);
check(
  scoreActivity(liBundle({ status: 'completed', outcome: 'proceed' })).score
    > scoreActivity(liBundle(null)).score,
  'having an assessment scores higher than not having one',
);

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('ropaCompleteness OK.\n');
