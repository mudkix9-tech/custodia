/**
 * P125. Generalised material-change evaluation.
 *
 * The re-consent worker is the best idea in the module and it watches one field:
 * the purpose text, on consent-based activities, evaluated by a model. Everything
 * else that can be material under Arts. 5(1)(b), 13(3) and 14(4) — the basis
 * itself, the data categories, the retention, the recipients, the transfers —
 * produced no evaluation at all (D74).
 *
 * The generalisation is *not* "watch more fields and ask the model more often".
 * Two things change:
 *
 *   1. A material change has **three consequences and they do not travel
 *      together.** Adding a data category to a consent-based activity needs fresh
 *      consent. Adding a recipient to a contract-based one needs the privacy
 *      notice updated under Art. 13(3) and no consent whatever. Widening the
 *      subject population to children needs the DPIA looked at again under
 *      Art. 35(11) and possibly neither of the other two. A single boolean
 *      collapses three obligations into one and gets two of them wrong.
 *
 *   2. **The rules decide first; the model is asked only where the rules are
 *      genuinely uncertain.** Whether a recipient was added is a fact about two
 *      rows, not a judgement — sending it to an LLM costs money, adds latency and
 *      introduces a way for the answer to be wrong. What is genuinely a judgement
 *      is whether a rewritten purpose describes *different* processing, and that
 *      is the one thing this module hands off.
 *
 * Pure. No database, no model call, no dates beyond what is passed in — for the
 * same reason `ropaCompleteness.ts` is: every function here answers a legal
 * question and returns a plausible-looking value when it is wrong.
 */

import type { FieldChange, SnapshotDiff } from './ropaLifecycle.js';

export const CONSEQUENCES = ['reconsent', 'notice_update', 'dpia_reassessment'] as const;
export type Consequence = (typeof CONSEQUENCES)[number];

export type Materiality = 'none' | 'advisory' | 'material';

export type Verdict = {
  required: boolean;
  /** high | medium | advisory — `advisory` is "a human should look", not "yes". */
  confidence: 'high' | 'medium' | 'advisory';
  reasoning: string;
  articles: string[];
};

export type MaterialChangeVerdicts = Partial<Record<Consequence, Verdict>>;

export type MaterialChangeResult = {
  materiality: Materiality;
  consequences: Consequence[];
  verdicts: MaterialChangeVerdicts;
  /** True when the purpose text changed and only a model can say whether it matters. */
  needsNarrativeReview: boolean;
  /** The changes that drove the verdict, for the card that shows the reader why. */
  drivers: string[];
};

/**
 * Fields whose change is, on its own, capable of being material.
 *
 * `retentionPeriod` is here and `retentionJustification` is not, which is the
 * distinction the whole table encodes: extending how long data is kept changes the
 * processing the subject was told about; improving the wording of why does not.
 */
const ACTIVITY_FIELD_RULES: Record<string, {
  consequences: Consequence[];
  articles: string[];
  reasoning: string;
  /** When false, the field is watched but only ever produces an advisory. */
  decisive: boolean;
}> = {
  lawfulBasis: {
    consequences: ['reconsent', 'notice_update'],
    articles: ['Art. 6(1)', 'Art. 13(1)(c)'],
    reasoning: 'The lawful basis changed. The basis is one of the Art. 13(1)(c) particulars, and a controller may not swap between bases for the same processing without telling subjects.',
    decisive: true,
  },
  retentionPeriod: {
    consequences: ['notice_update'],
    articles: ['Art. 5(1)(e)', 'Art. 13(2)(a)'],
    reasoning: 'The retention period changed. Art. 13(2)(a) makes the period — or the criteria for it — something the subject was told at collection.',
    decisive: true,
  },
  involvesAutomatedDecisionMaking: {
    consequences: ['notice_update', 'dpia_reassessment'],
    articles: ['Art. 22', 'Art. 13(2)(f)', 'Art. 35(3)(a)'],
    reasoning: 'Automated decision-making was switched on or off. It is both an Art. 13(2)(f) disclosure and an Art. 35(3)(a) DPIA trigger.',
    decisive: true,
  },
  involvesProfiling: {
    consequences: ['notice_update', 'dpia_reassessment'],
    articles: ['Art. 4(4)', 'Art. 35(3)(a)'],
    reasoning: 'Profiling was switched on or off, which moves the activity across an Art. 35(3)(a) screening criterion.',
    decisive: true,
  },
  isSystematicMonitoring: {
    consequences: ['dpia_reassessment'],
    articles: ['Art. 35(3)(c)'],
    reasoning: 'Systematic monitoring was switched on or off — an Art. 35(3)(c) criterion in its own right.',
    decisive: true,
  },
  involvesChildren: {
    consequences: ['dpia_reassessment', 'notice_update'],
    articles: ['Art. 8', 'Recital 75'],
    reasoning: 'The activity now records that it processes children’s data, which changes both the risk assessment and what the notice has to say.',
    decisive: true,
  },
  involvesSpecialCategories: {
    consequences: ['reconsent', 'dpia_reassessment'],
    articles: ['Art. 9', 'Art. 35(3)(b)'],
    reasoning: 'Special-category processing was switched on. Art. 9(2)(a) consent is explicit consent, and large-scale special-category processing is an Art. 35(3)(b) trigger.',
    decisive: true,
  },
  role: {
    consequences: ['notice_update'],
    articles: ['Art. 30(1)', 'Art. 30(2)'],
    reasoning: 'The controller/processor role changed, which changes which record this is and which obligations attach.',
    decisive: true,
  },
  purpose: {
    // The one field the rules deliberately refuse to settle. See
    // `needsNarrativeReview` below.
    consequences: ['reconsent', 'notice_update'],
    articles: ['Art. 5(1)(b)', 'Art. 6(4)'],
    reasoning: 'The purpose description changed.',
    decisive: false,
  },
};

