/**
 * P130. Three outputs the register can produce and a spreadsheet cannot: the
 * privacy-notice sections Arts. 13 and 14 ask for, the search scope of a DSAR, and
 * the blast radius of a breach.
 *
 * All three are the same bet — that the register is already the authoritative
 * statement of what the organisation does with personal data, so the documents that
 * restate it should be *derived* rather than written a second time. That is the
 * connection OneTrust sells as four modules and integrates badly (Part VI), and it
 * is the only one of these three functions that needed a new idea rather than a new
 * query.
 *
 * Pure, and deliberately so: each of these produces text a controller publishes or
 * hands to a regulator, and a fixture is the only thing that can tell a correct
 * Art. 13 section from a plausible one.
 */

import { isAdequateDestination, conditionMetByMechanism, EU_EEA_COUNTRIES } from '../constants/transferDestinations.js';
import { htmlToText } from './htmlText.js';
import { normaliseTransferMechanism } from '../constants/ropaVocabularies.js';
import { retentionAnswer, formatTrigger, type ScheduleInput } from './retention.js';

// ---------------------------------------------------------------------------
// Shared input shapes. Structural, so the callers can pass Drizzle rows without
// this module importing `db`.
// ---------------------------------------------------------------------------

export type NoticeActivity = {
  id: string;
  name?: string | null;
  purpose?: string | null;
  role?: string | null;
  lawfulBasis?: string | null;
  lawfulBasisDetail?: string | null;
  retentionPeriod?: string | null;
  retentionJustification?: string | null;
  involvesAutomatedDecisionMaking?: boolean | null;
  admLogic?: string | null;
  admSignificance?: string | null;
  admHumanIntervention?: string | null;
  status?: string | null;
  retentionSchedule?: ScheduleInput | null;
};

export type NoticeBundle = {
  activity: NoticeActivity;
  dataSubjects: { category?: string | null; isChild?: boolean | null }[];
  dataCategories: {
    category?: string | null;
    source?: string | null;
    isSpecialCategory?: boolean | null;
    retentionPeriod?: string | null;
    retentionSchedule?: ScheduleInput | null;
  }[];
  recipients: { name?: string | null; recipientCategory?: string | null; role?: string | null }[];
  transfers: {
    destinationCountry?: string | null;
    destinationEntity?: string | null;
    transferMechanism?: string | null;
  }[];
};

// ---------------------------------------------------------------------------
// P130 (a) — privacy-notice sections
// ---------------------------------------------------------------------------

export type NoticeSection = {
  /** Stable key. The web maps it to a heading; never rendered raw. */
  id: string;
  article: string;
  heading: string;
  /** Paragraphs, in order. English — a notice is content, not chrome (see J93). */
  paragraphs: string[];
  /** Bulleted items where the Article asks for a list. */
  items?: string[];
  /**
   * What the register could not answer. A notice generator that quietly omits the
   * paragraph it has no data for produces a notice with an Art. 13 hole in it and
   * no way for the drafter to know — which is worse than a gap it declares.
   */
  gaps: string[];
};

export type NoticeDraft = {
  sections: NoticeSection[];
  /** Activities the draft was built from, so the reader can see its scope. */
  sourceActivityIds: string[];
  /** Every gap, flattened, for the banner above the draft. */
  gaps: { section: string; message: string }[];
};

/**
 * Arts. 13 and 14, section by section, over every activity a notice covers.
 *
 * Written from the whole set rather than one activity at a time, because a privacy
 * notice is a document about an organisation and a register is a set of records
 * about processes: the notice's "categories of recipient" section is the union of
 * every activity's, deduplicated, and rendering one section per activity would
 * produce something no one would publish.
 *
 * Art. 14 is the one that needs the register most. 14(1)(d) — the categories of
 * data concerned — and 14(2)(f) — the source — are precisely the two fields nobody
 * fills in by hand, and Sprint 1 made both recordable.
 */
