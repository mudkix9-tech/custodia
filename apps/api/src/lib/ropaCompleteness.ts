/**
 * Completeness scoring and the publication gate for a processing activity.
 *
 * Two things live here because they are the same judgement asked twice. B25/B26
 * want "how complete is this record, and what specifically is missing"; B23 wants
 * "may this record be published". The second is the first, filtered to the
 * requirements that block.
 *
 * Deliberately pure — no database, no tRPC, no dates beyond what is passed in — so
 * it can be exercised by the standalone `tsx` fixtures that are the only test style
 * that runs in `apps/api`. The audit's own note (R147) is that fixtures over the
 * scorer would have caught at least eight of the defects in its register; this is
 * that bet being taken.
 *
 * A requirement is scored against the Article that asks for it, not against the
 * form. That matters: the score has to mean "a supervisory authority would find
 * this record adequate", not "the user filled in the boxes we happened to render".
 */

import {
  article9RequiresNationalLaw,
  normaliseTransferMechanism,
  MECHANISM_REQUIRED_FIELDS,
  SCC_REPEALED_YEARS,
} from '../constants/ropaVocabularies.js';

export type RequirementStatus = 'met' | 'partial' | 'missing' | 'not_applicable';

export type Requirement = {
  /** Stable key. The web panel maps it to a translated label; never rendered raw. */
  id: string;
  /** The provision that asks for it, e.g. 'Art. 30(1)(c)'. Shown beside the label. */
  article: string;
  /** English fallback, used by the API's own exports where no catalogue exists. */
  label: string;
  status: RequirementStatus;
  /** Relative importance. Not-applicable requirements are excluded from both sides. */
  weight: number;
  /** True when an activity may not reach 'active' without it. */
  blocksPublication: boolean;
  /** Editor tab to deep-link to, matching the `?tab=` values RopaEditor accepts. */
  tab: string;
  /** What exactly is wrong, when "missing" is too blunt. English; advisory. */
  detail?: string;
};

export type CompletenessResult = {
  /** 0–100, weighted, with not-applicable requirements excluded from the denominator. */
  score: number;
  requirements: Requirement[];
  /** Unmet requirements, worst weight first — the "what's missing" panel's contents. */
  missing: Requirement[];
  /** The subset of `missing` that blocks publication. */
  blockers: Requirement[];
};

// The shapes below are structural on purpose: the callers pass Drizzle rows, and
// naming the columns rather than importing the table types keeps this module free
// of a `db` import it does not otherwise need.

export type ActivityInput = {
  name?: string | null;
  purpose?: string | null;
  description?: string | null;
  role?: string | null;
  controllerName?: string | null;
  lawfulBasis?: string | null;
  lawfulBasisDetail?: string | null;
  retentionPeriod?: string | null;
  retentionJustification?: string | null;
  securityMeasures?: unknown;
  securityMeasuresDetail?: string | null;
  involvesSpecialCategories?: boolean | null;
  involvesChildren?: boolean | null;
  involvesProfiling?: boolean | null;
  involvesAutomatedDecisionMaking?: boolean | null;
  admLogic?: string | null;
  admSignificance?: string | null;
  admHumanIntervention?: string | null;
  businessOwnerId?: string | null;
  privacyOwnerId?: string | null;
  requiresDpia?: boolean | null;
  dpiaId?: string | null;
};

export type DataSubjectInput = {
  category?: string | null;
  volumeBand?: string | null;
};

export type DataCategoryInput = {
  category?: string | null;
  categoryGroup?: string | null;
  source?: string | null;
  isSpecialCategory?: boolean | null;
  specialCategoryType?: string | null;
  article9Condition?: string | null;
  article9NationalLawBasis?: string | null;
  isCriminalData?: boolean | null;
  article10Basis?: string | null;
  retentionPeriod?: string | null;
};

export type RecipientInput = {
  name?: string | null;
  recipientCategory?: string | null;
  role?: string | null;
  purpose?: string | null;
};

