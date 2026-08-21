/**
 * Fixtures for material-change evaluation, the register-driven outputs, AI-draft
 * validation, and the intake mapping.
 *
 *   npx tsx src/lib/ropaIntelligence.test.ts
 *
 * Standalone style, like `assessments.test.ts`, because apps/api has no vitest.
 *
 * These four modules share a failure mode and it is the worst one in the product:
 * each of them produces something that **looks like an answer** when it is wrong.
 * A material-change verdict that says "obtain fresh consent" for a contract-basis
 * activity is a sentence a DPO will act on. A privacy notice that omits the
 * transfers section because the register had no mechanism recorded is a published
 * document with an Art. 13(1)(f) hole in it. A model proposal that invents a lawful
 * basis of "legitimate business need" fails no type check and lands in a column the
 * register filters on. None of that is visible to `tsc`, to a screenshot, or to a
 * customer until a supervisory authority reads it.
 */
import { evaluateMaterialChange, applyNarrativeVerdict, isReportable } from './materialChange.js';
import type { SnapshotDiff } from './ropaLifecycle.js';
import {
  buildNoticeSections,
  diffAgainstPublished,
  buildDsarScope,
  buildBlastRadius,
  type NoticeBundle,
  type BlastBundle,
} from './registerOutputs.js';
import { validateProposal, acceptedValues, draftStatus } from './ropaDrafting.js';
import { mapAnswersToFields, responseCompleteness, intakeReminderDue, INTERVIEW_QUESTIONS } from './ropaIntake.js';

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

/**
 * `SnapshotDiff.children` is a Record, so every lookup is optional to tsc even
 * where the literal above plainly defines the key.
 */
const child = (d: SnapshotDiff, name: string) => d.children[name]!;

/** An empty diff, to be spread over. */
const noDiff = (): SnapshotDiff => ({
  activity: [],
  children: {
    dataSubjects: { added: 0, removed: 0, changed: [] },
    dataCategories: { added: 0, removed: 0, changed: [] },
    recipients: { added: 0, removed: 0, changed: [] },
    transfers: { added: 0, removed: 0, changed: [] },
  },
});

console.log('\nmaterialChange\n');

// --- nothing changed ------------------------------------------------------------

const nothing = evaluateMaterialChange({ diff: noDiff(), basisAfter: 'consent' });
check(nothing.materiality === 'none', 'an empty diff obliges nothing');
check(isReportable(nothing) === false,
  'and is not worth an event',
  'D33: four vendors added produced four near-identical flags, and the queue stopped being read.');

// --- the consequence split, which is the whole of P125 --------------------------

const categoryAdded = (): SnapshotDiff => {
  const d = noDiff();
  child(d, 'dataCategories').added = 1;
  return d;
};

const onConsent = evaluateMaterialChange({ diff: categoryAdded(), basisBefore: 'consent', basisAfter: 'consent' });
check(onConsent.consequences.includes('reconsent'), 'a new data category on a consent activity needs fresh consent');
check(onConsent.consequences.includes('notice_update'), 'and a notice update');

const onContract = evaluateMaterialChange({ diff: categoryAdded(), basisBefore: 'contract', basisAfter: 'contract' });
check(onContract.consequences.includes('notice_update'), 'the same change on a contract activity needs a notice update');
check(onContract.consequences.includes('reconsent') === false,
  'and does NOT need consent',
  'Telling a controller to ask for permission it does not rely on is how a recommendation engine gets switched off.');

// --- a recipient added ----------------------------------------------------------

const recipientAdded = (): SnapshotDiff => {
  const d = noDiff();
  child(d, 'recipients').added = 1;
  return d;
};
const newRecipient = evaluateMaterialChange({ diff: recipientAdded(), basisAfter: 'contract' });
check(newRecipient.materiality === 'material', 'a new recipient is material');
check(newRecipient.verdicts.notice_update?.articles.includes('Art. 13(1)(e)') === true,
  'and cites the Article that makes it one');

// --- a removal is not an addition -----------------------------------------------