export function buildNoticeSections(bundles: NoticeBundle[]): NoticeDraft {
  const sections: NoticeSection[] = [];
  const live = bundles.filter((b) => b.activity.status !== 'archived');

  // ---- Art. 13(1)(c) / 14(1)(c): purposes and lawful bases ---------------
  const purposeItems: string[] = [];
  const purposeGaps: string[] = [];
  for (const b of live) {
    const name = b.activity.name ?? 'Unnamed activity';
    const purpose = (b.activity.purpose ?? '').trim();
    const basis = basisPhrase(b.activity.lawfulBasis);
    if (!purpose) { purposeGaps.push(`"${name}" has no purpose recorded.`); continue; }
    if (!basis) { purposeGaps.push(`"${name}" has no lawful basis recorded.`); }
    purposeItems.push(basis ? `${purpose} — ${basis}.` : purpose);
  }
  sections.push({
    id: 'purposes',
    article: 'Art. 13(1)(c) / 14(1)(c)',
    heading: 'Why we process your personal data, and on what legal basis',
    paragraphs: ['We process personal data for the purposes set out below. Each purpose relies on the legal basis stated beside it.'],
    items: dedupe(purposeItems),
    gaps: purposeGaps,
  });

  // ---- Art. 13(1)(c) second limb / 14(1)(d): the data ---------------------
  const categories = dedupe(live.flatMap((b) => b.dataCategories.map((c) => (c.category ?? '').trim()).filter(Boolean)));
  const special = dedupe(live.flatMap((b) => b.dataCategories.filter((c) => c.isSpecialCategory).map((c) => (c.category ?? '').trim()).filter(Boolean)));
  sections.push({
    id: 'categories',
    article: 'Art. 14(1)(d)',
    heading: 'What personal data we process',
    paragraphs: special.length > 0
      ? ['We process the categories of personal data listed below. Some of these are special categories of personal data under Article 9, and we only process them where one of the Article 9(2) conditions applies.']
      : ['We process the categories of personal data listed below.'],
    items: categories,
    gaps: categories.length === 0 ? ['No data categories are recorded on any activity in scope.'] : [],
  });

  // ---- Art. 14(2)(f): where it came from ---------------------------------
  const sources = dedupe(live.flatMap((b) => b.dataCategories.map((c) => (c.source ?? '').trim()).filter(Boolean)));
  const missingSources = live.reduce((n, b) => n + b.dataCategories.filter((c) => !(c.source ?? '').trim()).length, 0);
  sections.push({
    id: 'sources',
    article: 'Art. 14(2)(f)',
    heading: 'Where we obtained your personal data',
    paragraphs: ['Where we did not collect your personal data from you directly, we obtained it from the sources below.'],
    items: sources,
    // The count matters more than the fact. "Some sources are missing" is not
    // actionable; "eleven of forty categories have no source" sends someone to the
    // Data tab with a number.
    gaps: missingSources > 0 ? [`${missingSources} data categor${missingSources === 1 ? 'y has' : 'ies have'} no recorded source, so this section is incomplete.`] : [],
  });

  // ---- Art. 13(1)(e) / 14(1)(e): recipients ------------------------------
  const recipientItems = dedupe(live.flatMap((b) => b.recipients.map((r) => {
    const name = (r.name ?? '').trim();
    const role = roleNoun(r.role);
    return role ? `${name} (${role})` : name;
  }).filter(Boolean)));
  sections.push({
    id: 'recipients',
    article: 'Art. 13(1)(e) / 14(1)(e)',
    heading: 'Who we share your personal data with',
    paragraphs: recipientItems.length > 0
      ? ['We disclose personal data to the recipients or categories of recipient below.']
      : ['We do not disclose personal data covered by this notice to any recipient outside our organisation.'],
    items: recipientItems,
    gaps: [],
  });

  // ---- Art. 13(1)(f) / 14(1)(f): transfers -------------------------------
  const transferItems: string[] = [];
  const transferGaps: string[] = [];
  for (const b of live) {
    for (const t of b.transfers) {
      const country = (t.destinationCountry ?? '').toUpperCase();
      if (!country) continue;
      const mechanism = normaliseTransferMechanism(t.transferMechanism);
      // VD-23. A privacy notice that calls a US transfer adequate without the
      // importer holding a current DPF certification is an Art. 13(1)(f)
      // misstatement, not a formatting choice.
      const adequate = isAdequateDestination(country, {
        conditionMet: conditionMetByMechanism(country, [t.transferMechanism, mechanism]),
      }) || EU_EEA_COUNTRIES.includes(country);
      if (!mechanism || mechanism === 'pending_assessment') {
        // Art. 13(1)(f) requires the safeguard *and* how to obtain a copy of it. A
        // notice that names a transfer with no mechanism publishes a Chapter V gap.
        transferGaps.push(`The transfer to ${country} has no Chapter V mechanism recorded, so it cannot be described here.`);
        continue;
      }
      transferItems.push(
        adequate
          ? `${country}, which the European Commission has found to provide an adequate level of protection.`
          : `${country}, under ${mechanismPhrase(mechanism)}.`,
      );
    }
  }
  sections.push({
    id: 'transfers',
    article: 'Art. 13(1)(f) / 14(1)(f)',
    heading: 'Transfers of your personal data outside the EEA',
    paragraphs: transferItems.length > 0
      ? ['We transfer personal data to the countries below. You may obtain a copy of the safeguards we rely on by contacting us.']
      : ['We do not transfer personal data covered by this notice to any country outside the EEA.'],
    items: dedupe(transferItems),
    gaps: transferGaps,
  });

  // ---- Art. 13(2)(a) / 14(2)(a): retention -------------------------------
  const retentionItems: string[] = [];
  const retentionGaps: string[] = [];
  for (const b of live) {
    const name = b.activity.name ?? 'Unnamed activity';
    const answer = retentionAnswer({ schedule: b.activity.retentionSchedule, freeText: b.activity.retentionPeriod });
    if (answer.source === 'none') { retentionGaps.push(`"${name}" has no retention period recorded.`); continue; }
    const trigger = formatTrigger(answer.trigger);
    retentionItems.push(trigger ? `${name}: ${answer.label} ${trigger}.` : `${name}: ${answer.label}.`);
  }
  sections.push({
    id: 'retention',
    article: 'Art. 13(2)(a) / 14(2)(a)',
    heading: 'How long we keep your personal data',
    paragraphs: ['We keep personal data for the periods below, or for as long as the criteria stated require.'],
    items: retentionItems,
    gaps: retentionGaps,
  });

  // ---- Art. 13(2)(f) / 14(2)(g): automated decision-making ---------------
  const admActivities = live.filter((b) => b.activity.involvesAutomatedDecisionMaking);
  const admParagraphs: string[] = [];
  const admGaps: string[] = [];
  for (const b of admActivities) {
    const name = b.activity.name ?? 'Unnamed activity';
    const { admLogic, admSignificance, admHumanIntervention } = b.activity;
    if (!admLogic || !admSignificance) {
      admGaps.push(`"${name}" is recorded as involving automated decision-making, but the logic or the envisaged consequences are not described.`);
    }
    admParagraphs.push([
      `In connection with ${name}, we make decisions about you by automated means.`,
      admLogic ? `The logic involved is: ${admLogic}` : null,
      admSignificance ? `The significance and envisaged consequences are: ${admSignificance}` : null,
      admHumanIntervention ? `You may ask for human intervention: ${admHumanIntervention}` : null,
    ].filter(Boolean).join(' '));
  }
  if (admActivities.length > 0) {
    sections.push({
      id: 'automated_decisions',
      article: 'Art. 13(2)(f) / 14(2)(g) / Art. 22',
      heading: 'Automated decision-making',
      paragraphs: admParagraphs,
      gaps: admGaps,
    });
  }

  const gaps = sections.flatMap((s) => s.gaps.map((message) => ({ section: s.id, message })));
  return { sections, sourceActivityIds: live.map((b) => b.activity.id), gaps };
}

