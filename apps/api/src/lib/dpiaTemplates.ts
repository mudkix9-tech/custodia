/**
 * F57's template library.
 *
 * Code rather than a table, for the same reason `ropaCatalogueSeeds.ts` is:
 * a template is content that ships with the product and changes with a release,
 * not data a customer owns. Putting it in the database would mean a migration
 * every time a risk description is reworded, and a per-tenant copy that drifts
 * from the one the guidance was written against.
 *
 * What a template supplies is the *starting position* — the risks that apply to
 * this kind of processing and the measures normally offered against them — so a
 * DPIA starts as a document to argue with rather than a blank page. Every field
 * is editable afterwards; nothing here is asserted on the customer's behalf.
 *
 * The five are the five that recur: CCTV, employee monitoring, marketing
 * profiling, health data, and AI or automated decision-making. Between them they
 * cover most of what actually triggers Art. 35(3) in a mid-sized organisation.
 */

export type DpiaTemplateRisk = {
  description: string;
  riskCategory: string;
  harms: string[];
  likelihood: number;
  severity: number;
  affectedSubjects: string;
  sourceOfRisk: string;
  measures: Array<{ description: string; measureType: string }>;
};

export type DpiaTemplate = {
  id: string;
  title: string;
  /** One line, shown in the picker. English fallback; the web translates. */
  summary: string;
  /** Which screening criteria this kind of processing usually meets. */
  typicalCriteria: string[];
  processingDescription: string;
  scopeDescription: string;
  contextDescription: string;
  necessityAssessment: string;
  proportionalityAssessment: string;
  risks: DpiaTemplateRisk[];
};