/**
 * Child-collection changes, and what each obliges.
 *
 * Additions and removals are treated differently on purpose. Adding a recipient is
 * a disclosure the subject was not told about; removing one is the controller doing
 * less than it said, which needs the notice tidied eventually and obliges nothing
 * urgently. Flattening the two would fill the queue with "we stopped sharing data
 * with a vendor" alerts and train people to dismiss the whole queue.
 */
const CHILD_RULES: Record<string, {
  onAdd: { consequences: Consequence[]; articles: string[]; reasoning: string };
  onRemove?: { consequences: Consequence[]; articles: string[]; reasoning: string };
  /** Fields on an existing child row whose change is itself material. */
  materialFields?: Record<string, { consequences: Consequence[]; articles: string[]; reasoning: string }>;
}> = {
  dataCategories: {
    onAdd: {
      consequences: ['reconsent', 'notice_update'],
      articles: ['Art. 5(1)(b)', 'Art. 13(1)(c)'],
      reasoning: 'New categories of personal data are being processed. Consent is specific to the data it was given for, and the categories are an Art. 13 particular.',
    },
    onRemove: {
      consequences: ['notice_update'],
      articles: ['Art. 13(1)(c)'],
      reasoning: 'Data categories were removed. The notice now describes more than the activity does.',
    },
    materialFields: {
      isSpecialCategory: {
        consequences: ['reconsent', 'dpia_reassessment'],
        articles: ['Art. 9'],
        reasoning: 'A data category was reclassified as special category, which engages Art. 9 and raises the risk profile.',
      },
      isCriminalData: {
        consequences: ['dpia_reassessment'],
        articles: ['Art. 10'],
        reasoning: 'A data category was reclassified as criminal-offence data, which needs official authority rather than an Art. 9(2) condition.',
      },
      retentionPeriod: {
        consequences: ['notice_update'],
        articles: ['Art. 13(2)(a)'],
        reasoning: 'A per-category retention period changed.',
      },
    },
  },
  dataSubjects: {
    onAdd: {
      consequences: ['notice_update', 'dpia_reassessment'],
      articles: ['Art. 30(1)(c)', 'Art. 35(3)'],
      reasoning: 'A new category of data subject is in scope. Scale and vulnerability are Art. 35(3) screening criteria.',
    },
    materialFields: {
      isChild: {
        consequences: ['dpia_reassessment', 'notice_update'],
        articles: ['Art. 8', 'Recital 38'],
        reasoning: 'A subject category is now recorded as children.',
      },
      isVulnerable: {
        consequences: ['dpia_reassessment'],
        articles: ['Recital 75'],
        reasoning: 'A subject category is now recorded as vulnerable, which the WP248 criteria treat as raising risk.',
      },
      volumeBand: {
        consequences: ['dpia_reassessment'],
        articles: ['Art. 35(3)(b)'],
        reasoning: 'The estimated volume of data subjects changed, which is what "large scale" turns on.',
      },
    },
  },
  recipients: {
    onAdd: {
      consequences: ['notice_update'],
      articles: ['Art. 13(1)(e)', 'Art. 28'],
      reasoning: 'A new recipient receives the data. Recipients or their categories are an Art. 13(1)(e) particular, and a processor needs an Art. 28 contract.',
    },
    onRemove: {
      consequences: ['notice_update'],
      articles: ['Art. 13(1)(e)'],
      reasoning: 'A recipient was removed. The notice now names a disclosure that no longer happens.',
    },
  },
  transfers: {
    onAdd: {
      consequences: ['notice_update', 'dpia_reassessment'],
      articles: ['Art. 13(1)(f)', 'Ch. V'],
      reasoning: 'A new third-country transfer exists. Art. 13(1)(f) requires the transfer, the mechanism and how to obtain a copy of the safeguards to be disclosed.',
    },
    onRemove: {
      consequences: ['notice_update'],
      articles: ['Art. 13(1)(f)'],
      reasoning: 'A third-country transfer was removed.',
    },
    materialFields: {
      destinationCountry: {
        consequences: ['notice_update', 'dpia_reassessment'],
        articles: ['Art. 13(1)(f)', 'Art. 44'],
        reasoning: 'A transfer destination changed, which can change both the adequacy position and the mechanism required.',
      },
      transferMechanism: {
        consequences: ['notice_update'],
        articles: ['Art. 46', 'Art. 49'],
        reasoning: 'A transfer mechanism changed. The safeguard relied on is part of what Art. 13(1)(f) discloses.',
      },
    },
  },
};

