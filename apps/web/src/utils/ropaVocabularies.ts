/**
 * Display labels for the register's controlled vocabularies.
 *
 * The values live in `apps/api/src/constants/ropaVocabularies.ts`, which is what
 * validates them; this file only names them for a human. The split mirrors
 * `utils/countries.ts` against `constants/transferDestinations.ts` — the API owns
 * the truth, the web owns the wording.
 *
 * Adequacy is deliberately absent for the reason `countries.ts` gives: it changes by
 * Commission decision and it carries scope caveats, so it is served by
 * `ropa.transferDestinations` rather than copied here. A second copy of that list is
 * precisely what produced D17.
 *
 * These strings are English. The five child tabs are hardcoded English throughout
 * and extracting them is one sweep (R142, Sprint 2) — adding a half-translated tab
 * now would leave German and French readers seeing raw key paths, which next-intl
 * renders verbatim and which is worse than consistent English.
 */

export type Option = { value: string; label: string; hint?: string };

/** Art. 9(1). */
export const SPECIAL_CATEGORY_TYPES: Option[] = [
  { value: 'racial_or_ethnic_origin', label: 'Racial or ethnic origin' },
  { value: 'political_opinions', label: 'Political opinions' },
  { value: 'religious_or_philosophical_beliefs', label: 'Religious or philosophical beliefs' },
  { value: 'trade_union_membership', label: 'Trade union membership' },
  { value: 'genetic_data', label: 'Genetic data' },
  { value: 'biometric_data_for_id', label: 'Biometric data for identification' },
  { value: 'health_data', label: 'Health data' },
  { value: 'sex_life', label: 'Sex life' },
  { value: 'sexual_orientation', label: 'Sexual orientation' },
];

/**
 * Art. 9(2)(a)–(j). The labels are shortened; the hint carries enough of the
 * condition for someone to tell (h) from (i) without opening the Regulation.
 */
export const ARTICLE_9_CONDITIONS: Option[] = [
  { value: 'a', label: '(a) Explicit consent', hint: 'The subject has given explicit consent to the processing for one or more specified purposes.' },
  { value: 'b', label: '(b) Employment and social security law', hint: 'Necessary for obligations in employment, social security or social protection law. Requires Union or Member State law.' },
  { value: 'c', label: '(c) Vital interests', hint: 'Necessary to protect vital interests where the subject is incapable of giving consent.' },
  { value: 'd', label: '(d) Not-for-profit body', hint: 'Legitimate activities of a foundation, association or not-for-profit with a political, philosophical, religious or trade-union aim.' },
  { value: 'e', label: '(e) Manifestly made public', hint: 'The data were manifestly made public by the data subject.' },
  { value: 'f', label: '(f) Legal claims', hint: 'Necessary for the establishment, exercise or defence of legal claims, or for courts acting judicially.' },
  { value: 'g', label: '(g) Substantial public interest', hint: 'Necessary for reasons of substantial public interest. Requires Union or Member State law.' },
  { value: 'h', label: '(h) Health or social care', hint: 'Preventive or occupational medicine, medical diagnosis, health or social care. Requires Union or Member State law.' },
  { value: 'i', label: '(i) Public health', hint: 'Public interest in the area of public health. Requires Union or Member State law.' },
  { value: 'j', label: '(j) Archiving, research, statistics', hint: 'Archiving in the public interest, scientific or historical research, or statistical purposes. Requires Union or Member State law.' },
];

/** The four that are only available where Union or Member State law provides. */
export const ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW = ['b', 'h', 'i', 'j'];

export function article9RequiresNationalLaw(condition?: string | null): boolean {
  return !!condition && ARTICLE_9_CONDITIONS_REQUIRING_NATIONAL_LAW.includes(condition);
}

/** Recital 26. */
export const IDENTIFIABILITY_LEVELS: Option[] = [
  { value: 'direct', label: 'Directly identifying', hint: 'Identifies a person on its own — a name, an email address, a national ID.' },
  { value: 'indirect', label: 'Indirectly identifying', hint: 'Identifies a person in combination with other data held.' },
  { value: 'pseudonymised', label: 'Pseudonymised', hint: 'Art. 4(5). Still personal data, and squarely inside the Regulation.' },
  { value: 'anonymous', label: 'Anonymous', hint: 'Recital 26. Outside the Regulation entirely — only if re-identification is genuinely impossible.' },
];

export const SENSITIVITY_LEVELS: Option[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'confidential', label: 'Confidential', hint: 'Commercially or personally sensitive without being an Art. 9 category — salary, bank details.' },
  { value: 'special', label: 'Special category', hint: 'Art. 9(1) or Art. 10.' },
];

export const RETENTION_TRIGGERS: Option[] = [
  { value: 'collection', label: 'Date of collection' },
  { value: 'last_interaction', label: 'Last interaction' },
  { value: 'end_of_contract', label: 'End of contract' },
  { value: 'end_of_employment', label: 'End of employment' },
  { value: 'account_closure', label: 'Account closure' },
  { value: 'consent_withdrawal', label: 'Withdrawal of consent' },
  { value: 'case_closure', label: 'Case closure' },
  { value: 'statutory_period_end', label: 'End of statutory period' },
];

