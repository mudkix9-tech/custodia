/**
 * The GDPR obligations an auditor walks through, and what each one asks for.
 *
 * This is the spine of the readiness module: coverage is measured per article,
 * because that is the unit an auditor works in. Keeping it as data rather than
 * scattering article numbers through the UI means the evidence library, the
 * coverage view and any future export all agree on the same list.
 *
 * Scoped to the controller obligations a European SME actually has to
 * demonstrate — not the whole regulation. Articles that bind supervisory
 * authorities or member states are out of scope by design.
 */
export type GdprArticle = {
  id: string;
  title: string;
  /** What an auditor expects to be shown. */
  expects: string;
  chapter: string;
};

export const GDPR_ARTICLES: GdprArticle[] = [
  { id: '5',  chapter: 'Principles', title: 'Principles of processing',
    expects: 'Evidence that purpose limitation, minimisation and storage limitation are applied in practice.' },
  { id: '6',  chapter: 'Principles', title: 'Lawfulness of processing',
    expects: 'A lawful basis recorded for every processing activity.' },
  { id: '7',  chapter: 'Principles', title: 'Conditions for consent',
    expects: 'Consent records showing what was agreed, when, and how it can be withdrawn.' },
  { id: '9',  chapter: 'Principles', title: 'Special categories',
    expects: 'An Article 9 condition for any special-category processing.' },

  { id: '12', chapter: 'Rights', title: 'Transparent information',
    expects: 'Privacy notices in plain language, and the timescales you answer requests in.' },
  { id: '13', chapter: 'Rights', title: 'Information to be provided',
    expects: 'The notice given when you collect data directly from the person.' },
  { id: '14', chapter: 'Rights', title: 'Information where data not obtained from the subject',
    expects: 'The notice given when data reaches you from somewhere else.' },
  { id: '15', chapter: 'Rights', title: 'Right of access',
    expects: 'A worked DSAR showing what was disclosed and how identity was verified.' },
  { id: '17', chapter: 'Rights', title: 'Right to erasure',
    expects: 'Evidence that erasure propagates to processors and backups.' },
  { id: '20', chapter: 'Rights', title: 'Right to data portability',
    expects: 'An export in a structured, machine-readable format.' },

  { id: '24', chapter: 'Accountability', title: 'Responsibility of the controller',
    expects: 'The policies and governance that make compliance demonstrable.' },
  { id: '25', chapter: 'Accountability', title: 'Data protection by design and by default',
    expects: 'Evidence that privacy review happens before a system ships, not after.' },
  { id: '28', chapter: 'Accountability', title: 'Processor contracts',
    expects: 'A signed Article 28 contract for every processor.' },
  { id: '30', chapter: 'Accountability', title: 'Records of processing activities',
    expects: 'A current ROPA covering purposes, categories, recipients, transfers and retention.' },
  { id: '32', chapter: 'Security', title: 'Security of processing',
    expects: 'Technical and organisational measures, and evidence they are tested.' },
  { id: '33', chapter: 'Security', title: 'Breach notification to the authority',
    expects: 'A breach register and evidence the 72-hour path has been rehearsed.' },
  { id: '34', chapter: 'Security', title: 'Breach communication to data subjects',
    expects: 'The criteria you use to decide, and a worked example.' },
  { id: '35', chapter: 'Accountability', title: 'Data protection impact assessment',
    expects: 'DPIAs for high-risk processing, with residual risk signed off.' },
  { id: '37', chapter: 'Governance', title: 'Designation of a DPO',
    expects: 'Either a DPO appointment, or a documented assessment that one is not required.' },
  { id: '39', chapter: 'Governance', title: 'Tasks of the DPO',
    expects: 'Evidence the DPO monitors compliance and advises on DPIAs.' },

  { id: '44', chapter: 'Transfers', title: 'General principle for transfers',
    expects: 'A transfer map showing where personal data actually goes.' },
  { id: '46', chapter: 'Transfers', title: 'Appropriate safeguards',
    expects: 'SCCs or another Article 46 mechanism for each third-country transfer.' },
  { id: '49', chapter: 'Transfers', title: 'Derogations',
    expects: 'Where you rely on a derogation, the reasoning for it.' },
];

export const GDPR_ARTICLE_IDS = GDPR_ARTICLES.map((a) => a.id);

/** Article ids grouped by the chapter headings the coverage view renders under. */
export const GDPR_CHAPTERS = [...new Set(GDPR_ARTICLES.map((a) => a.chapter))];
