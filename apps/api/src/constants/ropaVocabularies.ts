/**
 * The controlled vocabularies the register needs in order to be a register.
 *
 * Everything here was free text or absent. "Which activities process health data?"
 * — the question a DPO is asked most often — cannot be answered against free text,
 * and an Art. 9(2) condition that is a text box is a condition nobody fills in.
 *
 * These are *values*, not display strings: the web workspace holds its own copy of
 * the labels, the same way `utils/countries.ts` mirrors `transferDestinations.ts`.
 * The split is deliberate — the API validates, the web renders.
 */

// --------------------------------------------------------------------------
// Article 9(1) — the special categories themselves.
// The Article names nine; genetic and biometric data were added in 2016 and are
// the two most often missed in a hand-built register.
// --------------------------------------------------------------------------
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
export type SpecialCategoryType = (typeof SPECIAL_CATEGORY_TYPES)[number];

// --------------------------------------------------------------------------
// Article 9(2)(a)–(j) — the conditions that lift the 9(1) prohibition.
// --------------------------------------------------------------------------
export const ARTICLE_9_CONDITIONS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;
export type Article9Condition = (typeof ARTICLE_9_CONDITIONS)[number];

/**
 * The four conditions that are only available where Union or Member State law
 * provides for them. Recording (b), (h), (i) or (j) without naming that law is an
 * incomplete answer, and the completeness scorer treats it as one.
 */
export const ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW: readonly Article9Condition[] = ['b', 'h', 'i', 'j'];

export function article9RequiresNationalLaw(condition?: string | null): boolean {
  return !!condition && (ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW as readonly string[]).includes(condition);
}

// --------------------------------------------------------------------------
// Recital 26. Anonymous data is outside the Regulation; pseudonymised data is
// squarely inside it. A register that cannot tell them apart over-reports in one
// direction and under-reports in the other.
// --------------------------------------------------------------------------
export const IDENTIFIABILITY_LEVELS = ['direct', 'indirect', 'pseudonymised', 'anonymous'] as const;
export type Identifiability = (typeof IDENTIFIABILITY_LEVELS)[number];

export const SENSITIVITY_LEVELS = ['standard', 'confidential', 'special'] as const;

/**
 * Art. 30(1)(f) wants a period, and a period is only meaningful against the event
 * it runs from. "6 years" from what — collection, last contact, or the end of the
 * contract? These are the triggers a retention schedule actually uses.
 */
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

// --------------------------------------------------------------------------
// Art. 30(1)(c), first limb — volume bands.
// EDPB WP248 asks for the number of subjects "either as a specific number or as a
// proportion". A band is the answer a business owner can give without guessing.
// --------------------------------------------------------------------------
export const VOLUME_BANDS = [
  'under_100',
  '100_999',
  '1k_10k',
  '10k_100k',
  '100k_1m',
  'over_1m',
] as const;

// --------------------------------------------------------------------------
// Art. 30(1)(d) — categories of recipient, and what each recipient is in law.
// --------------------------------------------------------------------------
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

/**
 * `recipient_type` says what kind of organisation it is ('vendor', 'other'). This
 * says what it is in law, which is what decides whether Art. 28 applies, whether
 * Art. 26 applies, and whether the disclosure hands over controllership.
 *
 * Art. 4(9)'s carve-out is why `public_authority` is a recipient *category* and not
 * a role: an authority receiving data under a legal inquiry is not a recipient.
 */
export const RECIPIENT_ROLES = [
  'processor',
  'sub_processor',
  'joint_controller',
  'independent_controller',
] as const;

// --------------------------------------------------------------------------
// Chapter V mechanism metadata.
// --------------------------------------------------------------------------

/**
 * One vocabulary for the mechanism, at last. `transfer_mechanism` currently holds
 * two — the tab's prose ('Standard Contractual Clauses (SCCs)') and the auto-create
 * path's slug ('pending_assessment'), which is D43. Both stay readable; new writes
 * use these keys, and `normaliseTransferMechanism` maps the prose onto them.
 */
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
export type TransferMechanism = (typeof TRANSFER_MECHANISMS)[number];

const MECHANISM_ALIASES: Record<string, TransferMechanism> = {
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

export function normaliseTransferMechanism(value?: string | null): TransferMechanism | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if ((TRANSFER_MECHANISMS as readonly string[]).includes(v)) return v as TransferMechanism;
  return MECHANISM_ALIASES[v] ?? null;
}

/**
 * The 2010 clauses were repealed with effect from 27 December 2022. A transfer still
 * relying on them has no Art. 46 mechanism, which is why the year is a field and not
 * a footnote.
 */
export const SCC_YEARS = ['2021', '2010'] as const;
export const SCC_REPEALED_YEARS: readonly string[] = ['2010'];

/** Commission Implementing Decision (EU) 2021/914, the four modules. */
export const SCC_MODULES = [
  'module_one',    // controller to controller
  'module_two',    // controller to processor
  'module_three',  // processor to processor
  'module_four',   // processor to controller
] as const;

/** Art. 49(1)(a)–(g) plus the 49(1) second sub-paragraph compelling-interests route. */
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

/** The DPF covers only what the importer certified for. HR data is a separate scope. */
export const DPF_SCOPES = ['non_hr', 'hr', 'both'] as const;

/**
 * Which mechanism-specific fields a transfer must carry to count as documented.
 * The completeness scorer and the transfers tab both read this, so a mechanism
 * cannot grow a required field in one and not the other.
 */
export const MECHANISM_REQUIRED_FIELDS: Record<TransferMechanism, readonly string[]> = {
  adequacy_decision: ['adequacyDecisionReference'],
  scc: ['sccYear', 'sccModule', 'executionDate'],
  bcr: ['bcrReference'],
  dpf: ['dpfCertificationNumber', 'dpfScope'],
  art49_derogation: ['article49SubReason', 'article49Justification'],
  codes_of_conduct: ['mechanismDetail'],
  certification: ['mechanismDetail'],
  // A placeholder written by the auto-create path. It is not a mechanism, and
  // demanding fields of it would report every freshly linked vendor as incomplete
  // for a reason the user cannot act on until they have chosen one.
  pending_assessment: [],
  other: ['mechanismDetail'],
};