/**
 * P130. What the draft says that the published notice does not, and the reverse.
 *
 * Deliberately a *containment* check rather than a text diff. The published notice
 * is prose a lawyer wrote and the draft is generated from fields; an aligned
 * line-by-line diff between them would report that every line changed, which is a
 * diff nobody can act on. What a drafter actually needs is the shorter question —
 * is each recipient, country and category the register knows about mentioned
 * anywhere in the published text — and that is answerable.
 */
export function diffAgainstPublished(draft: NoticeDraft, publishedText: string): {
  missingFromNotice: { section: string; item: string }[];
  sectionsWithNoCoverage: string[];
} {
  const haystack = normaliseForSearch(publishedText);
  const missing: { section: string; item: string }[] = [];
  const sectionsWithNoCoverage: string[] = [];

  for (const section of draft.sections) {
    const items = section.items ?? [];
    if (items.length === 0) continue;
    let found = 0;
    for (const item of items) {
      // The leading noun before the first punctuation is the searchable part — the
      // rest is the sentence the generator wrapped it in, which the published text
      // has no reason to match word for word.
      const needle = normaliseForSearch(item.split(/[—(:.,]/)[0] ?? item);
      if (needle.length < 3) continue;
      if (haystack.includes(needle)) found += 1;
      else missing.push({ section: section.id, item });
    }
    if (found === 0) sectionsWithNoCoverage.push(section.id);
  }

  return { missingFromNotice: missing, sectionsWithNoCoverage };
}

// ---------------------------------------------------------------------------
// P130 (b) — DSAR search scope
// ---------------------------------------------------------------------------

export type DsarScopeEntry = {
  activityId: string;
  activityName: string;
  /** Why this activity is in scope — the subject category that matched. */
  matchedSubjectCategories: string[];
  dataCategories: string[];
  specialCategories: string[];
  /** Where to look: the recorded sources plus every recipient holding a copy. */
  systems: string[];
  processors: { name: string; role: string | null }[];
  /** Art. 15(1)(c): third countries the data reached, which the response has to disclose. */
  thirdCountries: string[];
  retention: string;
  /** Art. 15(1)(h). */
  automatedDecisionMaking: boolean;
};

export type DsarScope = {
  entries: DsarScopeEntry[];
  /** Deduplicated across every entry — the checklist a DSAR handler works. */
  systems: string[];
  processors: string[];
  thirdCountries: string[];
  specialCategories: string[];
  /** Activities excluded because their subject categories do not match. */
  excludedCount: number;
  /** Stated rather than assumed: an empty match is usually an unpopulated register. */
  notes: string[];
};

/**
 * Which activities a DSAR has to be searched across, given who the requester is.
 *
 * The subject category is the join, and it is the reason this is worth doing at
 * all: an employee's access request does not need the marketing register searched,
 * and the difference between "search everything" and "search these nine" is the
 * difference between a DSAR that completes inside the Art. 12(3) month and one
 * that does not.
 *
 * Matching is deliberately generous — a request from an "employee" matches
 * "Employees", "Former employees" and "Job applicants (employment)" — because the
 * cost of a false positive is a handler reading one more record, and the cost of a
 * false negative is an incomplete Art. 15 response.
 */
export function buildDsarScope(
  bundles: NoticeBundle[],
  subjectCategories: string[],
): DsarScope {
  const wanted = subjectCategories.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const entries: DsarScopeEntry[] = [];
  let excluded = 0;

  for (const b of bundles) {
    if (b.activity.status === 'archived') continue;
    const present = b.dataSubjects.map((s) => (s.category ?? '').trim()).filter(Boolean);
    const matched = wanted.length === 0
      ? present
      : present.filter((c) => wanted.some((w) => c.toLowerCase().includes(w) || w.includes(c.toLowerCase())));

    if (wanted.length > 0 && matched.length === 0) { excluded += 1; continue; }

    const answer = retentionAnswer({ schedule: b.activity.retentionSchedule, freeText: b.activity.retentionPeriod });
    entries.push({
      activityId: b.activity.id,
      activityName: b.activity.name ?? 'Unnamed activity',
      matchedSubjectCategories: matched,
      dataCategories: dedupe(b.dataCategories.map((c) => (c.category ?? '').trim()).filter(Boolean)),
      specialCategories: dedupe(b.dataCategories.filter((c) => c.isSpecialCategory).map((c) => (c.category ?? '').trim()).filter(Boolean)),
      systems: dedupe(b.dataCategories.map((c) => (c.source ?? '').trim()).filter(Boolean)),
      processors: b.recipients
        .filter((r) => r.role === 'processor' || r.role === 'sub_processor')
        .map((r) => ({ name: (r.name ?? '').trim(), role: r.role ?? null }))
        .filter((r) => r.name),
      thirdCountries: dedupe(b.transfers
        .map((t) => (t.destinationCountry ?? '').toUpperCase())
        .filter((c) => c && !EU_EEA_COUNTRIES.includes(c))),
      retention: answer.label,
      automatedDecisionMaking: !!b.activity.involvesAutomatedDecisionMaking,
    });
  }

  const notes: string[] = [];
  if (entries.length === 0) {
    notes.push(wanted.length > 0
      ? 'No activity in the register records this category of data subject. Either the requester falls outside the register, or the subject categories are incomplete.'
      : 'The register holds no activities to search.');
  }
  const noSystems = entries.filter((e) => e.systems.length === 0).length;
  if (noSystems > 0) {
    notes.push(`${noSystems} of ${entries.length} activities in scope record no source system, so the search location has to be established by hand.`);
  }

  return {
    entries,
    systems: dedupe(entries.flatMap((e) => e.systems)),
    processors: dedupe(entries.flatMap((e) => e.processors.map((p) => p.name))),
    thirdCountries: dedupe(entries.flatMap((e) => e.thirdCountries)),
    specialCategories: dedupe(entries.flatMap((e) => e.specialCategories)),
    excludedCount: excluded,
    notes,
  };
}

// ---------------------------------------------------------------------------
// P130 (c) — breach blast radius
// ---------------------------------------------------------------------------

export type BlastRadius = {
  activityIds: string[];
  dataCategories: string[];
  specialCategories: string[];
  criminalData: boolean;
  subjectCategories: string[];
  involvesChildren: boolean;
  involvesVulnerable: boolean;
  /** The widest volume band across the affected subject categories. */
  volumeBand: string | null;
  estimatedSubjects: { min: number; max: number | null } | null;
  processors: string[];
  thirdCountries: string[];
  /** Art. 33(1): whether the 72-hour clock is likely to be running. */
  authorityNotificationLikely: boolean;
  /** Art. 34(1): whether the subjects themselves are likely to need telling. */
  subjectNotificationLikely: boolean;
  /** The reasoning behind the two booleans, which is the part a DPO signs off. */
  riskFactors: string[];
  /** A first draft of the Art. 33(3) content, from the register. */
  draftNotification: {
    natureOfBreach: string;
    categoriesAndVolumes: string;
    likelyConsequences: string;
  };
};

/**
 * A blast-radius bundle needs three flags the notice bundle has no use for —
 * whether a subject category is children or vulnerable, and whether a data category
 * is Art. 10 criminal data. Widened here rather than on `NoticeBundle` so a notice
 * caller is not asked for fields the notice never reads.
 */
export type BlastBundle = Omit<NoticeBundle, 'dataSubjects' | 'dataCategories'> & {
  dataSubjects: { category?: string | null; isChild?: boolean | null; isVulnerable?: boolean | null; volumeBand?: string | null }[];
  dataCategories: (NoticeBundle['dataCategories'][number] & { isCriminalData?: boolean | null })[];
};

const VOLUME_BAND_ORDER = ['under_100', '100_999', '1k_10k', '10k_100k', '100k_1m', 'over_1m'];
const VOLUME_BAND_RANGES: Record<string, { min: number; max: number | null }> = {
  under_100: { min: 1, max: 99 },
  '100_999': { min: 100, max: 999 },
  '1k_10k': { min: 1000, max: 10000 },
  '10k_100k': { min: 10000, max: 100000 },
  '100k_1m': { min: 100000, max: 1000000 },
  over_1m: { min: 1000000, max: null },
};

/**
 * What a breach touches, computed from the activities it affected.
 *
 * The register already knows what each activity holds, whose data it is, how many
 * of them there are, who else has a copy and which countries it reached — which is
 * most of Art. 33(3) and all of the Art. 34(1) risk assessment. Asking a DPO to
 * retype it under a 72-hour clock is how the notification goes out with the wrong
 * categories on it.
 *
 * The two booleans are stated as *likely*, not as decisions, and that is not
 * hedging. Art. 33(1) turns on a risk assessment the controller makes, and a
 * product that told someone "you do not need to notify" would be making it for
 * them. What it can do is show every factor that points one way or the other.
 */
export function buildBlastRadius(
  bundles: BlastBundle[],
  breach: { breachType?: string | null; description?: string | null; estimatedIndividualsAffected?: number | null } = {},
): BlastRadius {
  const dataCategories = dedupe(bundles.flatMap((b) => b.dataCategories.map((c) => (c.category ?? '').trim()).filter(Boolean)));
  const specialCategories = dedupe(bundles.flatMap((b) => b.dataCategories.filter((c) => c.isSpecialCategory).map((c) => (c.category ?? '').trim()).filter(Boolean)));
  const criminalData = bundles.some((b) => b.dataCategories.some((c) => c.isCriminalData));
  const subjectCategories = dedupe(bundles.flatMap((b) => b.dataSubjects.map((s) => (s.category ?? '').trim()).filter(Boolean)));
  const involvesChildren = bundles.some((b) => b.dataSubjects.some((s) => s.isChild));
  const involvesVulnerable = bundles.some((b) => b.dataSubjects.some((s) => s.isVulnerable));

  const bands = bundles.flatMap((b) => b.dataSubjects.map((s) => s.volumeBand ?? '').filter(Boolean));
  const volumeBand = bands.length === 0
    ? null
    : bands.reduce((widest, band) =>
      VOLUME_BAND_ORDER.indexOf(band) > VOLUME_BAND_ORDER.indexOf(widest) ? band : widest, bands[0]!);

  const processors = dedupe(bundles.flatMap((b) => b.recipients
    .filter((r) => r.role === 'processor' || r.role === 'sub_processor')
    .map((r) => (r.name ?? '').trim())
    .filter(Boolean)));
  const thirdCountries = dedupe(bundles.flatMap((b) => b.transfers
    .map((t) => (t.destinationCountry ?? '').toUpperCase())
    .filter((c) => c && !EU_EEA_COUNTRIES.includes(c))));

  const riskFactors: string[] = [];
  if (specialCategories.length > 0) riskFactors.push(`Special-category data under Art. 9 is affected: ${specialCategories.slice(0, 6).join(', ')}.`);
  if (criminalData) riskFactors.push('Criminal-offence data under Art. 10 is affected.');
  if (involvesChildren) riskFactors.push('Children are among the affected data subjects (Recital 38).');
  if (involvesVulnerable) riskFactors.push('Vulnerable data subjects are affected (Recital 75).');
  if (volumeBand && VOLUME_BAND_ORDER.indexOf(volumeBand) >= VOLUME_BAND_ORDER.indexOf('10k_100k')) {
    riskFactors.push('The affected population is large-scale on the register’s own estimate.');
  }
  if (thirdCountries.length > 0) riskFactors.push(`The affected data reaches ${thirdCountries.join(', ')}, so the recipients of a copy extend beyond the EEA.`);
  if (processors.length > 0) riskFactors.push(`${processors.length} processor${processors.length === 1 ? '' : 's'} hold a copy: ${processors.slice(0, 6).join(', ')}.`);

  // Art. 33(1) sets a low bar deliberately — notify "unless unlikely to result in a
  // risk". Any special category, any child, any large-scale population clears it.
  const authorityNotificationLikely = specialCategories.length > 0 || criminalData || involvesChildren
    || (!!volumeBand && VOLUME_BAND_ORDER.indexOf(volumeBand) >= VOLUME_BAND_ORDER.indexOf('1k_10k'));
  // Art. 34(1) sets a higher one — "high risk" — which the combination of
  // sensitivity *and* scale is the ordinary route to.
  const subjectNotificationLikely = (specialCategories.length > 0 || criminalData || involvesChildren)
    && (!!volumeBand && VOLUME_BAND_ORDER.indexOf(volumeBand) >= VOLUME_BAND_ORDER.indexOf('1k_10k'));

  const range = volumeBand ? VOLUME_BAND_RANGES[volumeBand] ?? null : null;
  const estimated = breach.estimatedIndividualsAffected
    ? { min: breach.estimatedIndividualsAffected, max: breach.estimatedIndividualsAffected }
    : range;

  return {
    activityIds: bundles.map((b) => b.activity.id),
    dataCategories,
    specialCategories,
    criminalData,
    subjectCategories,
    involvesChildren,
    involvesVulnerable,
    volumeBand,
    estimatedSubjects: estimated,
    processors,
    thirdCountries,
    authorityNotificationLikely,
    subjectNotificationLikely,
    riskFactors,
    draftNotification: {
      natureOfBreach: [
        breach.breachType ? `Nature of the breach: ${breach.breachType}.` : null,
        breach.description ?? null,
        `The breach affects ${bundles.length} processing activit${bundles.length === 1 ? 'y' : 'ies'} recorded in our Article 30 register.`,
      ].filter(Boolean).join(' '),
      categoriesAndVolumes: [
        subjectCategories.length > 0 ? `Categories of data subject affected: ${subjectCategories.join(', ')}.` : 'The categories of data subject affected have not been recorded on the affected activities.',
        dataCategories.length > 0 ? `Categories of personal data affected: ${dataCategories.join(', ')}.` : 'The categories of personal data affected have not been recorded on the affected activities.',
        estimated
          ? `Approximate number of data subjects concerned: ${estimated.max ? `${estimated.min}–${estimated.max}` : `over ${estimated.min}`}.`
          : 'The approximate number of data subjects concerned has not been established.',
      ].join(' '),
      likelyConsequences: riskFactors.length > 0
        ? riskFactors.join(' ')
        : 'On the register’s own record of this processing, no special-category data, children or large-scale population is involved. The likely consequences still have to be assessed against the circumstances of the incident.',
    },
  };
}

// ---------------------------------------------------------------------------

function dedupe(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.set(key, v.trim());
  }
  return [...seen.values()];
}