const recipientRemoved = (): SnapshotDiff => {
  const d = noDiff();
  child(d, 'recipients').removed = 1;
  return d;
};
const removed = evaluateMaterialChange({ diff: recipientRemoved(), basisBefore: 'consent', basisAfter: 'consent' });
check(removed.consequences.includes('notice_update'), 'removing a recipient still needs the notice tidied');
check(removed.consequences.includes('reconsent') === false,
  'but obliges no fresh consent — the controller is doing less than it said');

// --- a flag turned off is a narrowing -------------------------------------------

const profilingOff = (): SnapshotDiff => ({
  ...noDiff(),
  activity: [{ field: 'involvesProfiling', from: true, to: false }],
});
const narrowed = evaluateMaterialChange({ diff: profilingOff(), basisAfter: 'consent' });
check(narrowed.consequences.includes('dpia_reassessment') === false,
  'switching profiling OFF does not oblige a fresh DPIA',
  'A narrowing removes a disclosure; it does not add one.');
check(narrowed.consequences.includes('notice_update'), 'it still needs the notice tidied');

const profilingOn = evaluateMaterialChange({
  diff: { ...noDiff(), activity: [{ field: 'involvesProfiling', from: false, to: true }] },
  basisAfter: 'consent',
});
check(profilingOn.consequences.includes('dpia_reassessment'), 'switching profiling ON does oblige one');

// --- a transfer added -----------------------------------------------------------

const transferAdded = evaluateMaterialChange({
  diff: (() => { const d = noDiff(); child(d, 'transfers').added = 1; return d; })(),
  basisAfter: 'legitimate_interest',
});
check(transferAdded.verdicts.notice_update?.required === true, 'a new third-country transfer is decisively material');
check(transferAdded.verdicts.notice_update?.articles.includes('Ch. V') === true, 'and cites Chapter V');

// --- the purpose, which the rules refuse to settle ------------------------------

const purposeChanged = evaluateMaterialChange({
  diff: { ...noDiff(), activity: [{ field: 'purpose', from: 'Screen applications', to: 'Screen and rank applications' }] },
  basisBefore: 'consent', basisAfter: 'consent',
});
check(purposeChanged.needsNarrativeReview === true, 'a rewritten purpose is flagged for a judgement');
check(purposeChanged.materiality === 'advisory',
  'and is advisory until one is made, not material',
  'Whether a rewrite describes different processing is a judgement, and the rules do not guess.');
check(purposeChanged.verdicts.reconsent?.required === false, 'the rules do not assert re-consent on wording alone');

const raised = applyNarrativeVerdict(purposeChanged, { isMaterial: true, confidence: 'high', reasoning: 'Ranking is new processing.' });
check(raised.materiality === 'material', 'a model judgement can raise an advisory to material');
check(raised.verdicts.reconsent?.reasoning.includes('Ranking is new processing.') === true, 'and its reasoning is kept');

// The veto test. A model must not be able to clear a consequence the rules found
// decisively — that would be a model with a veto over Chapter V.
const withTransfer = evaluateMaterialChange({
  diff: (() => {
    const d = noDiff();
    child(d, 'transfers').added = 1;
    d.activity = [{ field: 'purpose', from: 'a', to: 'b' }];
    return d;
  })(),
  basisAfter: 'contract',
});
const cleared = applyNarrativeVerdict(withTransfer, { isMaterial: false, confidence: 'high', reasoning: 'Only wording.' });
check(cleared.verdicts.notice_update?.required === true,
  'a model saying "not material" cannot clear a transfer the rules found decisive',
  'That would be a model with a veto over Chapter V.');

// --- the DPIA case with no DPIA linked ------------------------------------------

const noDpia = evaluateMaterialChange({
  diff: { ...noDiff(), activity: [{ field: 'isSystematicMonitoring', from: false, to: true }] },
  basisAfter: 'legitimate_interest',
  hasDpia: false,
});
check(noDpia.verdicts.dpia_reassessment?.reasoning.includes('screening') === true,
  'with no DPIA linked, the advice is to re-run the screening, not to revisit an assessment that does not exist');

console.log('\nregisterOutputs — the privacy notice\n');

const hrBundle: NoticeBundle = {
  activity: {
    id: 'a1', name: 'Payroll', purpose: 'Pay staff and meet tax obligations',
    lawfulBasis: 'legal_obligation', retentionPeriod: '6_years', status: 'active',
  },
  dataSubjects: [{ category: 'Employees' }],
  dataCategories: [
    { category: 'Bank details', source: 'The data subject' },
    { category: 'National insurance number', source: null },
  ],
  recipients: [{ name: 'HMRC', role: 'independent_controller', recipientCategory: null }],
  transfers: [],
};

