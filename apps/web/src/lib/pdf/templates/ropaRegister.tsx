import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  Bullets,
  ContentPage,
  Cover,
  DataTable,
  KeyValue,
  Report,
  Section,
  formatDate,
  styles,
  titleCase,
} from '../theme';

/**
 * J93. The canonical Article 30 record — the module's only Article 30 document.
 *
 * There used to be two, and neither was complete. `ropaRecord.tsx` rendered nine
 * columns for `export.generatePdf`; this file rendered eight for the audit pack.
 * Both read the field set the module had in Sprint 0, so everything Sprints 1 and
 * 2 added — Art. 9(2) conditions, Art. 10 bases, per-category retention,
 * mechanism-specific transfer evidence, recipient roles, Art. 22 fields, owners,
 * review state — appeared in neither. `ropaRecord.tsx` is gone and this is what
 * both callers render.
 *
 * The payload is built server-side by `lib/ropaArticle30.ts`, which is what makes
 * the PDF, the workbook, the CSV, the JSON and the four regulator packs agree
 * with each other. Nothing is derived here beyond formatting.
 *
 * ## Negative assertions
 *
 * A blank transfers column does not say "no transfers". It says nothing, and a
 * supervisory authority reading it cannot tell an organisation with none from one
 * that has not filled the column in — which are opposite findings. Every record
 * therefore prints what it asserts it does *not* do, and so does the register as
 * a whole. That is the single biggest difference between this document and the two
 * it replaces.
 */

type WireDate = string | null;

interface Party {
  name: string;
  legalName: string | null;
  address: string | null;
  countryCode: string | null;
  contactEmail: string | null;
  representative: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
}

interface Transfer {
  destinationCountry: string;
  destinationEntity: string | null;
  isAdequate: boolean;
  mechanism: string;
  mechanismDetail: string | null;
  safeguardEvidence: string;
  tiaCompleted: boolean;
  tiaRiskLevel: string | null;
}

interface Activity {
  id: string;
  reference: string;
  name: string;
  role: string;
  status: string;
  purpose: string;
  description: string | null;
  lawfulBasis: string;
  lawfulBasisDetail: string | null;
  liaStatus: string | null;
  liaOutcome: string | null;
  dataSubjectCategories: Array<{ category: string; volumeBand: string | null; isChild: boolean; isVulnerable: boolean }>;
  dataCategories: Array<{
    category: string;
    group: string;
    isSpecialCategory: boolean;
    specialCategoryType: string | null;
    article9Condition: string | null;
    article9NationalLawBasis: string | null;
    isCriminalData: boolean;
    article10Basis: string | null;
    identifiability: string | null;
    source: string | null;
    retentionPeriod: string | null;
    retentionTrigger: string | null;
  }>;
  recipients: Array<{ name: string; category: string | null; role: string | null; purpose: string | null }>;
  transfers: Transfer[];
  retentionPeriod: string | null;
  retentionJustification: string | null;
  deletionProcedure: string | null;
  securityMeasures: string[];
  securityMeasuresDetail: string | null;
  automatedDecisionMaking: boolean;
  profiling: boolean;
  admLogic: string | null;
  admSignificance: string | null;
  admHumanIntervention: string | null;
  riskLevel: string | null;
  requiresDpia: boolean;
  dpiaTitle: string | null;
  dpiaStatus: string | null;
  businessOwner: string | null;
  privacyOwner: string | null;
  lastReviewedAt: WireDate;
  nextReviewAt: WireDate;
  approvalState: string | null;
  completenessScore: number;
  assertions: string[];
}

export interface RopaRegisterData {
  generatedAt: WireDate;
  controller: Party;
  controllerActivities: Activity[];
  processorSections: Array<{
    controller: Party;
    processingCategories: string[];
    activities: Activity[];
  }>;
  assertions: string[];
  counts: {
    controller: number;
    processor: number;
    withTransfers: number;
    withSpecialCategories: number;
    total: number;
  };
  filterSummary: string | null;
  /** Passed through by the audit pack; the cover uses it where present. */
  orgName?: string;
  logoUrl?: string;
}

/**
 * How many per-activity detail pages this document will render.
 *
 * The summary tables cover every record and are cheap; the detail pages are one
 * page each, and the route that renders this has a 60-second ceiling
 * (`maxDuration` in api/internal/pdf/[doc]/route.ts). A four-hundred-activity
 * register would exceed it and the export would fail outright.
 *
 * The cap is *stated on the document* rather than applied quietly. A regulator
 * reading a record has no way to know that pages are missing, and a silently
 * truncated Article 30 record is precisely the failure this template exists to
 * remove — so the summary still lists every activity, the note says how many
 * detail pages were rendered, and it points at the workbook, which has no limit.
 */
const DETAIL_PAGE_LIMIT = 60;

