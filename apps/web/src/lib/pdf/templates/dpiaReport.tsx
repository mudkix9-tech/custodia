import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  Badge,
  ContentPage,
  Cover,
  DataTable,
  KeyValue,
  Report,
  Section,
  formatDate,
  palette,
  severityColor,
  styles,
  titleCase,
} from '../theme';

type WireDate = string | Date | null;

export interface DpiaReportData {
  orgName: string;
  generatedAt: WireDate;
  dpia: {
    title: string;
    description: string | null;
    status: string;
    processingDescription: string | null;
    necessityAssessment: string | null;
    proportionalityAssessment: string | null;
    overallRiskLevel: string | null;
    residualRiskLevel: string | null;
    approvedBy: string | null;
    approvedAt: WireDate;
    risks: Array<{
      description: string;
      likelihood: number | null;
      severity: number | null;
      initialRiskScore: number | null;
      residualRiskScore: number | null;
      measures: Array<{
        description: string;
        status: string;
        implementedAt: WireDate;
      }>;
    }>;
    linkedActivities: string[];
  };
}

/** Article 35(7) scores run 1–25; the bands mirror the risk matrix in the app. */
const riskScoreColor = (score: number | null) => {
  if (score == null) return palette.muted;
  if (score >= 15) return palette.bad;
  if (score >= 8) return palette.warn;
  return palette.good;
};

export const DpiaReport: React.FC<{ data: DpiaReportData }> = ({ data }) => {
  const { dpia } = data;
  const header = `DPIA · ${dpia.title}`;
  const totalMeasures = dpia.risks.reduce((n, r) => n + r.measures.length, 0);

  return (
    <Report>
      <Cover
        eyebrow="Article 35 · Confidential"
        title="Data Protection Impact Assessment"
        meta={[
          { label: 'Assessment', value: dpia.title },
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Status', value: titleCase(dpia.status) },
        ]}
        note="Carried out under Article 35 where processing is likely to result in a high risk to the rights and freedoms of natural persons. Records the necessity and proportionality assessment, the risks identified and the measures adopted to address them."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Assessment overview">
          <KeyValue
            rows={[
              { label: 'Title', value: dpia.title },
              { label: 'Description', value: dpia.description || '—' },
              { label: 'Status', value: <Badge label={dpia.status} /> },
              {
                label: 'Overall risk',
                value: <Badge label={dpia.overallRiskLevel || 'unknown'} />,
              },
              {
                label: 'Residual risk',
                value: <Badge label={dpia.residualRiskLevel || 'unknown'} />,
              },
              { label: 'Approved by', value: dpia.approvedBy || 'Not approved' },
              { label: 'Approved at', value: formatDate(dpia.approvedAt) },
              {
                label: 'Linked activities',
                value: dpia.linkedActivities.length ? dpia.linkedActivities.join(', ') : '—',
              },
            ]}
          />
        </Section>

        <Section num="02" title="Processing description" description="Article 35(7)(a) — a systematic description of the envisaged processing.">
          <Text style={styles.bodyText}>{dpia.processingDescription || 'Not documented.'}</Text>
        </Section>

        <Section
          num="03"
          title="Necessity and proportionality"
          description="Article 35(7)(b) — an assessment of the necessity and proportionality of the processing in relation to its purposes."
        >
          <Text style={[styles.metaLabel, { marginBottom: 8 }]}>Necessity</Text>
          <Text style={styles.bodyText}>{dpia.necessityAssessment || 'Not documented.'}</Text>
          <Text style={[styles.metaLabel, { marginBottom: 8 }]}>Proportionality</Text>
          <Text style={styles.bodyText}>{dpia.proportionalityAssessment || 'Not documented.'}</Text>
        </Section>
      </ContentPage>

      <ContentPage headerLabel={header}>
        <Section
          num="04"
          title="Risk assessment and mitigation"
          description={`${dpia.risks.length} ${
            dpia.risks.length === 1 ? 'risk' : 'risks'
          } identified and ${totalMeasures} ${
            totalMeasures === 1 ? 'measure' : 'measures'
          } recorded. Residual scores reflect the position after the measures listed.`}
        >
          {dpia.risks.length === 0 ? (
            <Text style={styles.emptyText}>No risks have been recorded for this assessment.</Text>
          ) : (
            dpia.risks.map((risk, i) => (
              <View key={i} style={{ marginBottom: 24 }}>
                <View wrap={false}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      borderBottomWidth: 1,
                      borderColor: palette.ink,
                      paddingBottom: 5,
                      marginBottom: 3,
                    }}
                  >
                    <Text style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: 11, flex: 1, paddingRight: 12 }}>
                      {String(i + 1).padStart(2, '0')} · {risk.description}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Geist',
                        fontWeight: 600,
                        fontSize: 11,
                        color: riskScoreColor(risk.residualRiskScore ?? risk.initialRiskScore),
                      }}
                    >
                      {risk.initialRiskScore ?? '—'} → {risk.residualRiskScore ?? '—'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
                    <Text style={[styles.cellText, { marginRight: 24, color: palette.muted }]}>
                      Likelihood {risk.likelihood ?? '—'}
                    </Text>
                    <Text style={[styles.cellText, { marginRight: 24, color: palette.muted }]}>
                      Severity {risk.severity ?? '—'}
                    </Text>
                  </View>
                </View>

                <DataTable
                  columns={[
                    { header: 'Mitigating measure', width: 3.2 },
                    { header: 'Status', width: 82, fixed: true },
                    { header: 'Implemented', width: 72, fixed: true, align: 'right' },
                  ]}
                  rows={risk.measures.map(m => [
                    m.description,
                    <Badge label={m.status} />,
                    formatDate(m.implementedAt),
                  ])}
                  empty="No mitigating measures recorded for this risk."
                />
              </View>
            ))
          )}
        </Section>
      </ContentPage>
    </Report>
  );
};