export const VOLUME_BANDS: Option[] = [
  { value: 'under_100', label: 'Under 100' },
  { value: '100_999', label: '100 – 999' },
  { value: '1k_10k', label: '1,000 – 10,000' },
  { value: '10k_100k', label: '10,000 – 100,000' },
  { value: '100k_1m', label: '100,000 – 1 million' },
  { value: 'over_1m', label: 'Over 1 million' },
];

/** Art. 30(1)(d). */
export const RECIPIENT_CATEGORIES: Option[] = [
  { value: 'internal_department', label: 'Internal department' },
  { value: 'group_company', label: 'Group company' },
  { value: 'it_service_provider', label: 'IT service provider' },
  { value: 'cloud_hosting_provider', label: 'Cloud hosting provider' },
  { value: 'payment_provider', label: 'Payment provider' },
  { value: 'marketing_agency', label: 'Marketing agency' },
  { value: 'professional_adviser', label: 'Professional adviser' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'insurer', label: 'Insurer' },
  { value: 'bank_or_financial_institution', label: 'Bank or financial institution' },
  { value: 'courier_or_logistics', label: 'Courier or logistics' },
  { value: 'public_authority', label: 'Public authority' },
  { value: 'court_or_tribunal', label: 'Court or tribunal' },
  { value: 'law_enforcement', label: 'Law enforcement' },
  { value: 'regulator', label: 'Regulator' },
  { value: 'other', label: 'Other' },
];

export const RECIPIENT_ROLES: Option[] = [
  { value: 'processor', label: 'Processor', hint: 'Art. 28. Processes on your documented instructions and needs a DPA.' },
  { value: 'sub_processor', label: 'Sub-processor', hint: 'Art. 28(2). Engaged by your processor, with your prior authorisation.' },
  { value: 'joint_controller', label: 'Joint controller', hint: 'Art. 26. You jointly determine purposes and means, and need an arrangement.' },
  { value: 'independent_controller', label: 'Independent controller', hint: 'Determines its own purposes. The disclosure hands over controllership.' },
];

export const TRANSFER_MECHANISMS: Option[] = [
  { value: 'adequacy_decision', label: 'Adequacy decision (Art. 45)' },
  { value: 'scc', label: 'Standard Contractual Clauses (Art. 46(2)(c))' },
  { value: 'bcr', label: 'Binding Corporate Rules (Art. 47)' },
  { value: 'dpf', label: 'EU–US Data Privacy Framework' },
  { value: 'art49_derogation', label: 'Derogation (Art. 49)' },
  { value: 'codes_of_conduct', label: 'Approved code of conduct (Art. 46(2)(e))' },
  { value: 'certification', label: 'Approved certification (Art. 46(2)(f))' },
  { value: 'pending_assessment', label: 'Not yet assessed' },
  { value: 'other', label: 'Other' },
];

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
  if (TRANSFER_MECHANISMS.some((m) => m.value === v)) return v;
  return MECHANISM_ALIASES[v] ?? null;
}

export const SCC_YEARS: Option[] = [
  { value: '2021', label: '2021 clauses (2021/914)' },
  { value: '2010', label: '2010 clauses — repealed', hint: 'Repealed with effect from 27 December 2022. A transfer relying on these has no Art. 46 mechanism.' },
];

export const SCC_REPEALED_YEARS = ['2010'];

export const SCC_MODULES: Option[] = [
  { value: 'module_one', label: 'Module 1 — controller to controller' },
  { value: 'module_two', label: 'Module 2 — controller to processor' },
  { value: 'module_three', label: 'Module 3 — processor to processor' },
  { value: 'module_four', label: 'Module 4 — processor to controller' },
];

export const ARTICLE_49_SUB_REASONS: Option[] = [
  { value: 'a_explicit_consent', label: '(a) Explicit informed consent', hint: 'The subject was told of the possible risks of a transfer without a mechanism, and consented anyway.' },
  { value: 'b_contract_with_subject', label: '(b) Necessary for a contract with the subject' },
  { value: 'c_contract_in_subject_interest', label: '(c) Contract concluded in the subject’s interest' },
  { value: 'd_public_interest', label: '(d) Important reasons of public interest' },
  { value: 'e_legal_claims', label: '(e) Establishment, exercise or defence of legal claims' },
  { value: 'f_vital_interests', label: '(f) Vital interests, subject incapable of consent' },
  { value: 'g_public_register', label: '(g) Transfer from a public register' },
  { value: 'compelling_legitimate_interests', label: 'Compelling legitimate interests', hint: 'The 49(1) second sub-paragraph: non-repetitive, limited subjects, supervisory authority informed.' },
];

export const DPF_SCOPES: Option[] = [
  { value: 'non_hr', label: 'Non-HR data only' },
  { value: 'hr', label: 'HR data only' },
  { value: 'both', label: 'HR and non-HR data' },
];

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

export function labelFor(options: Option[], value?: string | null): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}
