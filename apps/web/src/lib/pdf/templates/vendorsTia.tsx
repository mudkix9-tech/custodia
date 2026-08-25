import React from 'react';
import { Text } from '@react-pdf/renderer';
import {
  Badge,
  ContentPage,
  Cover,
  DataTable,
  DotLabel,
  Report,
  Section,
  StatGrid,
  formatDate,
  palette,
  styles,
  titleCase,
} from '../theme';

type WireDate = string | Date | null;

interface TiaMeasure {
  id?: string;
  label?: string;
  implemented?: boolean;
  detail?: string;
}

export interface VendorsTiaData {
  tia: {
    destinationCountry: string;
    transferMechanism: string;
    dataExporter?: string | null;
    dataImporter?: string | null;
    transferPurpose?: string | null;
    dataSubjectCategories?: string[] | null;
    transferFrequency?: string | null;
    onwardTransfers?: string | null;
    surveillanceLawsExist?: boolean | null;
    independentDpaExists?: boolean | null;
    effectiveRemediesExist?: boolean | null;
    legalAssessmentConclusion?: string | null;
    legalAssessmentDetail?: string | null;
    relevantCaseLaw?: string | null;
    technicalMeasures?: TiaMeasure[] | null;
    organizationalMeasures?: TiaMeasure[] | null;
    contractualMeasures?: TiaMeasure[] | null;
    measuresDetail?: string | null;
    residualRiskLevel?: string | null;
    residualRiskJustification?: string | null;
    conclusion?: string | null;
    conditions?: string | null;
    status: string;
    approvedAt?: WireDate;
    reevaluationIntervalMonths?: number | null;
    reevaluationTriggers?: string | null;
  };
  vendorName: string;
  /** The controller. Half of the transfer being assessed, and it was not on the page. */
  organizationName?: string | null;
  generatedAt: WireDate;
}

/** A tri-state answer prints as a sentence, not as `null` or `false`. */
function TriState({ value }: { value: boolean | null | undefined }) {
  return (
    <Text>
      {value === true ? 'Yes' : value === false ? 'No' : 'Not assessed'}
    </Text>
  );
}

/**
 * Chapter V evidence document for one vendor's transfer impact assessment.
 *
 * EDPB Recommendations 01/2020 has six steps; the document walks them in order
 * so an auditor can check the assessment against the guidance section by
 * section. Step 1 (know your transfer) prints even when empty — a blank exporter
 * line tells the reader the assessment is incomplete, which is true and useful.
 */
