/**
 * C32/C33. Interview-mode intake and delegated data-collection requests.
 *
 * The audit's finding is that a forty-person company still spends the afternoon
 * typing, and the reason is not that the fields are hard — it is that the person
 * who can answer them is a department head who has never heard of Article 30 and
 * is never going to get a Custodia login. So the questions are asked in their
 * language, over email, through a token; and what comes back is a *proposal*, not
 * a write.
 *
 * Two things this module is careful about:
 *
 *   1. **The questions are not the columns.** "What do you do with people's
 *      information?" is answerable; "state the purposes of the processing under
 *      Art. 30(1)(b)" is not, by the person being asked. Each question carries the
 *      field it feeds, so the merge screen can put the answer next to the record
 *      without the respondent ever seeing a column name.
 *
 *   2. **Nothing here writes.** `mapAnswersToFields` returns candidate values and
 *      the reviewer accepts them one at a time. A department head who can edit the
 *      Article 30 record directly is not delegated intake; it is an unreviewed
 *      register with more authors.
 *
 * Pure — the questions are data, and the mapping is a function.
 */

export type IntakeQuestionType = 'text' | 'textarea' | 'single_select' | 'multi_select' | 'yes_no' | 'people' | 'date';

export type IntakeQuestion = {
  id: string;
  /** The question as a human is asked it. English; the served copy is frozen on the request. */
  prompt: string;
  help?: string;
  type: IntakeQuestionType;
  required: boolean;
  options?: { value: string; label: string }[];
  /** Which register field this answer is a candidate for. Null where it only informs the reviewer. */
  field: string | null;
  /** Where the reviewer will find the field, matching the editor's `?tab=` values. */
  tab: string;
};

export type IntakeQuestionSet = {
  kind: 'interview' | 'review' | 'update';
  title: string;
  intro: string;
  questions: IntakeQuestion[];
};

const YES_NO: { value: string; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'I am not sure' },
];

/**
 * The interview.
 *
 * Ordered the way the conversation actually goes — what do you do, whose
 * information, what information, where does it come from, who else sees it, how
 * long do you keep it — rather than the order Article 30 lists its subparagraphs
 * in. A questionnaire that opens with "what is your lawful basis" is a
 * questionnaire that gets abandoned on question one.
 *
 * "I am not sure" is an option on every judgement question and it is the most
 * important design decision here. The alternative is a business owner guessing,
 * and a guess that arrives labelled as an answer is worse than a gap: the reviewer
 * has no way to tell it apart from knowledge.
 */
export const INTERVIEW_QUESTIONS: IntakeQuestion[] = [
  {
    id: 'activity_name',
    prompt: 'What is this activity called in your team?',
    help: 'The name you would use in a meeting — "Recruitment", "Customer support", "Payroll".',
    type: 'text', required: true, field: 'name', tab: 'general',
  },
  {
    id: 'what_you_do',
    prompt: 'In a sentence or two, what do you do with people’s information here?',
    help: 'What the activity achieves, not the team that does it. "We screen job applications and arrange interviews" rather than "HR".',
    type: 'textarea', required: true, field: 'purpose', tab: 'general',
  },
  {
    id: 'whose_information',
    prompt: 'Whose information is it?',
    help: 'Employees, job applicants, customers, website visitors, suppliers, and so on.',
    type: 'multi_select', required: true, field: 'dataSubjects', tab: 'data',
    options: [
      { value: 'employees', label: 'Employees' },
      { value: 'former_employees', label: 'Former employees' },
      { value: 'job_applicants', label: 'Job applicants' },
      { value: 'customers', label: 'Customers' },
      { value: 'prospective_customers', label: 'Prospective customers' },
      { value: 'website_visitors', label: 'Website visitors' },
      { value: 'suppliers', label: 'Supplier contacts' },
      { value: 'children', label: 'Children under 16' },
      { value: 'other', label: 'Someone else' },
    ],
  },
  {
    id: 'how_many',
    prompt: 'Roughly how many people is that?',
    type: 'single_select', required: false, field: 'volumeBand', tab: 'data',
    options: [
      { value: 'under_100', label: 'Fewer than 100' },
      { value: '100_999', label: 'Hundreds' },
      { value: '1k_10k', label: 'Thousands' },
      { value: '10k_100k', label: 'Tens of thousands' },
      { value: '100k_1m', label: 'Hundreds of thousands' },
      { value: 'over_1m', label: 'Over a million' },
    ],
  },
  {
    id: 'what_information',
    prompt: 'What information do you hold about them?',
    help: 'List what you can think of — names, email addresses, bank details, CVs, photographs, anything.',
    type: 'textarea', required: true, field: 'dataCategories', tab: 'data',
  },
  {
    id: 'sensitive_information',
    prompt: 'Does any of it cover health, religion, ethnicity, trade union membership, sexual orientation, or criminal records?',
    help: 'The law treats these differently, so it matters even if it is only occasional.',
    type: 'single_select', required: true, field: 'involvesSpecialCategories', tab: 'data', options: YES_NO,
  },
  {
    id: 'where_from',
    prompt: 'Where does the information come from?',
    help: 'Directly from the person, from a form on the website, from a recruitment site, from another company, and so on.',
    type: 'textarea', required: false, field: 'dataCategorySources', tab: 'data',
  },
  {
    id: 'systems',
    prompt: 'Which systems or tools do you use for this?',
    help: 'Anything the information is stored in or passes through — a spreadsheet counts.',
    type: 'textarea', required: true, field: 'recipients', tab: 'recipients',
  },
  {
    id: 'who_else_sees',
    prompt: 'Does anyone outside your organisation see this information?',
    help: 'Suppliers, agencies, accountants, IT providers — anyone at all.',
    type: 'textarea', required: false, field: 'recipients', tab: 'recipients',
  },
  {
    id: 'outside_europe',
    prompt: 'As far as you know, is any of it stored or accessed outside Europe?',
    type: 'single_select', required: false, field: 'transfers', tab: 'transfers', options: YES_NO,
  },
  {
    id: 'how_long',
    prompt: 'How long do you keep it, and what makes you delete it?',
    help: '"Six years after the employee leaves" is a better answer than "six years".',
    type: 'textarea', required: true, field: 'retentionPeriod', tab: 'retention',
  },
  {
    id: 'automated_decisions',
    prompt: 'Does a system make decisions about people here without a person reviewing them?',
    help: 'Automatic scoring, filtering or ranking of applications, customers or staff.',
    type: 'single_select', required: false, field: 'involvesAutomatedDecisionMaking', tab: 'general', options: YES_NO,
  },
  {
    id: 'owner',
    prompt: 'Who in your team is the right person to ask about this in future?',
    type: 'text', required: false, field: null, tab: 'general',
  },
  {
    id: 'anything_else',
    prompt: 'Anything else we should know?',
    type: 'textarea', required: false, field: null, tab: 'general',
  },
];