export const DPIA_TEMPLATES: readonly DpiaTemplate[] = [
  {
    id: 'cctv',
    title: 'CCTV and video surveillance',
    summary: 'Systematic monitoring of a publicly accessible area — Art. 35(3)(c).',
    typicalCriteria: ['art_35_3_c_public_area_monitoring', 'wp248_systematic_monitoring'],
    processingDescription:
      'Continuous video recording of [locations] by [number] fixed cameras, retained for [period] and reviewed on request following an incident.',
    scopeDescription:
      'Images of any person entering the monitored area, including staff, visitors and passers-by. No audio is recorded. Footage is held on [system] and accessible to [roles].',
    contextDescription:
      'Subjects are unaware of the identity of the operator beyond signage, cannot avoid the processing if they wish to enter the premises, and include members of the public who have no relationship with the controller.',
    necessityAssessment:
      'The stated purpose is [security / crime prevention / health and safety]. Consider whether lighting, physical barriers, staffing or access control would achieve it, and record why they would not.',
    proportionalityAssessment:
      'Coverage is limited to [areas]; no camera is directed at [entrances to toilets, rest areas, neighbouring property, public highway]. Retention is [period], being the shortest period in which an incident is typically reported.',
    risks: [
      {
        description: 'Footage is accessed by staff for purposes other than the stated security purpose.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data', 'reputational_damage'],
        likelihood: 3,
        severity: 2,
        affectedSubjects: 'Staff and visitors appearing in footage.',
        sourceOfRisk: 'Broad internal access to the recording system with no logging.',
        measures: [
          { description: 'Access to live and recorded footage limited to named individuals, reviewed quarterly.', measureType: 'organisational' },
          { description: 'All access to recorded footage logged and the log reviewed monthly.', measureType: 'technical' },
        ],
      },
      {
        description: 'Cameras capture areas beyond the controller’s premises, processing data about people with no connection to it.',
        riskCategory: 'excessive_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 3,
        severity: 3,
        affectedSubjects: 'Passers-by, neighbouring occupiers.',
        sourceOfRisk: 'Camera placement and field of view not reviewed after installation.',
        measures: [
          { description: 'Field of view documented per camera and privacy masking applied to areas outside the premises.', measureType: 'technical' },
          { description: 'Annual re-survey of camera positions with photographic evidence retained.', measureType: 'organisational' },
        ],
      },
      {
        description: 'Subjects are not effectively informed that the area is monitored.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 2,
        severity: 3,
        affectedSubjects: 'All subjects entering the monitored area.',
        sourceOfRisk: 'Signage absent, obscured, or lacking controller identity and contact details.',
        measures: [
          { description: 'Signage at every entrance naming the controller, the purpose and how to exercise rights.', measureType: 'transparency' },
        ],
      },
    ],
  },

  {
    id: 'employee_monitoring',
    title: 'Employee monitoring',
    summary: 'Systematic monitoring of staff — an imbalance of power that WP248 treats as a vulnerable-subject case.',
    typicalCriteria: ['wp248_systematic_monitoring', 'wp248_vulnerable_subjects', 'wp248_evaluation_or_scoring'],
    processingDescription:
      'Monitoring of [email / device activity / location / productivity metrics] for staff in [roles], collected [continuously / on a sampled basis] and reviewed by [roles].',
    scopeDescription:
      'All employees and contractors using [systems]. Data collected includes [categories]. Retained for [period].',
    contextDescription:
      'Employees cannot meaningfully refuse: the employment relationship is an imbalance of power, so consent is not available as a lawful basis and legitimate interests must be assessed with that imbalance in view (EDPB Opinion 2/2017).',
    necessityAssessment:
      'The purpose is [security / compliance / performance management]. Record whether a less intrusive measure — aggregated reporting, sampling, alert-only monitoring — would achieve it.',
    proportionalityAssessment:
      'Monitoring is limited to [systems and hours], excludes [personal communications, private devices, break periods], and produces [aggregated / individual] output. Staff are informed in [policy] and consulted through [works council / representative].',
    risks: [
      {
        description: 'Monitoring extends to private communications or activity outside working time.',
        riskCategory: 'excessive_processing',
        harms: ['loss_of_control_over_data', 'economic_or_social_disadvantage'],
        likelihood: 3,
        severity: 4,
        affectedSubjects: 'All monitored staff.',
        sourceOfRisk: 'Tooling that cannot distinguish work from personal use on a shared device.',
        measures: [
          { description: 'Monitoring scoped to corporate systems and working hours by configuration, not by policy alone.', measureType: 'technical' },
          { description: 'Personal-use folders and channels excluded from collection.', measureType: 'technical' },
        ],
      },
      {
        description: 'Monitoring output is used to make decisions about individuals without human review.',
        riskCategory: 'unlawful_processing',
        harms: ['discrimination', 'economic_or_social_disadvantage'],
        likelihood: 2,
        severity: 4,
        affectedSubjects: 'Staff subject to performance management.',
        sourceOfRisk: 'Automated scoring feeding directly into an HR process.',
        measures: [
          { description: 'A named manager reviews every case before any action, with authority to disregard the score.', measureType: 'organisational' },
          { description: 'Staff may contest a decision and have the reasoning explained.', measureType: 'transparency' },
        ],
      },
      {
        description: 'Staff are unaware of the extent of monitoring.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 3,
        severity: 3,
        affectedSubjects: 'All monitored staff.',
        sourceOfRisk: 'Policy describes monitoring in general terms only.',
        measures: [
          { description: 'A monitoring notice naming each system, what is collected and who sees it.', measureType: 'transparency' },
          { description: 'Consultation with the works council or staff representative body, minuted.', measureType: 'organisational' },
        ],
      },
    ],
  },

  {
    id: 'marketing_profiling',
    title: 'Marketing profiling and audience segmentation',
    summary: 'Evaluation and scoring of individuals, often combined from several sources.',
    typicalCriteria: ['wp248_evaluation_or_scoring', 'wp248_matching_or_combining', 'wp248_large_scale'],
    processingDescription:
      'Building behavioural segments from [web analytics / purchase history / third-party data] to target communications to [audience].',
    scopeDescription:
      'Approximately [number] individuals. Data includes [categories], combined from [sources] and retained for [period].',
    contextDescription:
      'Subjects generally expect their purchase history to inform recommendations; they typically do not expect it to be combined with data acquired from third parties, which is where the reasonable-expectations limb of the balancing test bites.',
    necessityAssessment:
      'Segmentation supports [purpose]. Consider whether contextual targeting, self-declared preferences or coarser segments would achieve the same result.',
    proportionalityAssessment:
      'No special-category inference is drawn. Segments are [size], large enough that an individual is not singled out. Objection is honoured within [period] and suppresses the individual from all segments.',
    risks: [
      {
        description: 'Segments infer special-category characteristics (health, beliefs, sexual orientation) from behaviour.',
        riskCategory: 'unlawful_processing',
        harms: ['discrimination', 'reputational_damage'],
        likelihood: 3,
        severity: 4,
        affectedSubjects: 'All profiled individuals.',
        sourceOfRisk: 'Behavioural signals that proxy for Art. 9 categories without being labelled as such.',
        measures: [
          { description: 'Prohibited-segment list enforced at build time, with the check logged.', measureType: 'technical' },
          { description: 'Quarterly review of live segments against the Art. 9 categories.', measureType: 'organisational' },
        ],
      },
      {
        description: 'An objection under Art. 21(2) is not applied across every downstream system.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 3,
        severity: 3,
        affectedSubjects: 'Individuals who have objected.',
        sourceOfRisk: 'Suppression held in one platform while segments are exported to others.',
        measures: [
          { description: 'A single suppression list consumed by every downstream platform, with a reconciliation report.', measureType: 'technical' },
        ],
      },
      {
        description: 'Third-party data is acquired without the subject having been informed under Art. 14.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 3,
        severity: 3,
        affectedSubjects: 'Individuals whose data was obtained indirectly.',
        sourceOfRisk: 'Supplier warranties accepted without evidence of the notice given.',
        measures: [
          { description: 'Evidence of the Art. 14 notice obtained from each data supplier before onboarding.', measureType: 'contractual' },
          { description: 'Art. 14(1) notice issued within one month of obtaining the data.', measureType: 'transparency' },
        ],
      },
    ],
  },

  {
    id: 'health_data',
    title: 'Health data processing',
    summary: 'Art. 9(1) data at scale — Art. 35(3)(b) applies wherever the scale is large.',
    typicalCriteria: ['art_35_3_b_large_scale_special_category', 'wp248_sensitive_or_highly_personal', 'wp248_large_scale'],
    processingDescription:
      'Processing of health information about [subjects] for [purpose], recorded in [system] and accessible to [roles].',
    scopeDescription:
      'Health data of approximately [number] individuals, including [diagnoses / occupational health assessments / absence records], retained for [period].',
    contextDescription:
      'Health data is among the most sensitive categories the Regulation recognises: the harm from disclosure is not reversible and can affect employment, insurance and relationships. Subjects are frequently in a dependent relationship with the controller.',
    necessityAssessment:
      'The Art. 9(2) condition relied on is [condition], and where that condition requires Union or Member State law, the provision is [citation]. Record why the purpose cannot be met with non-health data or with an assessment outcome alone.',
    proportionalityAssessment:
      'Only the outcome, not the underlying diagnosis, is shared with [roles]. Access is role-based and logged. Data is separated from the general personnel record.',
    risks: [
      {
        description: 'Health data is visible to staff who need only the outcome.',
        riskCategory: 'illegitimate_access',
        harms: ['loss_of_confidentiality', 'economic_or_social_disadvantage', 'discrimination'],
        likelihood: 3,
        severity: 4,
        affectedSubjects: 'All individuals whose health data is held.',
        sourceOfRisk: 'Health records stored inside a general personnel system with shared access.',
        measures: [
          { description: 'Health data held in a separate store with its own access control and audit log.', measureType: 'technical' },
          { description: 'Managers receive fitness-for-work outcomes only, never underlying detail.', measureType: 'organisational' },
        ],
      },
      {
        description: 'The Art. 9(2) condition relied on does not in fact cover the processing.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 2,
        severity: 4,
        affectedSubjects: 'All individuals whose health data is held.',
        sourceOfRisk: 'A condition selected once at set-up and never revisited as the purpose broadened.',
        measures: [
          { description: 'Art. 9(2) condition and its national law basis recorded per data category and reviewed annually.', measureType: 'organisational' },
        ],
      },
      {
        description: 'Health data is retained beyond the period the purpose requires.',
        riskCategory: 'excessive_processing',
        harms: ['loss_of_confidentiality'],
        likelihood: 3,
        severity: 3,
        affectedSubjects: 'Former staff, former patients or former clients.',
        sourceOfRisk: 'No deletion routine on a system whose retention is set per record.',
        measures: [
          { description: 'Automated deletion at the end of the retention period, with a disposal log.', measureType: 'technical' },
        ],
      },
    ],
  },

  {
    id: 'ai_automated_decisions',
    title: 'AI and automated decision-making',
    summary: 'Art. 35(3)(a) — evaluation with legal or similarly significant effect, and innovative technology.',
    typicalCriteria: [
      'art_35_3_a_automated_decisions',
      'wp248_automated_decision_legal_effect',
      'wp248_evaluation_or_scoring',
      'wp248_innovative_technology',
    ],
    processingDescription:
      'A [model type] evaluating [subjects] on [inputs] to produce [output], used to decide [decision] with [degree] of human involvement.',
    scopeDescription:
      'Approximately [number] individuals per [period]. Inputs are [categories]. Training data is [source]. Outputs are retained for [period].',
    contextDescription:
      'Where the decision produces legal or similarly significant effects, Art. 22(1) prohibits it unless one of the 22(2) exceptions applies, and 22(3) then requires at minimum a right to human intervention, to express a view and to contest.',
    necessityAssessment:
      'The Art. 22(2) exception relied on is [contract necessity / Union or Member State law / explicit consent]. Record why a non-automated process would not achieve the purpose at the volume involved.',
    proportionalityAssessment:
      'The model uses [features] and excludes [protected characteristics and their proxies]. Accuracy and disparity are measured on [schedule]. Every adverse outcome is reviewable by a named person with authority to overturn it.',
    risks: [
      {
        description: 'The model produces systematically worse outcomes for a protected group.',
        riskCategory: 'unlawful_processing',
        harms: ['discrimination', 'economic_or_social_disadvantage'],
        likelihood: 3,
        severity: 4,
        affectedSubjects: 'Individuals in the affected group.',
        sourceOfRisk: 'Training data reflecting historic decisions, and features that proxy for protected characteristics.',
        measures: [
          { description: 'Disparity testing across protected characteristics before deployment and quarterly thereafter.', measureType: 'technical' },
          { description: 'Documented feature review excluding direct and proxy protected characteristics.', measureType: 'organisational' },
        ],
      },
      {
        description: 'The logic cannot be explained to the individual as Art. 13(2)(f) and 15(1)(h) require.',
        riskCategory: 'unlawful_processing',
        harms: ['loss_of_control_over_data'],
        likelihood: 3,
        severity: 3,
        affectedSubjects: 'Every individual the model evaluates.',
        sourceOfRisk: 'A model chosen for accuracy with no explanation method attached.',
        measures: [
          { description: 'Per-decision explanation generated and stored alongside the outcome.', measureType: 'technical' },
          { description: 'Privacy notice describing the logic, significance and envisaged consequences in plain terms.', measureType: 'transparency' },
        ],
      },
      {
        description: 'Human review is nominal — the reviewer accepts the model output without authority or information to overturn it.',
        riskCategory: 'unlawful_processing',
        harms: ['economic_or_social_disadvantage'],
        likelihood: 4,
        severity: 4,
        affectedSubjects: 'Individuals receiving an adverse decision.',
        sourceOfRisk: 'Reviewers measured on throughput and shown only the score.',
        measures: [
          { description: 'Reviewers see the underlying inputs and the explanation, not only the score.', measureType: 'organisational' },
          { description: 'Override rate monitored; a rate near zero is investigated as a sign the review is nominal.', measureType: 'organisational' },
        ],
      },
    ],
  },
] as const;

