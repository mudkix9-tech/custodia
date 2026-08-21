/**
 * Fixtures for the three assessments and the content hash.
 *
 *   npx tsx src/lib/assessments.test.ts
 *
 * Standalone style, like `ropaLifecycle.test.ts`, because apps/api has no vitest.
 * The modules under test are pure and import only constants, so no environment
 * shim is needed.
 *
 * These exist because every function here answers a legal question and returns a
 * value that looks plausible when it is wrong. A screening that reports
 * "not required" over three unanswered criteria renders identically to one that
 * considered them; a TIA that counts contractual measures against a surveillance
 * regime shows a full progress bar; a content hash that varies with key order
 * reports tampering on every verification. None of the three is visible in a
 * browser and all three end up in front of a regulator.
 */
import {
  canonicalise,
  contentHash,
  screenForDpia,
  prefillScreening,
  evaluateLia,
  evaluateTia,
} from './assessments.js';
import { riskBand, aggregateRiskLevels, findDpiaTemplate, DPIA_TEMPLATES } from './dpiaTemplates.js';
import { fieldLabel, describeChanges, renderValue, changeTypeOf, childTableForPath, extractParentResourceId, flattenAuditRow } from './auditTrail.js';
import { SCREENING_CRITERIA, WP248_CRITERIA } from '../constants/assessmentVocabularies.js';

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

/** Every criterion answered "no", so a fixture can turn on exactly what it means to. */
const allNo = (): Record<string, boolean> =>
  Object.fromEntries(SCREENING_CRITERIA.map((id) => [id, false]));

console.log('\ncontentHash\n');

// --- canonicalise / contentHash ------------------------------------------------

check(
  contentHash({ a: 1, b: 2 }) === contentHash({ b: 2, a: 1 }),
  'key order does not change the hash',
  'A snapshot rebuilt from a row has whatever key order the driver produced.',
);
check(
  contentHash({ risks: [1, 2] }) !== contentHash({ risks: [2, 1] }),
  'array order does change the hash',
  'Order is content in a list of risks.',
);
check(
  contentHash({ nested: { z: 1, a: 2 } }) === contentHash({ nested: { a: 2, z: 1 } }),
  'sorting is applied at every depth',
);
check(
  contentHash({ at: new Date('2026-08-19T10:00:00.000Z') }) === contentHash({ at: '2026-08-19T10:00:00.000Z' }),
  'a Date and its ISO string hash the same',
  'A snapshot round-trips through jsonb as a string; re-reading it must not look like tampering.',
);
check(contentHash({ a: null }) === contentHash({ a: undefined }), 'null and undefined are the same absence');
check(/^[0-9a-f]{64}$/.test(contentHash({})), 'the digest is 64 hex characters');
check(JSON.stringify(canonicalise({ b: 1, a: 2 })) === '{"a":2,"b":1}', 'canonicalise sorts keys');

console.log('\nscreenForDpia\n');

// --- Art. 35(3) is decisive ----------------------------------------------------

check(
  screenForDpia({ ...allNo(), art_35_3_c_public_area_monitoring: true }).verdict === 'required',
  'one Article 35(3) case alone makes a DPIA required',
  'The Article settles it; the nine criteria do not get to downgrade it to "recommended".',
);
check(
  screenForDpia({ ...allNo(), art_35_3_a_automated_decisions: true }).statutoryTriggers.length === 1,
  'the statutory trigger is reported separately from the criteria met',
);

// --- WP248's two-criteria threshold --------------------------------------------

check(
  screenForDpia({ ...allNo(), wp248_large_scale: true, wp248_systematic_monitoring: true }).verdict === 'required',
  'two of the nine criteria means required',
);
check(
  screenForDpia({ ...allNo(), wp248_large_scale: true }).verdict === 'recommended',
  'one of the nine criteria means recommended',
);
check(screenForDpia(allNo()).verdict === 'not_required', 'no criteria means not required');
check(
  screenForDpia({ ...allNo(), wp248_large_scale: true, wp248_vulnerable_subjects: true }).wp248Count === 2,
  'the WP248 count excludes the Article 35(3) cases',
);

// --- unanswered is not "no" ----------------------------------------------------