export type TransferInput = {
  destinationCountry?: string | null;
  transferMechanism?: string | null;
  mechanismDetail?: string | null;
  sccYear?: string | null;
  sccModule?: string | null;
  executionDate?: Date | string | null;
  bcrReference?: string | null;
  adequacyDecisionReference?: string | null;
  article49SubReason?: string | null;
  article49Justification?: string | null;
  dpfCertificationNumber?: string | null;
  dpfScope?: string | null;
  tiaRequired?: boolean | null;
  tiaCompleted?: boolean | null;
};

export type ActivityBundle = {
  activity: ActivityInput;
  dataSubjects: DataSubjectInput[];
  dataCategories: DataCategoryInput[];
  recipients: RecipientInput[];
  transfers: TransferInput[];
};

const filled = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;

/**
 * `retention_period` is a free varchar and the Custom option used to write the
 * literal string `custom` with nothing behind it. That is "nothing was recorded",
 * not a period, and scoring it as an answer is how a register reports itself
 * complete while saying nothing about how long it keeps anything.
 */
const hasRetention = (v?: string | null) => filled(v) && v!.trim() !== 'custom';

export function scoreActivity(bundle: ActivityBundle): CompletenessResult {
  const { activity, dataSubjects, dataCategories, recipients, transfers } = bundle;
  const reqs: Requirement[] = [];

  const add = (r: Requirement) => reqs.push(r);

  // ---- Art. 30(1)(a)-(b): identity and purposes ---------------------------
  add({
    id: 'name', article: 'Art. 30(1)(b)', label: 'Activity name', tab: 'general',
    weight: 8, blocksPublication: true,
    status: filled(activity.name) ? 'met' : 'missing',
  });

  add({
    id: 'purpose', article: 'Art. 30(1)(b)', label: 'Purpose of processing', tab: 'general',
    weight: 10, blocksPublication: true,
    status: !filled(activity.purpose)
      ? 'missing'
      // A purpose of "HR" or "marketing" is a label, not a purpose. Ten characters
      // is a low bar and it is the same one the editor's own zod schema states.
      : activity.purpose!.trim().length < 10 ? 'partial' : 'met',
    detail: filled(activity.purpose) && activity.purpose!.trim().length < 10
      ? 'Too short to describe a purpose — name what the processing achieves, not the team that does it.'
      : undefined,
  });

  // Art. 30(2)(a): a processor's record has to name the controller it acts for.
  const isProcessor = activity.role === 'processor';
  add({
    id: 'controllerName', article: 'Art. 30(2)(a)', label: 'Controller acted for', tab: 'legal',
    weight: 8, blocksPublication: true,
    status: !isProcessor ? 'not_applicable' : filled(activity.controllerName) ? 'met' : 'missing',
  });

  // ---- Art. 6: lawful basis ----------------------------------------------
  add({
    id: 'lawfulBasis', article: 'Art. 6(1)', label: 'Lawful basis', tab: 'legal',
    weight: 10, blocksPublication: true,
    status: filled(activity.lawfulBasis) ? 'met' : 'missing',
  });

  // ---- Art. 30(1)(c), first limb: categories of data subject --------------
  add({
    id: 'dataSubjects', article: 'Art. 30(1)(c)', label: 'Categories of data subject', tab: 'data',
    weight: 10, blocksPublication: true,
    status: dataSubjects.length > 0 ? 'met' : 'missing',
  });

  add({
    id: 'dataSubjectVolumes', article: 'Art. 35(3)', label: 'Estimated volume per subject category', tab: 'data',
    weight: 3, blocksPublication: false,
    status: dataSubjects.length === 0
      ? 'not_applicable'
      : dataSubjects.every((s) => filled(s.volumeBand)) ? 'met'
      : dataSubjects.some((s) => filled(s.volumeBand)) ? 'partial' : 'missing',
    detail: 'Scale is one of the Art. 35(3) DPIA screening criteria; without it the screening cannot be evidenced.',
  });

  // ---- Art. 30(1)(c), second limb: categories of personal data ------------
  add({
    id: 'dataCategories', article: 'Art. 30(1)(c)', label: 'Categories of personal data', tab: 'data',
    weight: 10, blocksPublication: true,
    status: dataCategories.length > 0 ? 'met' : 'missing',
  });

  // ---- Art. 14(2)(f): where the data came from ---------------------------
  add({
    id: 'dataCategorySources', article: 'Art. 14(2)(f)', label: 'Source of each data category', tab: 'data',
    weight: 3, blocksPublication: false,
    status: dataCategories.length === 0
      ? 'not_applicable'
      : dataCategories.every((c) => filled(c.source)) ? 'met'
      : dataCategories.some((c) => filled(c.source)) ? 'partial' : 'missing',
    detail: 'Decides whether Art. 13 or Art. 14 governs the notice owed to the subject.',
  });

  // ---- Art. 9(2): the condition, per special-category element -------------
  const specialCats = dataCategories.filter((c) => c.isSpecialCategory);
  const specialWithCondition = specialCats.filter((c) => filled(c.article9Condition));
  const specialNeedingLaw = specialWithCondition.filter((c) => article9RequiresNationalLaw(c.article9Condition));
  const specialMissingLaw = specialNeedingLaw.filter((c) => !filled(c.article9NationalLawBasis));

  add({
    id: 'article9Condition', article: 'Art. 9(2)', label: 'Condition for special-category data', tab: 'data',
    weight: 9,
    // Blocks: asserting Art. 9 processing with no condition documents a prohibition
    // engaged and no route through it, which is the finding an auditor writes up.
    blocksPublication: true,
    status: specialCats.length === 0
      ? 'not_applicable'
      : specialWithCondition.length === 0 ? 'missing'
      : specialWithCondition.length < specialCats.length ? 'partial'
      : specialMissingLaw.length > 0 ? 'partial' : 'met',
    detail: specialMissingLaw.length > 0
      ? 'Conditions (b), (h), (i) and (j) are only available where Union or Member State law provides for them — name that law.'
      : specialCats.length > 0 && specialWithCondition.length < specialCats.length
        ? `${specialCats.length - specialWithCondition.length} of ${specialCats.length} special-category entries have no Art. 9(2) condition.`
        : undefined,
  });

  // ---- Art. 10: criminal convictions and offences -------------------------
  const criminalCats = dataCategories.filter((c) => c.isCriminalData);
  add({
    id: 'article10Basis', article: 'Art. 10', label: 'Authority for criminal-offence data', tab: 'data',
    weight: 9, blocksPublication: true,
    status: criminalCats.length === 0
      ? 'not_applicable'
      : criminalCats.every((c) => filled(c.article10Basis)) ? 'met'
      : criminalCats.some((c) => filled(c.article10Basis)) ? 'partial' : 'missing',
    detail: 'Art. 10 needs official authority or a specific Union/Member State authorisation — an Art. 9(2) condition does not carry it.',
  });

  // ---- Art. 30(1)(d): recipients -----------------------------------------
  add({
    id: 'recipientCategories', article: 'Art. 30(1)(d)', label: 'Categories of recipient', tab: 'recipients',
    weight: 6, blocksPublication: false,
    status: recipients.length === 0
      // No recipients is a legitimate answer, and an unanswered one looks identical.
      // Scored as met so an internal-only activity is not permanently at 94%; the
      // negative assertion that makes it explicit is J93, in Sprint 3.
      ? 'met'
      : recipients.every((r) => filled(r.recipientCategory)) ? 'met'
      : recipients.some((r) => filled(r.recipientCategory)) ? 'partial' : 'missing',
  });

  add({
    id: 'recipientRoles', article: 'Art. 28 / Art. 26', label: 'Role of each recipient', tab: 'recipients',
    weight: 5, blocksPublication: false,
    status: recipients.length === 0
      ? 'not_applicable'
      : recipients.every((r) => filled(r.role)) ? 'met'
      : recipients.some((r) => filled(r.role)) ? 'partial' : 'missing',
    detail: 'Whether a recipient is a processor, a joint controller or an independent controller decides which obligations attach.',
  });

  // ---- Art. 30(1)(e) and Chapter V ---------------------------------------
  const mechanismIssues: string[] = [];
  for (const t of transfers) {
    const mech = normaliseTransferMechanism(t.transferMechanism);
    if (!mech || mech === 'pending_assessment') {
      mechanismIssues.push(`${t.destinationCountry || '??'}: no mechanism chosen`);
      continue;
    }
    if (mech === 'scc' && t.sccYear && SCC_REPEALED_YEARS.includes(t.sccYear)) {
      mechanismIssues.push(`${t.destinationCountry || '??'}: the ${t.sccYear} clauses were repealed with effect from 27 December 2022`);
    }
    for (const field of MECHANISM_REQUIRED_FIELDS[mech]) {
      const value = (t as Record<string, unknown>)[field];
      const present = value instanceof Date ? true : typeof value === 'string' ? value.trim().length > 0 : !!value;
      if (!present) mechanismIssues.push(`${t.destinationCountry || '??'}: ${field} not recorded`);
    }
  }

  add({
    id: 'transferMechanisms', article: 'Art. 30(1)(e) / Ch. V', label: 'Safeguards for each transfer', tab: 'transfers',
    weight: 8, blocksPublication: false,
    status: transfers.length === 0
      ? 'not_applicable'
      : mechanismIssues.length === 0 ? 'met'
      : mechanismIssues.length < transfers.length ? 'partial' : 'missing',
    detail: mechanismIssues.length > 0 ? mechanismIssues.slice(0, 4).join('; ') : undefined,
  });

  const tiaOutstanding = transfers.filter((t) => t.tiaRequired && !t.tiaCompleted);
  add({
    id: 'transferImpactAssessments', article: 'Schrems II', label: 'Transfer impact assessments', tab: 'transfers',
    weight: 4, blocksPublication: false,
    status: transfers.filter((t) => t.tiaRequired).length === 0
      ? 'not_applicable'
      : tiaOutstanding.length === 0 ? 'met' : 'missing',
    detail: tiaOutstanding.length > 0 ? `${tiaOutstanding.length} transfer(s) flagged as needing a TIA have none recorded.` : undefined,
  });

  // ---- Art. 30(1)(f): retention -------------------------------------------
  // Per-category first, falling back to the activity-level answer, because an
  // activity holding a CV and an audit trail has two right answers and the
  // per-activity dropdown can only hold one.
  const categoryRetention = dataCategories.filter((c) => hasRetention(c.retentionPeriod));
  add({
    id: 'retentionPeriod', article: 'Art. 30(1)(f)', label: 'Retention period', tab: 'retention',
    weight: 9, blocksPublication: true,
    status: (dataCategories.length > 0 && categoryRetention.length === dataCategories.length) ? 'met'
      : hasRetention(activity.retentionPeriod) ? 'met'
      : categoryRetention.length > 0 ? 'partial'
      : 'missing',
    detail: !hasRetention(activity.retentionPeriod) && dataCategories.length > 0 && categoryRetention.length < dataCategories.length
      ? `${dataCategories.length - categoryRetention.length} data categories have no retention rule and there is no activity-level fallback.`
      : undefined,
  });

  add({
    id: 'retentionJustification', article: 'Art. 5(1)(e)', label: 'Retention justification', tab: 'retention',
    weight: 5, blocksPublication: false,
    status: filled(activity.retentionJustification) ? 'met' : 'missing',
    detail: 'Storage limitation is a principle the controller has to be able to demonstrate, not assert.',
  });

  // ---- Art. 32: security --------------------------------------------------
  const measures = Array.isArray(activity.securityMeasures) ? activity.securityMeasures : [];
  add({
    id: 'securityMeasures', article: 'Art. 30(1)(g) / Art. 32', label: 'Technical and organisational measures', tab: 'security',
    weight: 8, blocksPublication: false,
    status: measures.length === 0 && !filled(activity.securityMeasuresDetail) ? 'missing'
      : measures.length === 0 ? 'partial' : 'met',
  });

  // ---- Art. 22 ------------------------------------------------------------
  const admEngaged = !!activity.involvesAutomatedDecisionMaking;
  const admFields = [activity.admLogic, activity.admSignificance, activity.admHumanIntervention];
  add({
    id: 'automatedDecisionMaking', article: 'Art. 22 / Art. 13(2)(f)', label: 'Automated decision-making disclosures', tab: 'general',
    weight: 6, blocksPublication: false,
    status: !admEngaged
      ? 'not_applicable'
      : admFields.every((f) => filled(f)) ? 'met'
      : admFields.some((f) => filled(f)) ? 'partial' : 'missing',
    detail: 'Art. 22(3) requires a human who can intervene; Art. 13(2)(f) requires the logic and the envisaged consequences.',
  });

  // ---- Art. 35 ------------------------------------------------------------
  add({
    id: 'dpia', article: 'Art. 35', label: 'DPIA', tab: 'dpia',
    weight: 7, blocksPublication: false,
    status: !activity.requiresDpia ? 'not_applicable' : filled(activity.dpiaId) ? 'met' : 'missing',
    detail: 'This activity has been screened as high risk and no DPIA is linked.',
  });

  // ---- Art. 5(2): ownership ------------------------------------------------
  add({
    id: 'owners', article: 'Art. 5(2)', label: 'Business and privacy owner', tab: 'general',
    weight: 5, blocksPublication: false,
    status: filled(activity.businessOwnerId) && filled(activity.privacyOwnerId) ? 'met'
      : filled(activity.businessOwnerId) || filled(activity.privacyOwnerId) ? 'partial' : 'missing',
    detail: 'An unowned record is the one that goes stale — accountability under Art. 5(2) needs a name behind it.',
  });

  const applicable = reqs.filter((r) => r.status !== 'not_applicable');
  const earned = applicable.reduce(
    (sum, r) => sum + (r.status === 'met' ? r.weight : r.status === 'partial' ? r.weight / 2 : 0),
    0,
  );
  const total = applicable.reduce((sum, r) => sum + r.weight, 0);
  const score = total === 0 ? 0 : Math.round((earned / total) * 100);

  const missing = applicable
    .filter((r) => r.status !== 'met')
    .sort((a, b) => (Number(b.blocksPublication) - Number(a.blocksPublication)) || (b.weight - a.weight));

  return { score, requirements: reqs, missing, blockers: missing.filter((r) => r.blocksPublication) };
}

/**
 * B23. 'active' used to be a costume: any activity could wear it with no name,
 * no basis, no subject categories and no retention, and the register then showed a
 * regulator a published record that answered none of Art. 30(1).
 *
 * The gate refuses — unless an exception is recorded. That escape hatch is not a
 * weakness: a register that cannot be published until it is perfect is a register
 * that stays in draft, and an exception with a named author and a date is itself
 * accountability evidence. What it must never be is silent.
 */
export function evaluatePublication(
  bundle: ActivityBundle,
  opts: { exceptionReason?: string | null } = {},
): { canPublish: boolean; blockers: Requirement[]; viaException: boolean } {
  const { blockers } = scoreActivity(bundle);
  if (blockers.length === 0) return { canPublish: true, blockers: [], viaException: false };

  const reason = opts.exceptionReason?.trim() ?? '';
  // Long enough to be a reason rather than a keystroke. "n/a" is not an exception.
  if (reason.length >= 10) return { canPublish: true, blockers, viaException: true };

  return { canPublish: false, blockers, viaException: false };
}
