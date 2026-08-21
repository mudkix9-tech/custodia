/**
 * The judgements the three assessments make on a user's behalf — DPIA screening,
 * LIA completeness, TIA adequacy of measures — and the content hash the audit
 * trail signs with.
 *
 * Everything here is pure: no database, no tRPC, no clock beyond what is passed
 * in. That is the same bet `ropaCompleteness.ts` and `ropaLifecycle.ts` take, and
 * for the same reason — the standalone `tsx` fixtures are the only test style
 * that runs in `apps/api`, and every function in this file decides something the
 * user will be held to by a regulator while looking, on screen, like it worked.
 *
 * A screening that says "no DPIA required" because two criteria were left blank
 * looks identical to one that says it because they were answered "no". A TIA that
 * counts seven contractual measures against a surveillance regime looks mitigated.
 * Neither is visible in a browser, and both are the finding.
 */

import { createHash } from 'node:crypto';
import {
  ARTICLE_35_3_CRITERIA,
  WP248_CRITERIA,
  SCREENING_CRITERIA,
  NATIONAL_BLACKLISTS,
  TIA_EFFECTIVE_ALONE_MEASURES,
  type ScreeningVerdict,
} from '../constants/assessmentVocabularies.js';

// ---------------------------------------------------------------------------
// I90 — content hashing.
// ---------------------------------------------------------------------------

/**
 * A stable JSON rendering: object keys sorted at every depth, arrays left in
 * order.
 *
 * The ordering is the whole point. `JSON.stringify` emits keys in insertion
 * order, and a snapshot rebuilt from a database row has whatever order the
 * driver produced — so the same document hashed twice on two different days
 * would differ, and a hash that changes when the content has not is worse than
 * no hash: it reports tampering that did not happen, every time.
 *
 * Arrays are *not* sorted, because order is content in an array of risks.
 */
export function canonicalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalise((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * I90. sha256 over the canonical form, hex.
 *
 * What this buys: a regulator handed an exported pack can recompute the digest
 * of the record it was given and compare it with the digest the approval
 * recorded. "The register has not been altered since it was approved" stops
 * being a claim the vendor makes about its own database.
 */
export function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(value))).digest('hex');
}

// ---------------------------------------------------------------------------
// F56 — DPIA screening.
// ---------------------------------------------------------------------------

export type ScreeningAnswers = Record<string, boolean>;

export type ScreeningResult = {
  verdict: ScreeningVerdict;
  /** Criterion ids answered `true`. */
  criteriaMet: string[];
  /** The Art. 35(3) subset of the above — any one of these is decisive. */
  statutoryTriggers: string[];
  /** WP248 criteria met. Two or more is the EDPB's own threshold. */
  wp248Count: number;
  /** National Art. 35(4) list entries that matched. */
  blacklistMatches: string[];
  /** Criteria with no answer either way. A verdict over these is provisional. */
  unanswered: string[];
  /** Whether the verdict may be relied on, i.e. everything was answered. */
  complete: boolean;
  /** English, advisory. The web resolves its own wording from the ids above. */
  reasoning: string;
};

/**
 * Score a screening.
 *
 * The order matters and is the Article's own: 35(3) settles the question where it
 * applies, and only where it does not do the nine criteria decide. Running WP248
 * first and treating 35(3) as three more criteria would let a single statutory
 * trigger come out as "recommended", which is a legal answer the Regulation does
 * not offer.
 *
 * `unanswered` is tracked separately rather than folded into "no". "We considered
 * whether this is large-scale and concluded it is not" and "nobody looked" are
 * different statements, and the second is not a screening.
 */