const partial = screenForDpia({ wp248_large_scale: false });
check(partial.unanswered.length === SCREENING_CRITERIA.length - 1, 'unanswered criteria are counted');
check(partial.complete === false, 'a screening with unanswered criteria is not complete');
check(
  screenForDpia(allNo()).complete === true,
  'a screening where every criterion is answered is complete',
);
check(
  screenForDpia({}).verdict === 'not_required' && screenForDpia({}).complete === false,
  'an empty screening reaches a verdict but reports itself as provisional',
  'Otherwise "no DPIA required" and "nobody looked" are the same document.',
);

// --- national blacklists -------------------------------------------------------

check(
  screenForDpia(allNo(), { jurisdiction: 'DE', blacklistSelections: ['ai_processing_of_personal_data'] }).verdict === 'required',
  'a German list entry makes a DPIA required for a German controller',
);
check(
  screenForDpia(allNo(), { jurisdiction: 'IE', blacklistSelections: ['ai_processing_of_personal_data'] }).verdict === 'not_required',
  'a German list entry does not bind an Irish controller',
  'Merging the national lists would tell most customers a DPIA is mandatory when it is not.',
);
check(
  screenForDpia(allNo(), { jurisdiction: 'IE', blacklistSelections: ['employee_monitoring'] }).verdict === 'required',
  'the EDPB common entries apply in every jurisdiction',
);
check(
  screenForDpia(allNo(), { blacklistSelections: ['employee_monitoring', 'employee_monitoring'] }).blacklistMatches.length === 1,
  'a duplicated selection counts once',
);
check(
  screenForDpia(allNo(), { jurisdiction: 'de', blacklistSelections: ['whistleblowing_systems'] }).verdict === 'required',
  'the jurisdiction is matched case-insensitively',
);

// --- prefill -------------------------------------------------------------------

const prefilled = prefillScreening({
  involvesAutomatedDecisionMaking: true,
  involvesProfiling: true,
  involvesChildren: true,
  involvesSpecialCategories: false,
  isSystematicMonitoring: false,
  estimatedDataSubjects: '100000+',
});
check(prefilled.art_35_3_a_automated_decisions === true, 'automated decision-making prefills the 35(3)(a) case');
check(prefilled.wp248_evaluation_or_scoring === true, 'profiling prefills evaluation or scoring');
check(prefilled.wp248_vulnerable_subjects === true, "children prefill the vulnerable-subjects criterion");
check(
  prefilled.wp248_large_scale === undefined,
  'a large volume band does not prefill "large scale"',
  'WP248 makes scale a function of volume, range, duration and geography — not a headcount.',
);
check(
  prefillScreening({ involvesSpecialCategories: false }, { hasCriminalData: true }).wp248_sensitive_or_highly_personal === true,
  'Article 10 data prefills the sensitive-data criterion',
);
check(Object.keys(prefillScreening({})).length === 0, 'an empty activity prefills nothing');

console.log('\nevaluateLia\n');

// --- LIA -----------------------------------------------------------------------

const fullLia = {
  purposeTestLegitimateInterest: 'Preventing fraudulent chargebacks against the merchant estate.',
  purposeTestIsLawful: true,
  purposeTestEvidence: 'Board minute 2026-03',
  purposeTestBeneficiary: 'controller',
  purposeTestImportance: 'compelling',
  necessityTestIsNecessary: 'Device signals are the only way to link repeat attempts across accounts.',
  necessityTestAlternatives: 'Manual review was trialled and missed 60% of cases.',
  necessityTestConclusion: 'No less intrusive option achieves the purpose.',
  necessityTestProportionate: true,
  balancingTestImpact: 'Individuals are scored without being told which signals were decisive.',
  balancingTestExpectation: 'Customers expect fraud checks at checkout.',
  balancingTestSafeguards: 'Scores expire after 90 days and never feed marketing.',
  balancingTestOverrides: 'The interest is not overridden: the impact is low and the safeguards are effective.',
  balancingTestRelationship: 'Existing customer relationship.',
  objectionMechanism: 'Objections are handled by the fraud team within five working days.',
  outcome: 'proceed',
  outcomeRationale: 'Proceed with the safeguards described.',
};