const notice = buildNoticeSections([hrBundle]);
check(notice.sections.some((s) => s.id === 'purposes'), 'the purposes section exists');
check(notice.sections.find((s) => s.id === 'purposes')!.items![0]!.includes('Article 6(1)(c)'),
  'and cites the Article the basis comes from');
check(notice.sections.find((s) => s.id === 'transfers')!.paragraphs[0]!.includes('do not transfer'),
  'no transfers produces a positive statement, not a missing section',
  'A blank section reads as an unfinished notice; a negative assertion reads as an answer.');
check(notice.sections.find((s) => s.id === 'sources')!.gaps.length === 1,
  'a category with no recorded source is declared as a gap');
check(notice.sections.find((s) => s.id === 'sources')!.gaps[0]!.includes('1 data categor'),
  'and the gap counts them rather than saying "some are missing"');
check(notice.sections.find((s) => s.id === 'retention')!.items![0]!.includes('6 years'),
  'a legacy retention slug is printed as words, not as 6_years');

// The one that matters most: a transfer with no mechanism must not be published.
const unsafeguarded = buildNoticeSections([{
  ...hrBundle,
  transfers: [{ destinationCountry: 'IN', transferMechanism: 'pending_assessment' }],
}]);
check(unsafeguarded.sections.find((s) => s.id === 'transfers')!.items!.length === 0,
  'a transfer with no Chapter V mechanism is NOT described in the notice');
check(unsafeguarded.sections.find((s) => s.id === 'transfers')!.gaps.length === 1,
  'it is reported as a gap instead',
  'Art. 13(1)(f) requires the safeguard and how to obtain a copy of it — a notice naming the transfer without one publishes the gap.');

const adequate = buildNoticeSections([{
  ...hrBundle,
  transfers: [{ destinationCountry: 'JP', transferMechanism: 'adequacy_decision' }],
}]);
check(adequate.sections.find((s) => s.id === 'transfers')!.items![0]!.includes('adequate'),
  'an adequate destination is described as adequate rather than as a safeguard');

// --- diffAgainstPublished -------------------------------------------------------

const published = 'We share your data with HMRC. We keep payroll records for six years.';
const comparison = diffAgainstPublished(notice, published);
check(comparison.missingFromNotice.every((m) => !m.item.includes('HMRC')),
  'a recipient the published notice names is not reported missing');
check(comparison.sectionsWithNoCoverage.includes('categories'),
  'a section the published notice does not cover at all is named');

console.log('\nregisterOutputs — DSAR scope\n');

const marketing: NoticeBundle = {
  activity: { id: 'a2', name: 'Marketing', purpose: 'Send newsletters', lawfulBasis: 'consent', retentionPeriod: '2_years', status: 'active' },
  dataSubjects: [{ category: 'Prospective customers' }],
  dataCategories: [{ category: 'Email address', source: 'The data subject' }],
  recipients: [{ name: 'Mailchimp', role: 'processor' }],
  transfers: [{ destinationCountry: 'US', transferMechanism: 'dpf' }],
};

const employeeScope = buildDsarScope([hrBundle, marketing], ['employee']);
check(employeeScope.entries.length === 1, 'an employee request scopes to the employment activity');
check(employeeScope.excludedCount === 1, 'and says how many it excluded');
check(employeeScope.entries[0]!.matchedSubjectCategories.includes('Employees'),
  'matching is generous — "employee" finds "Employees"',
  'A false positive costs one more record read; a false negative is an incomplete Art. 15 response.');

const allScope = buildDsarScope([hrBundle, marketing], []);
check(allScope.entries.length === 2, 'with no categories given, everything is in scope');
check(allScope.thirdCountries.includes('US'), 'Art. 15(1)(c) third countries are collected');
check(allScope.processors.includes('Mailchimp'), 'processors holding a copy are listed');
check(allScope.notes.length === 0, 'a register that records its sources produces no caveats');