export function screenForDpia(
  answers: ScreeningAnswers,
  opts: { jurisdiction?: string | null; blacklistSelections?: readonly string[] } = {},
): ScreeningResult {
  const met = SCREENING_CRITERIA.filter((id) => answers[id] === true);
  const statutory = ARTICLE_35_3_CRITERIA.filter((id) => answers[id] === true);
  const wp248 = WP248_CRITERIA.filter((id) => answers[id] === true);
  const unanswered = SCREENING_CRITERIA.filter((id) => typeof answers[id] !== 'boolean');

  // Only entries on a list that actually applies here. A German "Muss-Liste" item
  // ticked by an Irish controller is not a statutory trigger for them, and
  // treating it as one would tell customers a DPIA is mandatory when it is not.
  const applicable = new Set<string>([
    ...NATIONAL_BLACKLISTS.EU!,
    ...(opts.jurisdiction ? NATIONAL_BLACKLISTS[opts.jurisdiction.toUpperCase()] ?? [] : []),
  ]);
  const blacklistMatches = [...new Set(opts.blacklistSelections ?? [])].filter((entry) => applicable.has(entry));

  let verdict: ScreeningVerdict;
  let reasoning: string;

  if (statutory.length > 0) {
    verdict = 'required';
    reasoning = `Article 35(3) applies (${statutory.length} of the three listed cases), so a DPIA is required regardless of the further criteria.`;
  } else if (blacklistMatches.length > 0) {
    verdict = 'required';
    reasoning = `The processing appears on the supervisory authority's Article 35(4) list (${blacklistMatches.length} ${blacklistMatches.length === 1 ? 'entry' : 'entries'}), which makes a DPIA mandatory in this jurisdiction.`;
  } else if (wp248.length >= 2) {
    verdict = 'required';
    reasoning = `${wp248.length} of the nine EDPB criteria are met. Two or more is the threshold at which WP248 rev.01 treats a DPIA as required.`;
  } else if (wp248.length === 1) {
    verdict = 'recommended';
    reasoning = 'One of the nine EDPB criteria is met. WP248 rev.01 treats a single criterion as a case where a DPIA may still be needed; record why you concluded either way.';
  } else {
    verdict = 'not_required';
    reasoning = 'No Article 35(3) case applies, no Article 35(4) list entry matches, and none of the nine EDPB criteria are met.';
  }

  return {
    verdict,
    criteriaMet: [...met],
    statutoryTriggers: [...statutory],
    wp248Count: wp248.length,
    blacklistMatches,
    unanswered: [...unanswered],
    complete: unanswered.length === 0,
    reasoning,
  };
}

/**
 * Which criteria the register already answers for itself.
 *
 * The screening is a questionnaire, but half of it is a question the register was
 * asked when the activity was created — special categories, systematic
 * monitoring, automated decision-making, children. Pre-filling from the record is
 * the difference between a form somebody completes and a form somebody abandons,
 * and the answers stay editable because the register is a summary and the
 * screening is a judgement.
 */
export function prefillScreening(activity: {
  involvesSpecialCategories?: boolean | null;
  involvesChildren?: boolean | null;
  involvesProfiling?: boolean | null;
  involvesAutomatedDecisionMaking?: boolean | null;
  isSystematicMonitoring?: boolean | null;
  estimatedDataSubjects?: string | null;
}, opts: { hasCriminalData?: boolean } = {}): ScreeningAnswers {
  const answers: ScreeningAnswers = {};

  if (activity.involvesAutomatedDecisionMaking) {
    answers.art_35_3_a_automated_decisions = true;
    answers.wp248_automated_decision_legal_effect = true;
  }
  if (activity.involvesProfiling) answers.wp248_evaluation_or_scoring = true;
  if (activity.isSystematicMonitoring) answers.wp248_systematic_monitoring = true;
  if (activity.involvesSpecialCategories || opts.hasCriminalData) {
    answers.wp248_sensitive_or_highly_personal = true;
  }
  // Children are vulnerable subjects in WP248's own terms — the criterion is
  // about an imbalance of power, and the guidance names children first.
  if (activity.involvesChildren) answers.wp248_vulnerable_subjects = true;

  // "Large scale" is deliberately *not* inferred from the volume band. WP248 is
  // explicit that scale is a function of the number of subjects, the volume and
  // range of data, the duration and the geographical extent — not a headcount —
  // and a screening that guessed it from one band would be wrong in whichever
  // direction the customer did not check.

  return answers;
}

// ---------------------------------------------------------------------------
// F55 — the LIA.
// ---------------------------------------------------------------------------

export type LiaInput = {
  purposeTestLegitimateInterest?: string | null;
  purposeTestIsLawful?: boolean | null;
  purposeTestEvidence?: string | null;
  purposeTestBeneficiary?: string | null;
  purposeTestImportance?: string | null;
  necessityTestIsNecessary?: string | null;
  necessityTestAlternatives?: string | null;
  necessityTestConclusion?: string | null;
  necessityTestProportionate?: boolean | null;
  balancingTestImpact?: string | null;
  balancingTestExpectation?: string | null;
  balancingTestSafeguards?: string | null;
  balancingTestOverrides?: string | null;
  balancingTestInvolvesChildren?: boolean | null;
  balancingTestInvolvesSpecialCategory?: boolean | null;
  balancingTestRelationship?: string | null;
  objectionMechanism?: string | null;
  optOutOffered?: boolean | null;
  outcome?: string | null;
  outcomeRationale?: string | null;
};

export type LiaGap = {
  /** Stable key; the web resolves the wording. */
  id: string;
  part: 'purpose' | 'necessity' | 'balancing' | 'outcome';
  /** True where the gap stops the LIA being marked complete. */
  blocks: boolean;
};