check(evaluateLia(fullLia).canComplete === true, 'a fully answered LIA may be completed');
check(evaluateLia(fullLia).blockers.length === 0, 'a fully answered LIA has no blockers');
check(evaluateLia(fullLia).score === 100, 'a fully answered LIA scores 100');

check(
  evaluateLia({ ...fullLia, balancingTestOverrides: '' }).canComplete === false,
  'the balancing conclusion is required',
);
check(
  evaluateLia({ ...fullLia, purposeTestLegitimateInterest: 'fraud' }).canComplete === false,
  'a one-word interest is not an answer',
  'Ten characters is the line between a statement and a keystroke.',
);
check(
  evaluateLia({ ...fullLia, purposeTestIsLawful: false }).canComplete === false,
  'an interest the assessor has marked unlawful blocks completion',
);
check(
  evaluateLia({ ...fullLia, objectionMechanism: '' }).canComplete === false,
  'proceeding without an Article 21 objection route blocks completion',
);
check(
  evaluateLia({ ...fullLia, objectionMechanism: '', outcome: 'do_not_proceed' }).canComplete === true,
  'an objection route is not required where the outcome is not to proceed',
  'There is nothing to object to.',
);
check(
  evaluateLia({ ...fullLia, balancingTestSafeguards: '', balancingTestInvolvesChildren: true }).canComplete === false,
  "safeguards are required where children's data is involved and the outcome is to proceed",
);
check(
  evaluateLia({ ...fullLia, balancingTestSafeguards: '' }).canComplete === true,
  'safeguards are wanted but not blocking in the ordinary case',
);
check(
  evaluateLia({ ...fullLia, balancingTestSafeguards: '' }).gaps.some((g) => g.id === 'balancing_safeguards' && !g.blocks),
  'the missing safeguards still appear as a non-blocking gap',
);
check(evaluateLia({}).blockers.length >= 5, 'an empty LIA reports every blocking gap');
check(evaluateLia({}).score < 20, 'an empty LIA scores low');
check(
  evaluateLia({ ...fullLia, outcome: null }).blockers.some((g) => g.part === 'outcome'),
  'an LIA with no outcome cannot be completed',
);

console.log('\nevaluateTia\n');

// --- TIA -----------------------------------------------------------------------

const fullTia = {
  destinationCountry: 'US',
  transferMechanism: 'scc_2021',
  dataExporter: 'Custodia Ltd, Dublin',
  dataImporter: 'Vendor Inc, Delaware',
  transferPurpose: 'Hosting of the production database.',
  surveillanceLawsExist: true,
  independentDpaExists: false,
  effectiveRemediesExist: false,
  legalAssessmentConclusion: 'not_equivalent',
  technicalMeasures: ['encryption_at_rest_importer_no_key'],
  organizationalMeasures: ['transparency_reporting'],
  contractualMeasures: ['challenge_unlawful_access_requests'],
  residualRiskLevel: 'medium',
  residualRiskJustification: 'The importer cannot read the data; keys stay in the EEA.',
  conclusion: 'proceed_with_measures',
  reevaluationIntervalMonths: 12,
};

check(evaluateTia(fullTia).canComplete === true, 'a six-step TIA with an effective technical measure may be completed');
check(evaluateTia(fullTia).contradictions.length === 0, 'that TIA carries no contradiction');
check(evaluateTia(fullTia).score === 100, 'a complete TIA scores 100');