const sourceless = buildDsarScope([{
  ...hrBundle,
  dataCategories: [{ category: 'Bank details', source: null }],
}], []);
check(sourceless.notes.some((n) => n.includes('no source system')),
  'an activity with no recorded source system is called out, with a count',
  'A DSAR handler with no search location has to establish it by hand, and should know that before the clock starts.');

const noMatch = buildDsarScope([hrBundle], ['shareholder']);
check(noMatch.entries.length === 0 && noMatch.notes.length > 0,
  'no match produces a stated note rather than a silent empty list',
  'An empty result is usually an unpopulated register, and saying so is the useful half.');

console.log('\nregisterOutputs — breach blast radius\n');

const healthBundle: BlastBundle = {
  activity: { id: 'a3', name: 'Occupational health', purpose: 'Manage staff health referrals', lawfulBasis: 'legal_obligation', status: 'active' },
  dataSubjects: [{ category: 'Employees', volumeBand: '10k_100k' }],
  dataCategories: [{ category: 'Health records', isSpecialCategory: true, source: 'Occupational health provider' }],
  recipients: [{ name: 'Health Partners', role: 'processor' }],
  transfers: [{ destinationCountry: 'US', transferMechanism: 'scc' }],
};

const radius = buildBlastRadius([healthBundle], { breachType: 'Unauthorised access' });
check(radius.specialCategories.includes('Health records'), 'special-category data is identified');
check(radius.authorityNotificationLikely === true, 'Art. 33 notification is likely on special-category data');
check(radius.subjectNotificationLikely === true, 'and Art. 34 too, at this scale');
check(radius.volumeBand === '10k_100k', 'the widest volume band across subject categories is taken');
check(radius.estimatedSubjects?.min === 10000, 'and turned into a range for the notification');
check(radius.thirdCountries.includes('US'), 'third countries the data reached are listed');
check(radius.riskFactors.length >= 3, 'every factor behind the verdict is stated');
check(radius.draftNotification.categoriesAndVolumes.includes('Health records'),
  'the Art. 33(3) draft names the categories rather than leaving them to be retyped under a 72-hour clock');

const smallBundle: BlastBundle = {
  activity: { id: 'a4', name: 'Contact form', purpose: 'Answer enquiries', lawfulBasis: 'legitimate_interest', status: 'active' },
  dataSubjects: [{ category: 'Website visitors', volumeBand: 'under_100' }],
  dataCategories: [{ category: 'Email address', isSpecialCategory: false }],
  recipients: [],
  transfers: [],
};
const smallRadius = buildBlastRadius([smallBundle]);
check(smallRadius.authorityNotificationLikely === false,
  'a small, non-sensitive breach does not automatically clear the Art. 33(1) bar');
check(smallRadius.draftNotification.likelyConsequences.includes('still have to be assessed'),
  'and the draft says the assessment is still owed rather than "no risk"',
  'Art. 33(1) turns on a judgement the controller makes; a product must not make it for them.');

console.log('\nropaDrafting\n');

const good = validateProposal({
  name: { value: 'Live chat support', rationale: 'Named after the tool.', confidence: 'high' },
  lawfulBasis: { value: 'legitimate_interests', rationale: 'Art. 6(1)(f).', confidence: 'medium' },
  dataCategories: {
    value: [{ category: 'Chat transcripts', categoryGroup: 'Communications', source: 'The data subject', isSpecialCategory: false }],
    rationale: 'What live chat holds.', confidence: 'high',
  },
  transfers: {
    value: [{ destinationCountry: 'us', destinationEntity: 'Intercom Inc.' }, { destinationCountry: 'United States' }],
    rationale: 'Intercom is US-hosted.', confidence: 'medium',
  },
});

check(good.proposal.lawfulBasis?.value === 'legitimate_interest',
  'the plural spelling a model will use is normalised, not rejected',
  'The value is right and the spelling is not; that is worth a normalisation, not a dropped field.');
check((good.proposal.transfers?.value as any[]).length === 1, 'a transfer with a country name rather than a code is dropped');
check(good.rejected.some((r) => r.field === 'transfers'),
  'and the drop is REPORTED, not swallowed',
  'A field silently discarded is one the reviewer believes was considered and found not to apply.');