/** Non-empty after trimming, and long enough to be an answer rather than a tick. */
const answered = (value?: string | null, min = 3) => (value ?? '').trim().length >= min;

/**
 * What is missing from an LIA, and whether it may be marked complete.
 *
 * The three parts are the ICO's own three-part test and each has exactly one
 * question that cannot be skipped: what the interest *is*, why the processing is
 * necessary for it, and whether the individual's interests override it. The rest
 * are strongly wanted and recorded as non-blocking gaps, which is how the panel
 * can show a half-finished assessment as half-finished rather than as invalid.
 *
 * Two of the blocking checks are conditional, and they are the ones that catch
 * the assessments people actually get wrong:
 *
 *   - An outcome of `do_not_proceed` needs no safeguards, but any *other* outcome
 *     reached where children or special-category data are involved does. Those
 *     are the two factors the ICO says tip a balancing test, and an LIA that
 *     ticks them and then proceeds with an empty safeguards box has not balanced
 *     anything.
 *   - Art. 21(1) gives an unconditional right to object to legitimate-interest
 *     processing. An LIA that concludes "proceed" without saying how the
 *     objection is handled is asserting a basis whose central condition it has
 *     not met.
 */
export function evaluateLia(lia: LiaInput): {
  gaps: LiaGap[];
  blockers: LiaGap[];
  canComplete: boolean;
  /** 0–100, for the ring beside the assessment. */
  score: number;
} {
  const gaps: LiaGap[] = [];
  const add = (id: string, part: LiaGap['part'], blocks: boolean) => gaps.push({ id, part, blocks });

  // Purpose test.
  if (!answered(lia.purposeTestLegitimateInterest, 10)) add('purpose_interest', 'purpose', true);
  if (lia.purposeTestIsLawful === false) add('purpose_unlawful', 'purpose', true);
  if (!lia.purposeTestBeneficiary) add('purpose_beneficiary', 'purpose', false);
  if (!lia.purposeTestImportance) add('purpose_importance', 'purpose', false);
  if (!answered(lia.purposeTestEvidence)) add('purpose_evidence', 'purpose', false);

  // Necessity test.
  if (!answered(lia.necessityTestIsNecessary, 10)) add('necessity_statement', 'necessity', true);
  if (!answered(lia.necessityTestAlternatives)) add('necessity_alternatives', 'necessity', false);
  if (lia.necessityTestProportionate === null || lia.necessityTestProportionate === undefined) {
    add('necessity_proportionate', 'necessity', false);
  }
  if (!answered(lia.necessityTestConclusion)) add('necessity_conclusion', 'necessity', false);

  // Balancing test.
  if (!answered(lia.balancingTestImpact, 10)) add('balancing_impact', 'balancing', true);
  if (!answered(lia.balancingTestOverrides, 10)) add('balancing_overrides', 'balancing', true);
  if (!answered(lia.balancingTestExpectation)) add('balancing_expectation', 'balancing', false);
  if (!answered(lia.balancingTestRelationship)) add('balancing_relationship', 'balancing', false);

  const proceeding = lia.outcome === 'proceed' || lia.outcome === 'proceed_with_safeguards';
  const heightened = !!lia.balancingTestInvolvesChildren || !!lia.balancingTestInvolvesSpecialCategory;

  if (!answered(lia.balancingTestSafeguards)) {
    add('balancing_safeguards', 'balancing', proceeding && heightened);
  }
  if (!answered(lia.objectionMechanism)) {
    add('objection_mechanism', 'balancing', proceeding);
  }

  // Outcome.
  if (!lia.outcome) add('outcome', 'outcome', true);
  if (!answered(lia.outcomeRationale)) add('outcome_rationale', 'outcome', false);

  const blockers = gaps.filter((g) => g.blocks);

  // Fifteen checks, weighted equally except that a blocker counts double — the
  // score is a progress indicator, not a grade, and the thing a user should chase
  // first is the thing stopping them finishing.
  const total = gaps.reduce((sum, g) => sum + (g.blocks ? 2 : 1), 0);
  const possible = 4 + 4 + 6 + 2 + blockers.length; // the checks above, blockers doubled
  const score = possible <= 0 ? 100 : Math.max(0, Math.round(100 - (total / possible) * 100));

  return { gaps, blockers, canComplete: blockers.length === 0, score };
}

// ---------------------------------------------------------------------------
// F58 — the TIA.
// ---------------------------------------------------------------------------

