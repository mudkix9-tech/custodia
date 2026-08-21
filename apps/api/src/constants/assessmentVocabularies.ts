/**
 * The controlled vocabularies the three assessments need — the DPIA screening
 * criteria, the DPIA's own enums, the LIA's, and the TIA's supplementary-measures
 * catalogue.
 *
 * Same split as `ropaVocabularies.ts`: these are *values*, not display strings.
 * The API validates against them and the web workspace resolves the wording
 * through `ropa.vocab` / `dpia.vocab`, which is what R142 established and what
 * `check:ropa-i18n` enforces. A label in this file is a label that renders in
 * English on a German screen.
 */

// ---------------------------------------------------------------------------
// F56 — the screening criteria.
//
// Art. 35(3)(a)–(c) names three cases where a DPIA is *always* required. WP248
// rev.01 gives nine criteria and the rule of thumb that two or more means a DPIA
// is required; one means it probably is. The two lists overlap deliberately —
// 35(3)(a) is WP248's "evaluation or scoring" plus "automated decision-making",
// and a screening that only asked WP248 would miss the statutory cases the
// Article itself settles.
// ---------------------------------------------------------------------------

/** Art. 35(3)(a)–(c). Any one of these means a DPIA is required, full stop. */
export const ARTICLE_35_3_CRITERIA = [
  // (a) systematic and extensive evaluation based on automated processing,
  //     including profiling, on which decisions with legal or similarly
  //     significant effects are based.
  'art_35_3_a_automated_decisions',
  // (b) processing on a large scale of Art. 9 or Art. 10 data.
  'art_35_3_b_large_scale_special_category',
  // (c) systematic monitoring of a publicly accessible area on a large scale.
  'art_35_3_c_public_area_monitoring',
] as const;
export type Article353Criterion = (typeof ARTICLE_35_3_CRITERIA)[number];

/** WP248 rev.01, the nine criteria. */
export const WP248_CRITERIA = [
  'wp248_evaluation_or_scoring',
  'wp248_automated_decision_legal_effect',
  'wp248_systematic_monitoring',
  'wp248_sensitive_or_highly_personal',
  'wp248_large_scale',
  'wp248_matching_or_combining',
  'wp248_vulnerable_subjects',
  'wp248_innovative_technology',
  'wp248_prevents_rights_or_contract',
] as const;
export type Wp248Criterion = (typeof WP248_CRITERIA)[number];

export const SCREENING_CRITERIA = [...ARTICLE_35_3_CRITERIA, ...WP248_CRITERIA] as const;
export type ScreeningCriterion = (typeof SCREENING_CRITERIA)[number];

/**
 * Art. 35(4) national blacklists — the operations a supervisory authority has
 * published as always requiring a DPIA in its own jurisdiction.
 *
 * Not exhaustive, and deliberately so: these are the entries that recur across
 * the published lists and that a register can actually be screened against. The
 * jurisdiction is what decides which apply, because an operation on the German
 * list is not on the Irish one and a screening that silently merged the two
 * would over-report for every customer outside Germany.
 *
 * `EU` entries are the EDPB's own common set, applied everywhere.
 */
export const NATIONAL_BLACKLISTS: Readonly<Record<string, readonly string[]>> = {
  EU: [
    'biometric_identification_large_scale',
    'genetic_data_processing',
    'location_tracking_of_individuals',
    'employee_monitoring',
    'children_profiling_or_marketing',
  ],
  // Datenschutzkonferenz "Muss-Liste" (the German DSK list), abbreviated.
  DE: [
    'ai_processing_of_personal_data',
    'large_scale_credit_scoring',
    'telematics_insurance_scoring',
    'whistleblowing_systems',
    'call_centre_recording_and_analysis',
  ],
  // CNIL's liste des traitements pour lesquels une AIPD est requise.
  FR: [
    'health_data_for_research',
    'social_or_health_support_profiling',
    'large_scale_document_management_with_sensitive_data',
    'biometric_access_control',
  ],
  // ICO's list under UK GDPR Art. 35(4).
  GB: [
    'innovative_technology',
    'denial_of_service_based_on_automated_decision',
    'invisible_processing',
    'tracking_of_geolocation_or_behaviour',
    'targeting_of_children_or_vulnerable_people',
  ],
  // Irish DPC list.
  IE: [
    'large_scale_profiling_with_significant_effect',
    'systematic_monitoring_of_employees',
    'processing_of_special_category_for_ai_training',
  ],
  // AEPD's listado de tratamientos.
  ES: [
    'large_scale_special_category',
    'processing_with_no_information_to_subjects',
    'transfer_outside_eea_without_safeguards',
  ],
} as const;

export const SCREENING_VERDICTS = ['required', 'recommended', 'not_required'] as const;
export type ScreeningVerdict = (typeof SCREENING_VERDICTS)[number];

// ---------------------------------------------------------------------------
// F57 — DPIA vocabularies.
// ---------------------------------------------------------------------------

export const DPIA_STATUSES = ['draft', 'in_review', 'consultation', 'signed_off', 'superseded'] as const;
export type DpiaStatus = (typeof DPIA_STATUSES)[number];