export const DPIA_TEMPLATE_IDS = DPIA_TEMPLATES.map((t) => t.id);

export function findDpiaTemplate(id: string | null | undefined): DpiaTemplate | null {
  if (!id) return null;
  return DPIA_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * The 1–4 matrix, as one of four bands.
 *
 * Multiplication rather than addition, because a catastrophic-but-rare risk and a
 * trivial-but-certain one are not the same thing and adding makes them equal. The
 * bands are set so that anything scoring 12 or more — high on one axis and at
 * least high on the other — is critical, which is the threshold Art. 36 prior
 * consultation hangs on.
 */
export function riskBand(likelihood: number | null | undefined, severity: number | null | undefined): 'low' | 'medium' | 'high' | 'critical' | null {
  if (!likelihood || !severity) return null;
  const score = likelihood * severity;
  if (score >= 12) return 'critical';
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

const BAND_ORDER = ['low', 'medium', 'high', 'critical'] as const;

/**
 * The DPIA's overall and residual levels, from its risks.
 *
 * The worst risk sets the level. An average would let ten low risks dilute one
 * critical one, and it is the critical one that decides whether Art. 36 applies —
 * which is the only decision these two columns are used for.
 */
export function aggregateRiskLevels(
  risks: Array<{ likelihood?: number | null; severity?: number | null; residualLikelihood?: number | null; residualSeverity?: number | null }>,
): { overall: string | null; residual: string | null; requiresPriorConsultation: boolean } {
  let overall: number = -1;
  let residual: number = -1;

  for (const risk of risks) {
    const initial = riskBand(risk.likelihood, risk.severity);
    if (initial) overall = Math.max(overall, BAND_ORDER.indexOf(initial));

    // A risk with no residual assessment falls back to its initial band rather
    // than being skipped. Treating "not yet mitigated" as "no residual risk" is
    // how a DPIA with three unaddressed risks reports a residual level of low.
    const after = riskBand(risk.residualLikelihood, risk.residualSeverity) ?? initial;
    if (after) residual = Math.max(residual, BAND_ORDER.indexOf(after));
  }

  const residualBand = residual >= 0 ? BAND_ORDER[residual]! : null;

  return {
    overall: overall >= 0 ? BAND_ORDER[overall]! : null,
    residual: residualBand,
    // Art. 36(1): consultation is required where the DPIA indicates the
    // processing would result in a high risk *in the absence of measures taken
    // to mitigate it* — so it is the residual level, after measures, that is
    // read here, and 'critical' is where this product draws that line.
    requiresPriorConsultation: residualBand === 'critical',
  };
}
