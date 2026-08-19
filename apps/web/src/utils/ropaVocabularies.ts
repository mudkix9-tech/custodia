/**
 * The register's controlled vocabularies, as values only.
 *
 * The values live in `apps/api/src/constants/ropaVocabularies.ts`, which is what
 * validates them; this file lists the ones the web workspace renders and resolves
 * their wording through the message catalogue. The split mirrors
 * `utils/countries.ts` against `constants/transferDestinations.ts` — the API owns
 * the truth, the web owns the wording.
 *
 * Adequacy is deliberately absent for the reason `countries.ts` gives: it changes by
 * Commission decision and it carries scope caveats, so it is served by
 * `ropa.transferDestinations` rather than copied here. A second copy of that list is
 * precisely what produced D17.
 *
 * R142. These labels used to be English string literals in this file, which is why
 * every enum in the register rendered in English to German and French readers even
 * on the tabs that were otherwise translated. They now resolve through
 * `ropa.vocab.<group>.<value>`, and the hints — which are the part that actually
 * helps someone tell Art. 9(2)(h) from (i) — through `ropa.vocab_hints`. A value
 * with no entry in `HINTED` has no hint, which is what keeps a missing hint from
 * rendering as a raw dotted key path; next-intl does not fall back.
 */

import { useTranslations } from 'next-intl';

export type Option = { value: string; label: string; hint?: string };

export const SPECIAL_CATEGORY_TYPES = [
  'racial_or_ethnic_origin',
  'political_opinions',
  'religious_or_philosophical_beliefs',
  'trade_union_membership',
  'genetic_data',
  'biometric_data_for_id',
  'health_data',
  'sex_life',
  'sexual_orientation',
] as const;

/** Art. 9(2)(a)–(j). */
export const ARTICLE_9_CONDITIONS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;

/** The four that are only available where Union or Member State law provides. */
export const ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW = ['b', 'h', 'i', 'j'];

export function article9RequiresNationalLaw(condition?: string | null): boolean {
  return !!condition && ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW.includes(condition);
}

/** Recital 26. */
export const IDENTIFIABILITY_LEVELS = ['direct', 'indirect', 'pseudonymised', 'anonymous'] as const;

export const SENSITIVITY_LEVELS = ['standard', 'confidential', 'special'] as const;

export const RETENTION_TRIGGERS = [
  'collection',
  'last_interaction',
  'end_of_contract',
  'end_of_employment',
  'account_closure',
  'consent_withdrawal',
  'case_closure',
  'statutory_period_end',
] as const;

export const VOLUME_BANDS = ['under_100', '100_999', '1k_10k', '10k_100k', '100k_1m', 'over_1m'] as const;

/** Art. 30(1)(d). */
export const RECIPIENT_CATEGORIES = [
  'internal_department',
  'group_company',
  'it_service_provider',
  'cloud_hosting_provider',
  'payment_provider',
  'marketing_agency',
  'professional_adviser',
  'auditor',
  'insurer',
  'bank_or_financial_institution',
  'courier_or_logistics',
  'public_authority',
  'court_or_tribunal',
  'law_enforcement',
  'regulator',
  'other',
] as const;

export const RECIPIENT_ROLES = ['processor', 'sub_processor', 'joint_controller', 'independent_controller'] as const;

export const TRANSFER_MECHANISMS = [
  'adequacy_decision',
  'scc',
  'bcr',
  'dpf',
  'art49_derogation',
  'codes_of_conduct',
  'certification',
  'pending_assessment',
  'other',
] as const;

export const SCC_YEARS = ['2021', '2010'] as const;
export const SCC_REPEALED_YEARS = ['2010'];

export const SCC_MODULES = ['module_one', 'module_two', 'module_three', 'module_four'] as const;

export const ARTICLE_49_SUB_REASONS = [
  'a_explicit_consent',
  'b_contract_with_subject',
  'c_contract_in_subject_interest',
  'd_public_interest',
  'e_legal_claims',
  'f_vital_interests',
  'g_public_register',
  'compelling_legitimate_interests',
] as const;

export const DPF_SCOPES = ['non_hr', 'hr', 'both'] as const;

