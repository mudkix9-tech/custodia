import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  Bullets,
  ContentPage,
  Cover,
  Report,
  ScoreBar,
  Section,
  StatGrid,
  palette,
  scoreColor,
  styles,
} from '../theme';

/**
 * Board-facing summary. Shape is unchanged from the Puppeteer version in
 * apps/api/src/lib/auditTemplates/executiveReport.ts so the caller only swaps
 * the transport.
 */
export interface ExecutiveReportData {
  organizationName: string;
  reportDate: string;
  overallScore: number;
  industryAverage: number;
  topQuartile: number;
  trendData: Array<{ month: string; score: number }>;
  topRisks: string[];
  keyAchievements: string[];
  recommendedActions: string[];
}

export const ExecutiveReport: React.FC<{ data: ExecutiveReportData }> = ({ data }) => {
  const header = `Executive Compliance Summary · ${data.organizationName}`;
  const vsIndustry = data.overallScore - data.industryAverage;
  const trend = data.trendData.length > 1
    ? data.overallScore - (data.trendData[0]?.score ?? data.overallScore)
    : 0;

  return (
    <Report>
      <Cover
        eyebrow="Executive Briefing · Confidential"
        title="Executive Compliance Summary"
        meta={[
          { label: 'Organisation', value: data.organizationName },
          { label: 'Reporting date', value: data.reportDate },
          { label: 'Period', value: `${data.trendData.length} months` },
        ]}
        note="Prepared for executive and board review. Scores are derived from the organisation's live compliance posture in Custodia and are not a certification of compliance with Regulation (EU) 2016/679."
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
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={styles.metaLabel}>Overall compliance score</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontFamily: 'Geist',
                  fontWeight: 600,
                  fontSize: 64,
                  letterSpacing: -1,
                  color: scoreColor(data.overallScore),
                }}
              >
                {data.overallScore}
              </Text>
              <Text
                style={{
                  fontFamily: 'Geist',
                  fontWeight: 500,
                  fontSize: 22,
                  marginLeft: 5,
                  color: scoreColor(data.overallScore),
                }}
              >
                %
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.cellText, { color: palette.bodySoft, textAlign: 'right', maxWidth: 190 }]}>
              {vsIndustry >= 0 ? `${vsIndustry} points above` : `${Math.abs(vsIndustry)} points below`} the
              industry average of {data.industryAverage}%. Top quartile begins at {data.topQuartile}%.
            </Text>
          </View>
        </View>
      </Cover>

      <ContentPage headerLabel={header}>
        <Section num="01" title="Where the organisation stands">
          <Text style={styles.bodyText}>
            {data.organizationName} is at {data.overallScore}% overall compliance,{' '}
            {vsIndustry >= 0 ? 'ahead of' : 'behind'} the industry average of {data.industryAverage}% and{' '}
            {data.overallScore >= data.topQuartile ? 'within' : 'below'} the top quartile threshold of{' '}
            {data.topQuartile}%.{' '}
            {trend > 0
              ? `The score has risen ${trend} points across the reporting period.`
              : trend < 0
                ? `The score has fallen ${Math.abs(trend)} points across the reporting period.`
                : 'The score is flat across the reporting period.'}
          </Text>

          <StatGrid
            items={[
              { value: `${data.overallScore}%`, label: 'Current score', color: scoreColor(data.overallScore) },
              { value: `${data.industryAverage}%`, label: 'Industry average' },
              { value: `${data.topQuartile}%`, label: 'Top quartile' },
              {
                value: `${trend >= 0 ? '+' : ''}${trend}`,
                label: 'Change in period',
                color: trend >= 0 ? palette.good : palette.bad,
              },
            ]}
          />
        </Section>

        <Section num="02" title="Compliance trend" description="Monthly overall score across the reporting period.">
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { width: 60 }]}>Month</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Score</Text>
          </View>
          {data.trendData.map((t, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={[styles.cellStrong, { width: 60 }]}>{t.month}</Text>
              <View style={{ flex: 1 }}>
                <ScoreBar score={t.score} />
              </View>
            </View>
          ))}
        </Section>
      </ContentPage>

      <ContentPage headerLabel={header}>
        <Section num="03" title="Top risks" description="The exposures most likely to require executive attention.">
          <Bullets items={data.topRisks} empty="No significant risks identified." />
        </Section>

        <Section num="04" title="Key achievements" description="Progress recorded during the reporting period.">
          <Bullets items={data.keyAchievements} empty="No achievements recorded for this period." />
        </Section>

        <Section num="05" title="Recommended actions" description="Ordered by expected impact on the overall score.">
          <Bullets items={data.recommendedActions} empty="Maintain current compliance posture." />
        </Section>
      </ContentPage>
    </Report>
  );
};