const dash = (value: string | null | undefined) => (value && value.trim() ? value : '—');

const subjectsCell = (a: Activity) =>
  a.dataSubjectCategories.length === 0
    ? 'Not recorded'
    : a.dataSubjectCategories
        .map((s) => `${s.category}${s.volumeBand ? ` (${titleCase(s.volumeBand)})` : ''}`)
        .join(', ');

const categoriesCell = (a: Activity) =>
  a.dataCategories.length === 0 ? 'Not recorded' : a.dataCategories.map((c) => c.category).join(', ');

const recipientsCell = (a: Activity) =>
  a.recipients.length === 0
    ? 'None'
    : a.recipients.map((r) => `${r.name}${r.role ? ` (${titleCase(r.role)})` : ''}`).join(', ');

const transfersCell = (a: Activity) =>
  a.transfers.length === 0
    ? 'None'
    : a.transfers
        .map((t) =>
          t.isAdequate
            ? `${t.destinationCountry} — adequate destination`
            : `${t.destinationCountry} — ${titleCase(t.mechanism)}`,
        )
        .join('; ');

/** Art. 30(1)(f) is per category where the register records it that way. */
const retentionCell = (a: Activity) => {
  const perCategory = a.dataCategories
    .filter((c) => c.retentionPeriod)
    .map((c) => `${c.category}: ${c.retentionPeriod}`);
  if (perCategory.length > 0) return perCategory.join('; ');
  return dash(a.retentionPeriod);
};

const specialCategoryLines = (a: Activity) =>
  a.dataCategories
    .filter((c) => c.isSpecialCategory || c.isCriminalData)
    .map((c) =>
      c.isCriminalData
        ? `${c.category} — Article 10${c.article10Basis ? `: ${c.article10Basis}` : ': no basis recorded'}`
        : `${c.category} — Article 9(2)${c.article9Condition ? `(${c.article9Condition})` : ': no condition recorded'}${
            c.article9NationalLawBasis ? `, ${c.article9NationalLawBasis}` : ''
          }`,
    );

/**
 * One activity in full.
 *
 * A page per record rather than a row in a wide table: the register table on the
 * summary page is what a reader scans, and this is what they read when they stop
 * scanning. Everything Art. 30 asks for is here, including the parts that only
 * matter when they are absent.
 */
const ActivityDetail: React.FC<{ activity: Activity; header: string; num: string; processor?: boolean }> = ({
  activity: a,
  header,
  num,
  processor,
}) => (
  <ContentPage headerLabel={header}>
    <Section num={num} title={a.name} description={`${a.reference} · ${titleCase(a.role)} · ${titleCase(a.status)}`}>
      <KeyValue
        rows={[
          { label: processor ? 'Categories of processing (30(2)(b))' : 'Purpose (30(1)(b))', value: a.purpose },
          ...(a.description ? [{ label: 'Description', value: a.description }] : []),
          {
            label: 'Lawful basis (Art. 6)',
            value: `${titleCase(a.lawfulBasis)}${a.lawfulBasisDetail ? ` — ${a.lawfulBasisDetail}` : ''}${
              a.lawfulBasis === 'legitimate_interests'
                ? a.liaOutcome
                  ? ` · LIA: ${titleCase(a.liaOutcome)} (${titleCase(a.liaStatus)})`
                  : ' · LIA: none recorded'
                : ''
            }`,
          },
          { label: 'Categories of data subject (30(1)(c))', value: subjectsCell(a) },
          { label: 'Categories of personal data (30(1)(c))', value: categoriesCell(a) },
          {
            label: 'Special category and criminal data',
            value:
              specialCategoryLines(a).length > 0
                ? specialCategoryLines(a).join('\n')
                : 'None. This activity involves neither Article 9(1) nor Article 10 data.',
          },
          { label: 'Recipients (30(1)(d))', value: recipientsCell(a) },
          {
            label: 'Third-country transfers (30(1)(e))',
            value:
              a.transfers.length === 0
                ? 'None. No personal data under this activity leaves the EEA.'
                : a.transfers
                    .map(
                      (t) =>
                        `${t.destinationCountry}${t.destinationEntity ? ` · ${t.destinationEntity}` : ''} — ${titleCase(
                          t.mechanism,
                        )}\n${t.safeguardEvidence}${t.tiaCompleted ? `\nTransfer impact assessment completed${t.tiaRiskLevel ? ` (residual risk: ${titleCase(t.tiaRiskLevel)})` : ''}.` : '\nNo transfer impact assessment recorded.'}`,
                    )
                    .join('\n\n'),
          },
          {
            label: 'Retention (30(1)(f))',
            value: `${retentionCell(a)}${a.retentionJustification ? `\n${a.retentionJustification}` : ''}${
              a.deletionProcedure ? `\nDeletion: ${a.deletionProcedure}` : ''
            }`,
          },
          {
            label: 'Security measures (30(1)(g))',
            value:
              a.securityMeasures.length > 0
                ? `${a.securityMeasures.map(titleCase).join(', ')}${a.securityMeasuresDetail ? `\n${a.securityMeasuresDetail}` : ''}`
                : 'Not recorded.',
          },
          {
            label: 'Automated decision-making (Art. 22)',
            value: a.automatedDecisionMaking
              ? [
                  `Yes${a.profiling ? ', including profiling' : ''}.`,
                  a.admLogic ? `Logic: ${a.admLogic}` : 'Logic not recorded.',
                  a.admSignificance ? `Significance: ${a.admSignificance}` : 'Significance not recorded.',
                  a.admHumanIntervention ? `Human intervention: ${a.admHumanIntervention}` : 'Human intervention not recorded.',
                ].join('\n')
              : 'No. This activity involves no automated decision-making producing legal or similarly significant effects.',
          },
          {
            label: 'Data protection impact assessment',
            value: a.requiresDpia
              ? a.dpiaTitle
                ? `Required. ${a.dpiaTitle}${a.dpiaStatus ? ` (${titleCase(a.dpiaStatus)})` : ''}`
                : 'Required. No assessment recorded.'
              : 'Not required.',
          },
          {
            label: 'Accountability',
            value: [
              `Risk level: ${titleCase(a.riskLevel) || 'not recorded'}`,
              `Business owner: ${dash(a.businessOwner)}`,
              `Privacy owner: ${dash(a.privacyOwner)}`,
              `Last reviewed: ${a.lastReviewedAt ? formatDate(a.lastReviewedAt) : 'never'}`,
              `Next review: ${a.nextReviewAt ? formatDate(a.nextReviewAt) : 'not scheduled'}`,
              `Approval: ${titleCase(a.approvalState) || 'not recorded'}`,
              `Completeness: ${a.completenessScore}%`,
            ].join('\n'),
          },
        ]}
      />
    </Section>
  </ContentPage>
);