check((good.proposal.transfers?.value as any[])[0].transferMechanism === 'pending_assessment',
  'a transfer with no mechanism defaults to pending_assessment rather than to a guess');

const invented = validateProposal({
  lawfulBasis: { value: 'legitimate business need', rationale: 'It seems reasonable.', confidence: 'high' },
});
check(invented.proposal.lawfulBasis === undefined, 'an invented lawful basis never reaches the register');
check(invented.rejected[0]!.reason.includes('legitimate business need'), 'and the rejection names the value');

const unwrapped = validateProposal({ name: 'Payroll' });
check(unwrapped.proposal.name?.value === 'Payroll', 'a bare value rather than the wrapper is accepted');
check(unwrapped.proposal.name?.confidence === 'low',
  'but scored low, because no reasoning came with it',
  'Art. 5(2) asks the controller to demonstrate the reasoning; "the model said so" is not it.');

const decisions = {
  name: { decision: 'accepted' as const },
  lawfulBasis: { decision: 'rejected' as const },
  dataCategories: { decision: 'accepted' as const, value: [{ category: 'Edited', categoryGroup: 'X' }] },
};
const accepted = acceptedValues(good.proposal, decisions);
check(accepted.scalars.name === 'Live chat support', 'accepted scalars land under the register column name');
check(accepted.scalars.lawfulBasis === undefined, 'a rejected field is not written');
check((accepted.rows.dataCategories as any[])[0].category === 'Edited',
  'an edited value beats the proposed one — that is the point of a field-level accept');
check(accepted.rows.transfers === undefined, 'an undecided field is not written either');
check(draftStatus(good.proposal, decisions) === 'partially_applied', 'a partly-decided draft says so');

console.log('\nropaIntake\n');

const answers = {
  activity_name: 'Recruitment',
  what_you_do: 'We screen job applications and arrange interviews.',
  whose_information: ['job_applicants'],
  what_information: 'CVs, contact details, right to work documents',
  sensitive_information: 'unsure',
  outside_europe: 'yes',
  how_long: '6 months after the vacancy closes',
};

const candidates = mapAnswersToFields(INTERVIEW_QUESTIONS, answers);
const byField = (f: string) => candidates.find((c) => c.field === f);

check(byField('name')?.proposedValue === 'Recruitment', 'a scalar answer maps to its column');
check((byField('dataCategories')?.proposedValue as string[]).length === 3,
  'free prose is split into candidate rows');
check(byField('dataCategories')?.note?.includes('check the rows') === true,
  'and the split is flagged as needing a look');
check(byField('involvesSpecialCategories') === undefined,
  '"I am not sure" produces NO candidate, not a confident false',
  'A guess that arrives labelled as an answer is worse than a gap — the reviewer cannot tell it from knowledge.');
check(byField('transfers')?.note?.includes('cannot be accepted as a transfer record') === true,
  'a "yes, data leaves the EEA" is a prompt, not a Chapter V position');
check((byField('dataSubjects')?.proposedValue as string[])[0] === 'Job applicants',
  'a select answer is mapped back to its label rather than its slug');

const progress = responseCompleteness(INTERVIEW_QUESTIONS, answers);
check(progress.requiredAnswered < progress.required, 'a partial response is reported as partial');
check(progress.complete === false, 'and not treated as complete');

// --- the reminder ladder --------------------------------------------------------

const due = at('2026-09-01');
check(intakeReminderDue({ dueAt: due, remindersSent: 0, now: at('2026-08-20') }) === false,
  'no reminder before the first rung');
check(intakeReminderDue({ dueAt: due, remindersSent: 0, now: at('2026-08-25') }) === true,
  'the seven-day rung fires');
check(intakeReminderDue({ dueAt: due, remindersSent: 3, now: at('2026-09-10') }) === false,
  'the ladder stops after its last rung');
check(intakeReminderDue({ dueAt: due, remindersSent: 1, lastReminderAt: at('2026-08-30'), now: at('2026-08-30') }) === false,
  'at most one reminder a day, whatever the ladder says',
  'Two rungs on one date is how a respondent gets three emails in an afternoon.');
check(intakeReminderDue({ dueAt: null, remindersSent: 0, now: due }) === false,
  'a request with no due date is never reminded about');

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('ropaIntelligence OK.\n');