const CONSENT_BASES = ['consent', 'explicit_consent'];

/** True when the record relies on consent, before or after the change. */
function reliesOnConsent(basis?: unknown): boolean {
  return typeof basis === 'string' && CONSENT_BASES.some((b) => basis.startsWith(b));
}

/**
 * Evaluates one change to one activity.
 *
 * `basisBefore`/`basisAfter` are passed separately rather than read off the diff
 * because a basis that did *not* change still decides whether re-consent is even
 * available: an Art. 6(1)(b) activity that adds a data category owes its subjects a
 * notice update and owes nothing at all in the way of fresh consent, and a verdict
 * that says "obtain consent" for it is worse than silence — it is advice that would
 * make the controller ask for something it does not need and does not rely on.
 */
export function evaluateMaterialChange(opts: {
  diff: SnapshotDiff;
  basisBefore?: string | null;
  basisAfter?: string | null;
  /** Whether a DPIA is linked. A re-assessment verdict on an activity with no DPIA is a screening prompt instead. */
  hasDpia?: boolean;
}): MaterialChangeResult {
  const { diff } = opts;
  const consentInPlay = reliesOnConsent(opts.basisBefore) || reliesOnConsent(opts.basisAfter);

  const hits: { consequence: Consequence; articles: string[]; reasoning: string; decisive: boolean; driver: string }[] = [];
  const drivers: string[] = [];
  let needsNarrativeReview = false;

  // ---- activity fields ----------------------------------------------------
  for (const change of diff.activity) {
    const rule = ACTIVITY_FIELD_RULES[change.field];
    if (!rule) continue;

    // A boolean turned *off* removes a disclosure rather than adding one. It still
    // needs the notice tidied; it does not need consent or a fresh DPIA.
    const switchedOff = change.from === true && change.to === false;
    const consequences = switchedOff
      ? rule.consequences.filter((c) => c === 'notice_update')
      : rule.consequences;

    if (change.field === 'purpose') {
      needsNarrativeReview = true;
      drivers.push(describeChange(change));
      // Recorded as advisory only. Whether a rewritten purpose describes different
      // processing is the judgement the model is for; the rules refuse to guess.
      for (const consequence of consequences) {
        hits.push({ consequence, articles: rule.articles, reasoning: rule.reasoning, decisive: false, driver: 'purpose' });
      }
      continue;
    }

    drivers.push(describeChange(change));
    for (const consequence of consequences) {
      hits.push({ consequence, articles: rule.articles, reasoning: rule.reasoning, decisive: rule.decisive, driver: change.field });
    }
  }

  // ---- child collections --------------------------------------------------
  for (const [collection, summary] of Object.entries(diff.children)) {
    const rules = CHILD_RULES[collection];
    if (!rules) continue;

    if (summary.added > 0) {
      drivers.push(`${summary.added} ${collection} added`);
      for (const consequence of rules.onAdd.consequences) {
        hits.push({ consequence, articles: rules.onAdd.articles, reasoning: rules.onAdd.reasoning, decisive: true, driver: `${collection}.added` });
      }
    }
    if (summary.removed > 0 && rules.onRemove) {
      drivers.push(`${summary.removed} ${collection} removed`);
      for (const consequence of rules.onRemove.consequences) {
        hits.push({ consequence, articles: rules.onRemove.articles, reasoning: rules.onRemove.reasoning, decisive: true, driver: `${collection}.removed` });
      }
    }
    for (const change of summary.changed) {
      const fieldRule = rules.materialFields?.[change.field];
      if (!fieldRule) continue;
      // A flag cleared is a narrowing, and narrowings do not oblige consent.
      const narrowed = change.from === true && change.to === false;
      const consequences = narrowed
        ? fieldRule.consequences.filter((c) => c === 'notice_update')
        : fieldRule.consequences;
      if (consequences.length === 0) continue;
      drivers.push(`${collection}.${describeChange(change)}`);
      for (const consequence of consequences) {
        hits.push({ consequence, articles: fieldRule.articles, reasoning: fieldRule.reasoning, decisive: true, driver: `${collection}.${change.field}` });
      }
    }
  }

  // ---- fold into one verdict per consequence ------------------------------
  const verdicts: MaterialChangeVerdicts = {};
  for (const consequence of CONSEQUENCES) {
    const relevant = hits.filter((h) => h.consequence === consequence);
    if (relevant.length === 0) continue;

    // Re-consent is only a real answer where consent is the basis. Everywhere else
    // the same change is a notice obligation and nothing more; saying otherwise
    // sends a controller to ask for permission it does not rely on, which is how a
    // recommendation engine gets switched off.
    if (consequence === 'reconsent' && !consentInPlay) continue;

    // A DPIA re-assessment on an activity with no DPIA is a *screening* prompt.
    // Both point at the same tab, and conflating them tells someone to revisit an
    // assessment that does not exist.
    const decisive = relevant.some((h) => h.decisive);
    const articles = [...new Set(relevant.flatMap((h) => h.articles))];
    const reasons = [...new Set(relevant.map((h) => h.reasoning))];

    verdicts[consequence] = {
      required: decisive,
      confidence: decisive ? (relevant.length > 1 ? 'high' : 'medium') : 'advisory',
      reasoning: consequence === 'dpia_reassessment' && opts.hasDpia === false
        ? `${reasons.join(' ')} No DPIA is linked to this activity, so the first step is to re-run the Art. 35(1) screening.`
        : reasons.join(' '),
      articles,
    };
  }

  const consequences = (Object.keys(verdicts) as Consequence[]).filter((c) => verdicts[c]);
  const anyRequired = consequences.some((c) => verdicts[c]!.required);

  return {
    materiality: consequences.length === 0 ? 'none' : anyRequired ? 'material' : 'advisory',
    consequences,
    verdicts,
    needsNarrativeReview,
    drivers: [...new Set(drivers)].slice(0, 12),
  };
}