/** The CNIL triad plus the two harms that do not fit it. */
export const DPIA_RISK_CATEGORIES = [
  'illegitimate_access',
  'unwanted_modification',
  'data_disappearance',
  'unlawful_processing',
  'excessive_processing',
] as const;

/** Recital 75. What actually happens to the person. */
export const DPIA_HARMS = [
  'discrimination',
  'identity_theft',
  'financial_loss',
  'reputational_damage',
  'loss_of_confidentiality',
  'de_pseudonymisation',
  'economic_or_social_disadvantage',
  'loss_of_control_over_data',
  'physical_harm',
] as const;

export const DPIA_MEASURE_TYPES = ['technical', 'organisational', 'contractual', 'transparency'] as const;
export const DPIA_MEASURE_EFFECTIVENESS = ['not_assessed', 'partial', 'effective'] as const;
export const DPO_OPINION_OUTCOMES = ['approve', 'approve_with_conditions', 'object'] as const;
export const DPIA_SIGN_OFF_DECISIONS = ['proceed', 'proceed_with_conditions', 'do_not_proceed'] as const;
export const DPIA_CONSULTATION_METHODS = [
  'survey',
  'focus_group',
  'representative_body',
  'works_council',
  'public_consultation',
  'existing_research',
] as const;
export const PRIOR_CONSULTATION_STATUSES = [
  'not_required',
  'required',
  'submitted',
  'responded',
  'closed',
] as const;

/**
 * The 1–4 scale both axes of the matrix use.
 *
 * Four rather than five on purpose: an odd scale has a middle, and a middle is
 * where every risk lands when nobody wants to argue about it. The CNIL's own
 * methodology uses four for the same reason.
 */
export const RISK_SCALE = [1, 2, 3, 4] as const;

// ---------------------------------------------------------------------------
// F55 — LIA vocabularies.
// ---------------------------------------------------------------------------

export const LIA_STATUSES = ['draft', 'completed', 'superseded'] as const;
export type LiaStatus = (typeof LIA_STATUSES)[number];

export const LIA_OUTCOMES = ['proceed', 'proceed_with_safeguards', 'do_not_proceed'] as const;
export type LiaOutcome = (typeof LIA_OUTCOMES)[number];

export const LIA_BENEFICIARIES = ['controller', 'third_party', 'both'] as const;
export const LIA_IMPORTANCE = ['compelling', 'moderate', 'minor'] as const;

// ---------------------------------------------------------------------------
// F58 — TIA vocabularies and the EDPB supplementary-measures catalogue.
// ---------------------------------------------------------------------------

export const TIA_STATUSES = ['draft', 'in_review', 'completed', 'superseded'] as const;
export const TIA_CONCLUSIONS = ['proceed', 'proceed_with_measures', 'suspend'] as const;
export type TiaConclusion = (typeof TIA_CONCLUSIONS)[number];

export const TIA_LEGAL_CONCLUSIONS = [
  'equivalent',
  'equivalent_with_measures',
  'not_equivalent',
] as const;

export const TIA_TRANSFER_FREQUENCIES = ['one_off', 'occasional', 'regular', 'continuous'] as const;

/**
 * Recommendations 01/2020, Annexe 2. The measures are grouped the way the EDPB
 * groups them because the grouping carries the finding: a contractual measure
 * alone never cures a legal regime that permits disproportionate access, and the
 * TIA scorer says so rather than counting boxes.
 */
export const TIA_TECHNICAL_MEASURES = [
  'encryption_in_transit',
  'encryption_at_rest_importer_no_key',
  'encryption_keys_held_in_eea',
  'pseudonymisation_before_transfer',
  'split_processing_multi_party',
  'transport_encryption_with_protected_endpoints',
  'end_to_end_encryption',
] as const;

export const TIA_ORGANISATIONAL_MEASURES = [
  'internal_policy_for_government_access',
  'transparency_reporting',
  'documented_access_request_handling',
  'staff_training_on_access_requests',
  'regular_audits_of_importer',
  'data_minimisation_before_transfer',
] as const;

export const TIA_CONTRACTUAL_MEASURES = [
  'notify_exporter_of_access_request',
  'challenge_unlawful_access_requests',
  'warrant_canary',
  'assist_data_subjects_in_exercising_rights',
  'certification_of_no_backdoors',
  'onward_transfer_restrictions',
  'audit_rights',
] as const;

/**
 * The technical measures the EDPB treats as capable, on their own, of making a
 * transfer to a non-equivalent regime lawful — because the importer cannot read
 * the data at all.
 *
 * This is the distinction the TIA scorer needs and the reason the catalogue is
 * not a flat list: an assessment concluding "not equivalent" that then selects
 * three contractual measures and calls itself mitigated has restated the problem
 * rather than solved it.
 */
export const TIA_EFFECTIVE_ALONE_MEASURES: readonly string[] = [
  'encryption_at_rest_importer_no_key',
  'encryption_keys_held_in_eea',
  'end_to_end_encryption',
  'split_processing_multi_party',
];
