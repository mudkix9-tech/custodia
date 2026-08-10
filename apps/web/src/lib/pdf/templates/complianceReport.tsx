import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  Badge,
  ContentPage,
  Cover,
  DataTable,
  Report,
  ScoreBar,
  Section,
  StatGrid,
  formatDate,
  palette,
  scoreColor,
  styles,
  titleCase,
} from '../theme';

type WireDate = string | Date | null;

export interface ComplianceReportData {
  orgName: string;
  generatedAt: WireDate;
  currentScore: number;
  categoryScores: Record<string, number>;
  scoreHistory: Array<{ date: WireDate; score: number }>;
  activeGaps: Array<{
    title: string;
    gapType: string;
    severity: string;
    entityType: string;
    firstDetectedAt: WireDate;
    detectionCount: number;
  }>;
  resolvedGaps30d: number;
  summary: {
    totalActiveGaps: number;
    criticalGaps: number;
    highGaps: number;
    mediumGaps: number;
  };
}

/** Pillar weights are fixed by the scoring model in apps/api/src/lib/scoring.ts. */
const PILLAR_WEIGHTS: Record<string, string> = {
  ropa: '25%',
  vendors: '20%',
  dpia: '15%',
  policies: '10%',
  dsar: '10%',
  breach: '5%',
  training: '10%',
  transfers: '5%',
};

export const ComplianceReport: React.FC<{ data: ComplianceReportData }> = ({ data }) => {
  const header = `Compliance Posture · ${data.orgName}`;
  const pillars = Object.entries(data.categoryScores);

  return (
    <Report>
      <Cover
        eyebrow="Compliance Posture · Confidential"
        title="Compliance Posture Report"
        meta={[
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Active gaps', value: String(data.summary.totalActiveGaps) },
          { label: 'Resolved (30d)', value: String(data.resolvedGaps30d) },
        ]}
        note="A point-in-time view of the organisation's compliance score, its weighted pillar breakdown, and the gaps currently open against it."
      >
        <View
          style={{
            position: 'absolute',
            top: 425,
            left: 50,
            right: 50,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: palette.rule,
            paddingVertical: 35,
          }}
        >
          <Text style={styles.metaLabel}>Overall compliance score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{
                fontFamily: 'Geist',
                fontWeight: 600,
                fontSize: 64,
                letterSpacing: -1,
                color: scoreColor(data.currentScore),
              }}
            >
              {data.currentScore}
            </Text>
            <Text
              style={{
                fontFamily: 'Geist',
                fontWeight: 500,
                fontSize: 22,
                marginLeft: 5,
                color: scoreColor(data.currentScore),
              }}
            >
              %
            </Text>
          </View>
        </View>
      </Cover>

      <ContentPage headerLabel={header}>
        <Section num="01" title="Gap summary">
          <StatGrid
            items={[
              { value: data.summary.totalActiveGaps, label: 'Active gaps' },
              {
                value: data.summary.criticalGaps,
                label: 'Critical',
                color: data.summary.criticalGaps > 0 ? palette.bad : undefined,
              },
              {
                value: data.summary.highGaps,
                label: 'High',
                color: data.summary.highGaps > 0 ? palette.bad : undefined,
              },
              { value: data.summary.mediumGaps, label: 'Medium', color: palette.warn },
              { value: data.resolvedGaps30d, label: 'Resolved (30d)', color: palette.good },
            ]}
          />
        </Section>

        <Section
          num="02"
          title="Pillar breakdown"
          description="Each pillar's score and its weight in the overall figure."
        >
          <DataTable
            columns={[
              { header: 'Category', width: 1.4 },
              { header: 'Score', width: 2.4 },
              { header: 'Weight', width: 52, fixed: true, align: 'right' },
            ]}
            rows={pillars.map(([category, score]) => [
              <Text style={styles.cellStrong}>{titleCase(category)}</Text>,
              <ScoreBar score={score} />,
              PILLAR_WEIGHTS[category] || '—',
            ])}
            empty="No pillar scores have been calculated."
          />
        </Section>

        {data.scoreHistory.length > 1 ? (
          <Section num="03" title="Score trend" description="Every recalculation recorded for this organisation.">
            <DataTable
              columns={[
                { header: 'Date', width: 1 },
                { header: 'Score', width: 3 },
              ]}
              rows={data.scoreHistory.map(s => [formatDate(s.date), <ScoreBar score={s.score} />])}
            />
          </Section>
        ) : null}
      </ContentPage>

      <ContentPage headerLabel={header}>
        <Section
          num={data.scoreHistory.length > 1 ? '04' : '03'}
          title={`Active compliance gaps (${data.summary.totalActiveGaps})`}
          description="Detection count is the number of consecutive scoring runs in which the gap has been observed — a proxy for how long it has gone unaddressed."
        >
          <DataTable
            columns={[
              { header: 'Issue', width: 2.6 },
              { header: 'Type', width: 1.2 },
              { header: 'Severity', width: 76, fixed: true },
              { header: 'Module', width: 1 },
              { header: 'First detected', width: 68, fixed: true },
              { header: 'Detections', width: 56, fixed: true, align: 'right' },
            ]}
            rows={data.activeGaps.map(g => [
              <Text style={styles.cellStrong}>{g.title}</Text>,
              titleCase(g.gapType),
              <Badge label={g.severity} />,
              titleCase(g.entityType),
              formatDate(g.firstDetectedAt),
              String(g.detectionCount),
            ])}
            empty="No active compliance gaps."
          />
        </Section>
      </ContentPage>
    </Report>
  );
};