export type TiaInput = {
  destinationCountry?: string | null;
  transferMechanism?: string | null;
  dataExporter?: string | null;
  dataImporter?: string | null;
  transferPurpose?: string | null;
  surveillanceLawsExist?: boolean | null;
  surveillanceLawsDetail?: string | null;
  independentDpaExists?: boolean | null;
  effectiveRemediesExist?: boolean | null;
  relevantCaseLaw?: string | null;
  legalAssessmentConclusion?: string | null;
  technicalMeasures?: unknown;
  organizationalMeasures?: unknown;
  contractualMeasures?: unknown;
  residualRiskLevel?: string | null;
  residualRiskJustification?: string | null;
  conclusion?: string | null;
  reevaluationIntervalMonths?: number | null;
};

export type TiaStepStatus = {
  /** 1–6, matching Recommendations 01/2020. */
  step: number;
  id: string;
  status: 'met' | 'partial' | 'missing';
};

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * The EDPB six steps, scored, plus the one contradiction a TIA is most likely to
 * contain.
 *
 * `contradictions` is what makes this more than a completeness check. A TIA whose
 * legal assessment concludes the destination is *not* equivalent, and which then
 * selects only organisational and contractual measures, has documented the
 * problem and called it solved — Recommendations 01/2020 is explicit (§ 48) that
 * contractual and organisational measures cannot on their own bind a public
 * authority whose law permits the access. That assessment reads as complete on
 * screen and is exactly the one a supervisory authority would reject.
 */
export function evaluateTia(tia: TiaInput, opts: { isAdequate?: boolean } = {}): {
  steps: TiaStepStatus[];
  contradictions: string[];
  canComplete: boolean;
  score: number;
} {
  const technical = asList(tia.technicalMeasures);
  const organisational = asList(tia.organizationalMeasures);
  const contractual = asList(tia.contractualMeasures);
  const anyMeasures = technical.length + organisational.length + contractual.length;

  const steps: TiaStepStatus[] = [
    {
      step: 1,
      id: 'know_your_transfer',
      status: answered(tia.dataExporter) && answered(tia.dataImporter) && answered(tia.transferPurpose)
        ? 'met'
        : answered(tia.dataImporter) || answered(tia.transferPurpose)
          ? 'partial'
          : 'missing',
    },
    {
      step: 2,
      id: 'identify_mechanism',
      status: answered(tia.transferMechanism) && answered(tia.destinationCountry, 2) ? 'met' : 'missing',
    },
    {
      step: 3,
      id: 'assess_destination_law',
      // An adequacy decision *is* the assessment for step 3 — Art. 45 transfers
      // need no equivalence analysis, and asking for one would make the most
      // common lawful transfer look like the least complete record in the file.
      status: opts.isAdequate
        ? 'met'
        : tia.surveillanceLawsExist === null || tia.surveillanceLawsExist === undefined
          ? 'missing'
          : answered(tia.legalAssessmentConclusion) && tia.independentDpaExists !== null && tia.effectiveRemediesExist !== null
            ? 'met'
            : 'partial',
    },
    {
      step: 4,
      id: 'supplementary_measures',
      status: opts.isAdequate || tia.legalAssessmentConclusion === 'equivalent'
        ? 'met'
        : anyMeasures === 0
          ? 'missing'
          : technical.length > 0
            ? 'met'
            : 'partial',
    },
    {
      step: 5,
      id: 'procedural_steps',
      status: answered(tia.residualRiskJustification) && !!tia.residualRiskLevel && !!tia.conclusion
        ? 'met'
        : tia.conclusion
          ? 'partial'
          : 'missing',
    },
    {
      step: 6,
      id: 'reevaluate',
      status: (tia.reevaluationIntervalMonths ?? 0) > 0 ? 'met' : 'missing',
    },
  ];

  const contradictions: string[] = [];

  if (
    tia.legalAssessmentConclusion === 'not_equivalent'
    && (tia.conclusion === 'proceed' || tia.conclusion === 'proceed_with_measures')
    && !technical.some((m) => TIA_EFFECTIVE_ALONE_MEASURES.includes(m))
  ) {
    contradictions.push('measures_cannot_cure_legal_regime');
  }

  if (tia.surveillanceLawsExist === true && tia.legalAssessmentConclusion === 'equivalent') {
    contradictions.push('surveillance_but_equivalent');
  }

  if (tia.conclusion === 'suspend' && tia.residualRiskLevel && tia.residualRiskLevel !== 'critical') {
    contradictions.push('suspended_but_low_residual_risk');
  }

  const met = steps.filter((s) => s.status === 'met').length;
  const partial = steps.filter((s) => s.status === 'partial').length;
  const score = Math.round(((met + partial * 0.5) / steps.length) * 100);

  return {
    steps,
    contradictions,
    canComplete: steps.every((s) => s.status === 'met') && contradictions.length === 0,
    score,
  };
}
