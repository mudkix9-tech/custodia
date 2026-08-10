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

export interface GroupSummaryData {
  orgName: string;
  generatedAt: WireDate;
  complianceScores: {
    averageScore: number;
    worstScore: number;
    breakdown: Array<{
      id: string;
      name: string;
      slug: string;
      currentScore: number;
      previousScore: number;
      trend: 'up' | 'down' | 'flat';
    }>;
  };
  vendorConsistency: Array<{
    vendorId: string;
    vendorName: string;
    usedByCount: number;
    inconsistent: boolean;
    entityDetails: Array<{
      orgId: string;
      orgName: string;
      dpaStatus: string;
      riskScore: number;
      riskLevel: string;
    }>;
  }>;
}

const TREND_MARK: Record<string, { glyph: string; color: string }> = {
  up: { glyph: '↑', color: palette.good },
  down: { glyph: '↓', color: palette.bad },
  flat: { glyph: '→', color: palette.muted },
};

export const GroupSummary: React.FC<{ data: GroupSummaryData }> = ({ data }) => {
  const header = `Group Executive Summary · ${data.orgName}`;
  const inconsistent = data.vendorConsistency.filter(v => v.inconsistent);

  return (
    <Report>
      <Cover
        eyebrow="Group Rollup · Confidential"
        title="Group Executive Summary"
        meta={[
          { label: 'Group', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Entities', value: String(data.complianceScores.breakdown.length) },
          { label: 'Average score', value: `${data.complianceScores.averageScore}%` },
        ]}
        note="A consolidated view across the group. Detailed records for each child entity — ROPA, vendor register, DPIAs — are bundled in the accompanying child_entities/ directory of this archive."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Compliance score rollup">
          <StatGrid
            items={[
              {
                value: `${data.complianceScores.averageScore}%`,
                label: 'Group average',
                color: scoreColor(data.complianceScores.averageScore),
              },
              {
                value: `${data.complianceScores.worstScore}%`,
                label: 'Weakest entity',
                color: scoreColor(data.complianceScores.worstScore),
              },
              { value: data.complianceScores.breakdown.length, label: 'Entities' },
            ]}
          />

          <DataTable
            columns={[
              { header: 'Entity', width: 2 },
              { header: 'Score', width: 2.4 },
              { header: 'Previous', width: 52, fixed: true, align: 'right' },
              { header: 'Trend', width: 44, fixed: true, align: 'right' },
            ]}
            rows={data.complianceScores.breakdown.map(b => {
              const mark = TREND_MARK[b.trend] || TREND_MARK.flat!;
              return [
                <Text style={styles.cellStrong}>{b.name}</Text>,
                <ScoreBar score={b.currentScore} />,
                `${b.previousScore}%`,
                <Text style={[styles.cellStrong, { color: mark.color, textAlign: 'right' }]}>{mark.glyph}</Text>,
              ];
            })}
            empty="No child entities are registered to this group."
          />
        </Section>
      </ContentPage>

      <ContentPage headerLabel={header}>
        <Section
          num="02"
          title="Cross-entity vendor inconsistencies"
          description="Vendors used by more than one entity where the DPA status or assessed risk differs between them. These are the cases where one entity's assurance does not carry across the group."
        >
          {inconsistent.length === 0 ? (
            <Text style={styles.emptyText}>No cross-entity vendor inconsistencies detected.</Text>
          ) : (
            inconsistent.map((v, i) => (
              <View key={i} style={{ marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderColor: palette.ink,
                    paddingBottom: 5,
                    marginBottom: 3,
                  }}
                  wrap={false}
                >
                  <Text style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: 11 }}>{v.vendorName}</Text>
                  <Text style={styles.pageHeaderText}>Used by {v.usedByCount} entities</Text>
                </View>
                <DataTable
                  columns={[
                    { header: 'Entity', width: 2 },
                    { header: 'DPA status', width: 82, fixed: true },
                    { header: 'Risk level', width: 76, fixed: true },
                    { header: 'Risk score', width: 56, fixed: true, align: 'right' },
                  ]}
                  rows={v.entityDetails.map(ed => [
                    <Text style={styles.cellStrong}>{ed.orgName}</Text>,
                    <Badge label={ed.dpaStatus} />,
                    <Badge label={ed.riskLevel} />,
                    String(ed.riskScore),
                  ])}
                />
              </View>
            ))
          )}
        </Section>
      </ContentPage>
    </Report>
  );
};