export const VendorsTia: React.FC<{ data: VendorsTiaData }> = ({ data }) => {
  const tia = data.tia;
  const header = `Transfer Impact Assessment · ${data.vendorName}`;

  const measuresToRows = (measures?: TiaMeasure[] | null) =>
    (measures ?? [])
      .filter((m) => m && (m.implemented || m.detail))
      .map((m) => [
        <Text style={styles.cellStrong}>{m.label || titleCase(m.id || '')}</Text>,
        <DotLabel label={m.implemented ? 'Implemented' : 'Planned'} color={m.implemented ? palette.good : palette.warn} />,
        m.detail || '—',
      ]);

  return (
    <Report>
      <Cover
        eyebrow="Chapter V · GDPR Articles 44–49"
        title="Transfer Impact Assessment"
        meta={[
          ...(data.organizationName ? [{ label: 'Controller', value: data.organizationName }] : []),
          { label: 'Vendor', value: data.vendorName },
          { label: 'Destination', value: tia.destinationCountry },
          { label: 'Mechanism', value: titleCase(tia.transferMechanism) },
          { label: 'Status', value: tia.status },
          ...(tia.approvedAt ? [{ label: 'Approved', value: formatDate(tia.approvedAt) }] : []),
        ]}
        note={
          tia.status === 'completed'
            ? 'Documented under Article 46, assessing whether safeguards ensure an essentially equivalent level of protection for personal data transferred outside the EEA.'
            : 'DRAFT — this assessment has not been completed or approved. It does not evidence compliance with Chapter V and must not be relied on as a record of the safeguards in place.'
        }
      />

      <ContentPage headerLabel={header}>
        {/* Step 1 — know your transfer */}
        <Section num="01" title="The transfer">
          <DataTable
            columns={[
              { header: 'Field', width: 1.1 },
              { header: 'Detail', width: 2.9 },
            ]}
            rows={[
              [<Text style={styles.cellStrong}>Data exporter</Text>, tia.dataExporter || 'Not recorded'],
              [<Text style={styles.cellStrong}>Data importer</Text>, tia.dataImporter || 'Not recorded'],
              [<Text style={styles.cellStrong}>Purpose</Text>, tia.transferPurpose || 'Not recorded'],
              [<Text style={styles.cellStrong}>Data subject categories</Text>, (tia.dataSubjectCategories ?? []).join(', ') || 'Not recorded'],
              [<Text style={styles.cellStrong}>Frequency</Text>, tia.transferFrequency || 'Not recorded'],
              [<Text style={styles.cellStrong}>Onward transfers</Text>, tia.onwardTransfers || 'None recorded'],
            ]}
            empty="No transfer details recorded."
          />
        </Section>

        {/* Step 2 — the law of the third country */}
        <Section
          num="02"
          title="Legal assessment"
          description="Whether the third country's legal system impedes the effectiveness of the safeguards, per Recommendations 01/2020 §2."
        >
          <DataTable
            columns={[{ header: 'Question', width: 2.4 }, { header: 'Answer', width: 0.6 }]}
            rows={[
              [
                <Text style={styles.cellStrong}>Surveillance laws exist</Text>,
                <TriState value={tia.surveillanceLawsExist} />,
              ],
              [
                <Text style={styles.cellStrong}>Independent supervisory authority</Text>,
                <TriState value={tia.independentDpaExists} />,
              ],
              [
                <Text style={styles.cellStrong}>Effective remedies for data subjects</Text>,
                <TriState value={tia.effectiveRemediesExist} />,
              ],
              [
                <Text style={styles.cellStrong}>Conclusion</Text>,
                titleCase(tia.legalAssessmentConclusion || 'not assessed'),
              ],
            ]}
            empty="No legal assessment recorded."
          />
          {tia.legalAssessmentDetail && (
            <Text style={styles.bodyText}>{tia.legalAssessmentDetail}</Text>
          )}
          {tia.relevantCaseLaw && (
            <Text style={styles.bodyText}>Case law noted: {tia.relevantCaseLaw}</Text>
          )}
        </Section>

        {/* Step 3 — supplementary measures */}
        <Section
          num="03"
          title="Supplementary measures"
          description="Technical, organisational and contractual measures applied to make the safeguard effective in practice."
        >
          <DataTable
            columns={[
              { header: 'Measure', width: 1.3 },
              { header: 'State', width: 0.8 },
              { header: 'Detail', width: 1.9 },
            ]}
            rows={[
              ...measuresToRows(tia.technicalMeasures),
              ...measuresToRows(tia.organizationalMeasures),
              ...measuresToRows(tia.contractualMeasures),
            ]}
            empty="No supplementary measures recorded."
          />
          {tia.measuresDetail && (
            <Text style={styles.bodyText}>{tia.measuresDetail}</Text>
          )}
        </Section>

        {/* Steps 4–6 — residual risk, conclusion, re-evaluation */}
        <Section num="04" title="Residual risk and conclusion">
          <StatGrid
            items={[
              { value: titleCase(tia.residualRiskLevel || 'not assessed'), label: 'Residual risk' },
              { value: titleCase(tia.conclusion || 'pending'), label: 'Conclusion' },
            ]}
          />
          {tia.residualRiskJustification && (
            <Text style={styles.bodyText}>{tia.residualRiskJustification}</Text>
          )}
          {tia.conditions && (
            <Text style={styles.bodyText}>Conditions of transfer: {tia.conditions}</Text>
          )}
          <Text style={styles.bodyText}>
            Re-evaluation interval: {tia.reevaluationIntervalMonths ? `${tia.reevaluationIntervalMonths} months` : 'Not scheduled'}.
            {tia.reevaluationTriggers ? ` Triggers: ${tia.reevaluationTriggers}` : ''}
          </Text>
          <Text style={styles.bodyText}>
            Generated {formatDate(data.generatedAt)} · Custodia · Documented under Art. 30(1)(g).
          </Text>
        </Section>
      </ContentPage>
    </Report>
  );
};