function normaliseForSearch(text: string): string {
  // Through the shared stripper: this one used to leave script and style bodies
  // behind, so a page's inlined JSON counted as searchable prose.
  return htmlToText(text).toLowerCase();
}

function basisPhrase(basis?: string | null): string | null {
  switch (basis) {
    case 'consent': return 'we rely on your consent (Article 6(1)(a))';
    case 'contract': return 'processing is necessary to perform a contract with you (Article 6(1)(b))';
    case 'legal_obligation': return 'processing is necessary to comply with a legal obligation (Article 6(1)(c))';
    case 'vital_interests': return 'processing is necessary to protect vital interests (Article 6(1)(d))';
    case 'public_task': return 'processing is necessary for a task in the public interest (Article 6(1)(e))';
    case 'legitimate_interest':
    case 'legitimate_interests': return 'we rely on our legitimate interests (Article 6(1)(f))';
    default: return null;
  }
}

function roleNoun(role?: string | null): string | null {
  switch (role) {
    case 'processor': return 'processor';
    case 'sub_processor': return 'sub-processor';
    case 'joint_controller': return 'joint controller';
    case 'independent_controller': return 'independent controller';
    default: return null;
  }
}

function mechanismPhrase(mechanism: string): string {
  switch (mechanism) {
    case 'scc': return 'the European Commission’s standard contractual clauses';
    case 'bcr': return 'binding corporate rules approved under Article 47';
    case 'dpf': return 'the EU–US Data Privacy Framework';
    case 'adequacy_decision': return 'an adequacy decision of the European Commission';
    case 'art49_derogation': return 'a derogation under Article 49';
    case 'codes_of_conduct': return 'an approved code of conduct under Article 40';
    case 'certification': return 'an approved certification mechanism under Article 42';
    default: return 'the safeguards recorded in our register';
  }
}