check(
  evaluateTia({ ...fullTia, technicalMeasures: [] }).contradictions.includes('measures_cannot_cure_legal_regime'),
  'contractual measures alone against a non-equivalent regime is flagged',
  'Recommendations 01/2020 § 48: they cannot bind a public authority.',
);
check(
  evaluateTia({ ...fullTia, technicalMeasures: [] }).canComplete === false,
  'a contradiction stops the TIA being marked complete',
);
check(
  evaluateTia({ ...fullTia, technicalMeasures: ['encryption_in_transit'] }).contradictions.includes('measures_cannot_cure_legal_regime'),
  'transport encryption is not an "effective alone" measure',
  'The importer can still read the data once it arrives.',
);
check(
  evaluateTia({ ...fullTia, legalAssessmentConclusion: 'equivalent' }).contradictions.includes('surveillance_but_equivalent'),
  'concluding equivalence while recording surveillance laws is flagged',
);
check(
  evaluateTia({ ...fullTia, conclusion: 'suspend', residualRiskLevel: 'low' }).contradictions.includes('suspended_but_low_residual_risk'),
  'suspending over a low residual risk is flagged',
);
check(
  evaluateTia({ ...fullTia, reevaluationIntervalMonths: null }).steps.find((s) => s.step === 6)?.status === 'missing',
  'step six needs an interval, not a date',
);
check(
  evaluateTia({ ...fullTia, dataImporter: '' }).steps.find((s) => s.step === 1)?.status === 'partial',
  'knowing half the transfer is partial credit for step one',
);
check(
  evaluateTia({ destinationCountry: 'JP', transferMechanism: 'adequacy' }, { isAdequate: true }).steps.find((s) => s.step === 3)?.status === 'met',
  'an adequate destination satisfies step three without an equivalence analysis',
  'Otherwise the most common lawful transfer looks like the least complete record in the file.',
);
check(
  evaluateTia({ destinationCountry: 'JP', transferMechanism: 'adequacy' }, { isAdequate: true }).steps.find((s) => s.step === 4)?.status === 'met',
  'an adequate destination needs no supplementary measures',
);
check(evaluateTia({}).canComplete === false, 'an empty TIA cannot be completed');
check(evaluateTia({}).score === 0, 'an empty TIA scores zero');

console.log('\ndpiaTemplates\n');

// --- the risk matrix -----------------------------------------------------------

check(riskBand(4, 4) === 'critical', '4×4 is critical');
check(riskBand(3, 4) === 'critical', '3×4 is critical');
check(riskBand(2, 4) === 'high', '2×4 is high');
check(riskBand(2, 2) === 'medium', '2×2 is medium');
check(riskBand(1, 2) === 'low', '1×2 is low');
check(riskBand(null, 4) === null, 'a half-scored risk has no band');
check(
  riskBand(4, 1) === 'medium' && riskBand(1, 4) === 'medium',
  'the matrix is symmetric',
);

const agg = aggregateRiskLevels([
  { likelihood: 1, severity: 1, residualLikelihood: 1, residualSeverity: 1 },
  { likelihood: 4, severity: 4, residualLikelihood: 1, residualSeverity: 2 },
]);
check(agg.overall === 'critical', 'the worst risk sets the overall level');
check(agg.residual === 'low', 'the worst residual sets the residual level');
check(agg.requiresPriorConsultation === false, 'a mitigated critical risk does not trigger Article 36');

const unmitigated = aggregateRiskLevels([{ likelihood: 4, severity: 4 }]);
check(
  unmitigated.residual === 'critical',
  'a risk with no residual assessment keeps its initial band',
  'Treating "not yet mitigated" as "no residual risk" reports low against three unaddressed risks.',
);
check(unmitigated.requiresPriorConsultation === true, 'an unmitigated critical risk triggers Article 36');
check(aggregateRiskLevels([]).overall === null, 'a DPIA with no risks has no level');

check(DPIA_TEMPLATES.length === 5, 'five templates ship');
check(findDpiaTemplate('cctv')?.risks.length === 3, 'the CCTV template carries three risks');
check(findDpiaTemplate('nope') === null, 'an unknown template id resolves to null');
check(findDpiaTemplate(null) === null, 'a null template id resolves to null');
check(
  DPIA_TEMPLATES.every((t) => t.risks.every((r) => r.measures.length > 0)),
  'every template risk carries at least one measure',
);
check(
  DPIA_TEMPLATES.every((t) => t.typicalCriteria.every((c) => (SCREENING_CRITERIA as readonly string[]).includes(c))),
  'every template criterion is a real screening criterion',
  'A typo here would silently prefill nothing.',
);

console.log('\nauditTrail\n');

// --- labels and rendering ------------------------------------------------------

check(fieldLabel('lawfulBasisDetail') === 'Lawful basis detail', 'a known field uses its label');
check(fieldLabel('someNewColumn') === 'Some new column', 'an unlabelled camelCase field becomes sentence case');
check(fieldLabel('some_new_column') === 'Some new column', 'an unlabelled snake_case field becomes sentence case');