/** One changed field, in a phrase a card can print. Values are not rendered — a diff card is not the place for a customer's purpose text. */
function describeChange(change: FieldChange): string {
  if (typeof change.from === 'boolean' || typeof change.to === 'boolean') {
    return `${change.field} ${change.to ? 'enabled' : 'disabled'}`;
  }
  return `${change.field} changed`;
}

/**
 * Merges a model's judgement about the purpose text into a rules verdict.
 *
 * Kept separate from `evaluateMaterialChange` so the rules stay pure and testable
 * without a network call, and so the model can only ever *raise* a consequence the
 * rules already recognised as possible. It cannot invent a fourth consequence and
 * it cannot clear one the rules found decisively: a model that could downgrade
 * "a new third-country transfer was added" to "not material" is a model with a
 * veto over Chapter V.
 */
export function applyNarrativeVerdict(
  base: MaterialChangeResult,
  narrative: { isMaterial: boolean; confidence: string; reasoning: string },
): MaterialChangeResult {
  if (!base.needsNarrativeReview) return base;

  const confidence = narrative.confidence === 'high' ? 'high'
    : narrative.confidence === 'medium' ? 'medium'
    : 'advisory';

  const verdicts: MaterialChangeVerdicts = { ...base.verdicts };
  const touched: Consequence[] = ['reconsent', 'notice_update'];

  for (const consequence of touched) {
    const existing = verdicts[consequence];
    if (!existing) continue;
    // Only upgrades. `required` stays true if the rules already said so.
    verdicts[consequence] = {
      required: existing.required || narrative.isMaterial,
      confidence: existing.required ? existing.confidence : confidence,
      reasoning: `${existing.reasoning} ${narrative.reasoning}`.trim(),
      articles: existing.articles,
    };
  }

  const consequences = (Object.keys(verdicts) as Consequence[]).filter((c) => verdicts[c]);
  const anyRequired = consequences.some((c) => verdicts[c]!.required);

  return {
    ...base,
    verdicts,
    consequences,
    materiality: consequences.length === 0 ? 'none' : anyRequired ? 'material' : 'advisory',
  };
}

/**
 * Whether the change is worth writing an event for at all.
 *
 * A register whose queue fills with "the description was tidied" is a queue nobody
 * opens, and D33 is the record of exactly that happening: four vendors added
 * produced four near-identical high-confidence flags. An evaluation with no
 * consequence is not an event.
 */
export function isReportable(result: MaterialChangeResult): boolean {
  return result.consequences.length > 0;
}