/** Every group this module can render, keyed by the message namespace segment. */
export const VOCAB_GROUPS = {
  special_category_type: SPECIAL_CATEGORY_TYPES,
  article_9_condition: ARTICLE_9_CONDITIONS,
  identifiability: IDENTIFIABILITY_LEVELS,
  sensitivity: SENSITIVITY_LEVELS,
  retention_trigger: RETENTION_TRIGGERS,
  volume_band: VOLUME_BANDS,
  recipient_category: RECIPIENT_CATEGORIES,
  recipient_role: RECIPIENT_ROLES,
  transfer_mechanism: TRANSFER_MECHANISMS,
  scc_year: SCC_YEARS,
  scc_module: SCC_MODULES,
  article_49_sub_reason: ARTICLE_49_SUB_REASONS,
  dpf_scope: DPF_SCOPES,
} as const;

export type VocabGroup = keyof typeof VOCAB_GROUPS;

/**
 * Which values carry an explanatory hint.
 *
 * Listed rather than inferred, because next-intl renders a missing key as its own
 * dotted path — `ropa.vocab_hints.recipient_role.auditor` in the middle of a form.
 * Asking for a hint that does not exist has to be impossible, not merely unlikely.
 */
const HINTED: Partial<Record<VocabGroup, readonly string[]>> = {
  article_9_condition: ARTICLE_9_CONDITIONS,
  identifiability: IDENTIFIABILITY_LEVELS,
  sensitivity: ['confidential', 'special'],
  recipient_role: RECIPIENT_ROLES,
  scc_year: ['2010'],
  article_49_sub_reason: ['a_explicit_consent', 'compelling_legitimate_interests'],
};

const MECHANISM_ALIASES: Record<string, string> = {
  'standard contractual clauses (sccs)': 'scc',
  'standard contractual clauses': 'scc',
  'sccs': 'scc',
  'adequacy decision': 'adequacy_decision',
  'adequacy': 'adequacy_decision',
  'binding corporate rules (bcrs)': 'bcr',
  'binding corporate rules': 'bcr',
  'bcrs': 'bcr',
  'derogation (art. 49)': 'art49_derogation',
  'derogation (art 49)': 'art49_derogation',
  'derogation': 'art49_derogation',
  'data privacy framework': 'dpf',
  'eu-us data privacy framework': 'dpf',
};

/**
 * D43: `transfer_mechanism` holds two vocabularies — the Transfers tab shipped prose
 * ('Standard Contractual Clauses (SCCs)') and the vendor auto-create path a slug
 * ('pending_assessment'). Both are in the column today. This maps either onto the
 * enum key so an existing row opens in the picker instead of rendering blank.
 */
export function normaliseTransferMechanism(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if ((TRANSFER_MECHANISMS as readonly string[]).includes(v)) return v;
  return MECHANISM_ALIASES[v] ?? null;
}

/** Kept in step with `MECHANISM_REQUIRED_FIELDS` in the API constants. */
export const MECHANISM_FIELDS: Record<string, string[]> = {
  adequacy_decision: ['adequacyDecisionReference'],
  scc: ['sccYear', 'sccModule', 'executionDate', 'expiryDate', 'signatories', 'annexesComplete'],
  bcr: ['bcrReference'],
  dpf: ['dpfCertificationNumber', 'dpfScope', 'dpfExpiryDate'],
  art49_derogation: ['article49SubReason', 'article49Justification'],
  codes_of_conduct: ['mechanismDetail'],
  certification: ['mechanismDetail'],
  pending_assessment: [],
  other: ['mechanismDetail'],
};

/**
 * Resolves a vocabulary into the reader's language.
 *
 * A hook rather than a function because next-intl's catalogue is context, and the
 * alternative — threading a `t` through every component that renders a picker —
 * is how half of these came to be hardcoded in the first place.
 */
export function useRopaVocabulary() {
  const t = useTranslations('ropa.vocab');
  const h = useTranslations('ropa.vocab_hints');

  const label = (group: VocabGroup, value?: string | null): string => {
    if (!value) return '';
    return (VOCAB_GROUPS[group] as readonly string[]).includes(value)
      ? t(`${group}.${value}` as any)
      // An unrecognised value is legacy data, not a missing translation: showing it
      // verbatim is right, and asking the catalogue for it would render a key path.
      : value;
  };

  const hint = (group: VocabGroup, value?: string | null): string | undefined => {
    if (!value || !HINTED[group]?.includes(value)) return undefined;
    return h(`${group}.${value}` as any);
  };

  const options = (group: VocabGroup): Option[] =>
    (VOCAB_GROUPS[group] as readonly string[]).map((value) => ({
      value,
      label: label(group, value),
      hint: hint(group, value),
    }));

  return { label, hint, options };
}