/**
 * The review questionnaire: sent against an activity that already exists, asking
 * its business owner whether the record is still true.
 *
 * Shorter on purpose. B19's attestation cycle already asks a *DPO* to confirm the
 * record; this asks the person who would actually know, and the value is in the
 * three questions a DPO cannot answer from their desk — has anything changed, is
 * anyone new involved, is it still happening at all.
 */
export const REVIEW_QUESTIONS: IntakeQuestion[] = [
  {
    id: 'still_happening',
    prompt: 'Is this still something your team does?',
    type: 'single_select', required: true, field: 'status', tab: 'general', options: YES_NO,
  },
  {
    id: 'description_accurate',
    prompt: 'Is the description below still accurate?',
    type: 'single_select', required: true, field: null, tab: 'general', options: YES_NO,
  },
  {
    id: 'what_changed',
    prompt: 'If anything has changed, what?',
    type: 'textarea', required: false, field: 'purpose', tab: 'general',
  },
  {
    id: 'new_systems',
    prompt: 'Have you started using any new systems, tools or suppliers for this?',
    type: 'textarea', required: false, field: 'recipients', tab: 'recipients',
  },
  {
    id: 'new_information',
    prompt: 'Are you collecting any information you were not collecting before?',
    type: 'textarea', required: false, field: 'dataCategories', tab: 'data',
  },
  {
    id: 'retention_accurate',
    prompt: 'Is the retention period below still what happens in practice?',
    type: 'single_select', required: true, field: null, tab: 'retention', options: YES_NO,
  },
];

export function questionSetFor(kind: string): IntakeQuestionSet {
  if (kind === 'review' || kind === 'update') {
    return {
      kind: 'review',
      title: 'Confirm a record of processing',
      intro: 'Your organisation keeps a record of how it uses people’s information, as the UK GDPR and the GDPR require. You are named as the person who knows about this one. It should take about three minutes.',
      questions: REVIEW_QUESTIONS,
    };
  }
  return {
    kind: 'interview',
    title: 'Tell us what your team does with people’s information',
    intro: 'Your organisation is putting together its record of how it uses people’s information, as the UK GDPR and the GDPR require. There are no wrong answers here and "I am not sure" is a real one — someone will review everything you send.',
    questions: INTERVIEW_QUESTIONS,
  };
}

export type IntakeAnswer = { questionId: string; value: unknown };

export type MergeCandidate = {
  questionId: string;
  field: string;
  tab: string;
  /** What the respondent said, verbatim. Shown beside the proposal so the reviewer can check it. */
  rawAnswer: unknown;
  /** What would be written if the reviewer accepts. */
  proposedValue: unknown;
  /** For a field that takes rows rather than a scalar — data categories, recipients. */
  kind: 'scalar' | 'list';
  /** Why this is a proposal rather than an answer, where the mapping had to interpret. */
  note?: string;
};