check(renderValue(true) === 'Yes', 'booleans render as Yes');
check(renderValue(null) === '—', 'null renders as a dash');
check(renderValue('') === '—', 'an empty string renders as a dash');
check(renderValue([]) === 'None', 'an empty array renders as None');
check(renderValue(['a', 'b']) === 'a, b', 'an array renders as a list');
check(
  renderValue('2026-08-19T10:00:00.000Z') === '2026-08-19',
  'an ISO instant renders as a date',
);
check(
  renderValue('2026 was a good year') === '2026 was a good year',
  'prose beginning with digits is left alone',
);
check(renderValue('x'.repeat(500)).endsWith('…'), 'a very long value is truncated');

// --- describeChanges -----------------------------------------------------------

const described = describeChanges({
  lawfulBasis: { old: 'consent', new: 'legitimate_interests' },
  updatedAt: { old: '2026-01-01', new: '2026-02-01' },
  completenessScore: { old: 40, new: 55 },
});
check(described.length === 1, 'noise fields are dropped from a rendered diff');
check(described[0]?.label === 'Lawful basis', 'the surviving change carries its label');
check(described[0]?.before === 'consent', 'the before value is rendered');

check(
  describeChanges({ name: { old: null, new: '' } }).length === 0,
  'a change whose two sides render identically is not shown',
  'null against empty string is a formatting artefact, not an edit.',
);
check(describeChanges(null).length === 0, 'a null diff describes nothing');
check(describeChanges('nonsense').length === 0, 'a malformed diff describes nothing');
check(
  describeChanges({ purpose: { old: 'a', new: 'b' }, name: { old: 'c', new: 'd' } })[0]?.label === 'Name',
  'changes are sorted by label',
);

// --- change types and parents --------------------------------------------------

check(changeTypeOf('ropa.dataCategories.create') === 'create', 'a create path classifies as create');
check(changeTypeOf('ropa.update') === 'update', 'an update path classifies as update');
check(changeTypeOf('ropa.transfers.delete') === 'delete', 'a delete path classifies as delete');
check(changeTypeOf('ropa.approval.submit') === 'create', 'submitting an approval is a create');
check(changeTypeOf('ropa.completeness') === 'other', 'an unclassified path is other');

check(childTableForPath('ropa.dataCategories.update') === 'processing_data_categories', 'a child path resolves its table');
check(
  childTableForPath('ropa.transfers.tia.save') === 'transfer_impact_assessments',
  'the longest matching prefix wins',
  "Otherwise a TIA save files itself as a transfer edit.",
);
check(childTableForPath('ropa.update') === null, 'an activity path has no child table');

check(
  extractParentResourceId({ id: 'x', processingActivityId: 'parent-id' }) === 'parent-id',
  'the parent id is read from the returned row',
);
check(extractParentResourceId({ id: 'x' }) === null, 'a row with no parent yields null');
check(extractParentResourceId(null) === null, 'no result yields null');
check(extractParentResourceId(undefined) === null, 'an undefined result yields null');

// --- flattening for export -----------------------------------------------------

const flat = flattenAuditRow({
  createdAt: new Date('2026-08-19T09:00:00.000Z'),
  userEmail: 'dpo@example.com',
  action: 'ropa.update',
  description: 'Updated processing activity',
  ipAddress: '10.0.0.1',
  resourceId: 'act-1',
  changes: { purpose: { old: 'a', new: 'b' }, name: { old: 'c', new: 'd' } },
});
check(flat.length === 2, 'a two-field change becomes two rows');
check(flat[0]?.user === 'dpo@example.com', 'the actor is carried onto every row');
check(
  flattenAuditRow({ action: 'ropa.approval.decide', description: 'Approval approved' }).length === 1,
  'an entry with no diff still produces one row',
  '"Approved this record" is an event even though no content changed.',
);
check(
  flattenAuditRow({ parentResourceId: 'parent', resourceId: 'child' })[0]?.record_id === 'parent',
  'the parent id is what the export files a child change under',
);

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('assessments OK.\n');