export const RopaRegister: React.FC<{ data: RopaRegisterData }> = ({ data }) => {
  const controllerName = data.controller?.legalName || data.controller?.name || data.orgName || 'Organisation';
  const header = `Article 30 Record · ${controllerName}`;
  const controllerActivities = data.controllerActivities || [];
  const processorSections = data.processorSections || [];
  const allActivities = [...controllerActivities, ...processorSections.flatMap((s) => s.activities)];

  // Section numbering runs across the whole document, so a cross-reference in a
  // covering letter ("see section 07") still points at the same record after a
  // reprint. Detail pages are numbered from where the summary sections stop.
  let section = 3 + processorSections.length;

  return (
    <Report>
      <Cover
        eyebrow="Article 30 GDPR · Confidential"
        title="Record of Processing Activities"
        meta={[
          { label: 'Controller', value: controllerName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Controller records', value: String(data.counts?.controller ?? controllerActivities.length) },
          { label: 'Processor records', value: String(data.counts?.processor ?? 0) },
        ]}
        note={
          data.filterSummary
            ? `Maintained under Article 30 of Regulation (EU) 2016/679. This document is a filtered extract of the register and does not cover every activity it holds. Scope: ${data.filterSummary}`
            : 'Maintained under Article 30 of Regulation (EU) 2016/679 and made available to the supervisory authority on request. Section 02 records processing carried out as controller; section 03 onwards record processing carried out on behalf of each controller as processor.'
        }
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Controller identity" description="Article 30(1)(a).">
          <KeyValue
            rows={[
              { label: 'Controller', value: controllerName },
              { label: 'Trading name', value: dash(data.controller?.name) },
              { label: 'Country of establishment', value: dash(data.controller?.countryCode) },
              { label: 'Address', value: dash(data.controller?.address) },
              { label: 'Contact', value: dash(data.controller?.contactEmail) },
              {
                label: 'Representative (Art. 27)',
                value: data.controller?.representative || 'None designated.',
              },
              {
                label: 'Data protection officer (Art. 37)',
                value: data.controller?.dpoName
                  ? `${data.controller.dpoName}${data.controller.dpoEmail ? ` — ${data.controller.dpoEmail}` : ''}`
                  : 'None designated.',
              },
            ]}
          />

          {(data.assertions || []).length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionDesc}>Statements made by this register</Text>
              <Bullets items={data.assertions} />
            </View>
          ) : null}
        </Section>

        <Section
          num="02"
          title="Controller record"
          description="Article 30(1) — processing carried out by the controller in its own right."
        >
          <DataTable
            columns={[
              { header: 'Ref', width: 0.7 },
              { header: 'Activity', width: 1.6 },
              { header: 'Purpose', width: 1.8 },
              { header: 'Lawful basis', width: 1.1 },
              { header: 'Data subjects', width: 1.3 },
              { header: 'Data categories', width: 1.5 },
              { header: 'Recipients', width: 1.3 },
              { header: 'Transfers', width: 1.4 },
              { header: 'Retention', width: 1.1 },
            ]}
            rows={controllerActivities.map((a) => [
              a.reference,
              <Text style={styles.cellStrong}>{a.name}</Text>,
              a.purpose || '—',
              titleCase(a.lawfulBasis),
              subjectsCell(a),
              categoriesCell(a),
              recipientsCell(a),
              transfersCell(a),
              retentionCell(a),
            ])}
            empty="The organisation carries out no processing as controller in its own right."
          />
        </Section>
      </ContentPage>

      {processorSections.map((s, i) => (
        <ContentPage key={`proc-${i}`} headerLabel={header}>
          <Section
            num={String(i + 3).padStart(2, '0')}
            title={`Processor record — ${s.controller.legalName || s.controller.name}`}
            description="Article 30(2) — processing carried out on behalf of this controller."
          >
            <KeyValue
              rows={[
                { label: 'Controller (30(2)(a))', value: s.controller.legalName || s.controller.name },
                { label: 'Contact', value: dash(s.controller.contactEmail) },
                { label: 'Country', value: dash(s.controller.countryCode) },
                { label: 'Address', value: dash(s.controller.address) },
                { label: "Controller's representative", value: s.controller.representative || 'None designated.' },
                {
                  label: "Controller's data protection officer",
                  value: s.controller.dpoName
                    ? `${s.controller.dpoName}${s.controller.dpoEmail ? ` — ${s.controller.dpoEmail}` : ''}`
                    : 'None designated.',
                },
                {
                  label: 'Categories of processing (30(2)(b))',
                  value:
                    s.processingCategories.length > 0
                      ? s.processingCategories.map(titleCase).join(', ')
                      : 'Described per activity below.',
                },
              ]}
            />

            <View style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { header: 'Ref', width: 0.7 },
                  { header: 'Activity', width: 1.8 },
                  { header: 'Categories of processing', width: 2 },
                  { header: 'Data categories', width: 1.8 },
                  { header: 'Transfers (30(2)(c))', width: 1.6 },
                  { header: 'Security (30(2)(d))', width: 1.8 },
                ]}
                rows={s.activities.map((a) => [
                  a.reference,
                  <Text style={styles.cellStrong}>{a.name}</Text>,
                  a.purpose || '—',
                  categoriesCell(a),
                  transfersCell(a),
                  a.securityMeasures.length > 0 ? a.securityMeasures.map(titleCase).join(', ') : 'Not recorded',
                ])}
              />
            </View>
          </Section>
        </ContentPage>
      ))}

      {processorSections.length === 0 ? (
        <ContentPage headerLabel={header}>
          <Section num="03" title="Processor record" description="Article 30(2).">
            <View>
              <Text style={styles.emptyText}>
                The organisation does not carry out processing on behalf of another controller. No record under
                Article 30(2) is required.
              </Text>
            </View>
          </Section>
        </ContentPage>
      ) : null}

      {allActivities.slice(0, DETAIL_PAGE_LIMIT).map((a) => {
        section += 1;
        return (
          <ActivityDetail
            key={a.id}
            activity={a}
            header={header}
            num={String(section).padStart(2, '0')}
            processor={a.role === 'processor'}
          />
        );
      })}

      {allActivities.length > DETAIL_PAGE_LIMIT ? (
        <ContentPage headerLabel={header}>
          <Section
            num={String(section + 1).padStart(2, '0')}
            title="Scope of this document"
            description="What is and is not printed here."
          >
            <View>
              <Text style={styles.emptyText}>
                {`The summary tables above cover all ${allActivities.length} records in scope. Full detail pages are printed for the first ${DETAIL_PAGE_LIMIT}; the remaining ${allActivities.length - DETAIL_PAGE_LIMIT} are included in the register workbook (XLSX), which carries every field for every record without limit. Narrow the register filter and export again to print detail pages for a specific subset.`}
              </Text>
            </View>
          </Section>
        </ContentPage>
      ) : null}

      {allActivities.length > 0 ? (
        <ContentPage headerLabel={header}>
          <Section
            num={String(section + 2).padStart(2, '0')}
            title="Negative assertions"
            description="What each record states it does not do. A blank field is not a statement; these are."
          >
            {allActivities.map((a) => (
              <View key={`assert-${a.id}`} style={{ marginBottom: 10 }}>
                <Text style={styles.cellStrong}>
                  {a.reference} · {a.name}
                </Text>
                <Bullets items={a.assertions} empty="This record makes no negative assertions." />
              </View>
            ))}
          </Section>
        </ContentPage>
      ) : null}
    </Report>
  );
};