/**
 * Turns a set of answers into candidate register values.
 *
 * The interesting cases are the ones where the mapping *refuses* to be clever. "I
 * am not sure" about special categories does not produce `false`; it produces no
 * candidate at all, so the reviewer sees an unanswered question rather than a
 * confident negative. Same for the third-country question: a business owner
 * genuinely does not know where their SaaS vendor hosts data, and a register that
 * recorded their guess as a Chapter V position would be asserting something no one
 * had checked.
 */
export function mapAnswersToFields(questions: IntakeQuestion[], answers: Record<string, unknown>): MergeCandidate[] {
  const out: MergeCandidate[] = [];

  for (const q of questions) {
    if (!q.field) continue;
    const raw = answers[q.id];
    if (raw === undefined || raw === null || raw === '') continue;
    if (raw === 'unsure') continue;

    const base = { questionId: q.id, field: q.field, tab: q.tab, rawAnswer: raw };

    switch (q.field) {
      case 'dataCategories':
      case 'dataCategorySources':
      case 'recipients': {
        // Free prose split into rows. A comma-and-newline split is crude and it is
        // the right amount of crude: the reviewer edits each row before it lands,
        // so a split that is wrong costs a keystroke, and a split that is clever
        // costs a wrong Article 30 record.
        const items = splitList(String(raw));
        if (items.length === 0) continue;
        out.push({
          ...base,
          kind: 'list',
          proposedValue: items,
          note: 'Split from a free-text answer — check the rows before accepting.',
        });
        break;
      }
      case 'dataSubjects': {
        const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const labels = values.map((v) => q.options?.find((o) => o.value === v)?.label ?? v);
        out.push({ ...base, kind: 'list', proposedValue: labels });
        break;
      }
      case 'involvesSpecialCategories':
      case 'involvesAutomatedDecisionMaking': {
        if (raw !== 'yes' && raw !== 'no') continue;
        out.push({ ...base, kind: 'scalar', proposedValue: raw === 'yes' });
        break;
      }
      case 'transfers': {
        if (raw !== 'yes') continue;
        // A yes is a prompt, not a transfer. The country and the mechanism are the
        // record, and the respondent has neither.
        out.push({
          ...base,
          kind: 'scalar',
          proposedValue: true,
          note: 'The respondent believes data leaves the EEA. The destination and Chapter V mechanism still have to be established — this cannot be accepted as a transfer record on its own.',
        });
        break;
      }
      case 'status': {
        if (raw !== 'no') continue;
        out.push({
          ...base,
          kind: 'scalar',
          proposedValue: 'archived',
          note: 'The respondent says this no longer happens. Archiving keeps the record and its history rather than deleting it.',
        });
        break;
      }
      default:
        out.push({ ...base, kind: 'scalar', proposedValue: typeof raw === 'string' ? raw.trim() : raw });
    }
  }

  return out;
}

/**
 * Whether a response is complete enough to be worth reviewing.
 *
 * Used by the reminder ladder rather than as a gate: a partial response is still
 * information, and refusing to accept one means the respondent has to start again
 * from an email they have already lost.
 */
export function responseCompleteness(questions: IntakeQuestion[], answers: Record<string, unknown>): {
  answered: number;
  required: number;
  requiredAnswered: number;
  complete: boolean;
} {
  const required = questions.filter((q) => q.required);
  const isAnswered = (q: IntakeQuestion) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === '') return false;
    return !(Array.isArray(v) && v.length === 0);
  };
  const requiredAnswered = required.filter(isAnswered).length;
  return {
    answered: questions.filter(isAnswered).length,
    required: required.length,
    requiredAnswered,
    complete: requiredAnswered === required.length,
  };
}

/**
 * C33's reminder ladder, in the same shape B19's review ladder uses.
 *
 * Days *before* the due date, then one after. The last rung matters most: a
 * questionnaire that goes quiet is the ordinary outcome, and a request with no
 * overdue rung is a request the DPO discovers is unanswered a month later.
 */
export const INTAKE_REMINDER_LADDER = [7, 2, -1] as const;

export function intakeReminderDue(opts: {
  dueAt?: Date | string | null;
  remindersSent: number;
  lastReminderAt?: Date | string | null;
  now: Date;
}): boolean {
  const { dueAt, remindersSent, now } = opts;
  if (!dueAt) return false;
  if (remindersSent >= INTAKE_REMINDER_LADDER.length) return false;

  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;

  // One reminder per day at most, whatever the ladder says — two rungs falling on
  // the same day is how a respondent gets three emails in an afternoon.
  const last = opts.lastReminderAt ? new Date(opts.lastReminderAt) : null;
  if (last && now.getTime() - last.getTime() < 20 * 60 * 60 * 1000) return false;

  const rung = INTAKE_REMINDER_LADDER[remindersSent]!;
  const fireAt = new Date(due.getTime() - rung * 24 * 60 * 60 * 1000);
  return now.getTime() >= fireAt.getTime();
}

function splitList(text: string): string[] {
  return text
    .split(/[\n;,]+|\band\b/gi)
    .map((s) => s.replace(/^[\s\-*•]+/, '').trim())
    .filter((s) => s.length > 1 && s.length <= 120)
    .slice(0, 40);
}
