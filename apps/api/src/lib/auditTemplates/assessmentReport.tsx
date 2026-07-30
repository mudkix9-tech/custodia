import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface AssessmentReportData {
  organizationName: string;
  reportDate: string;
  overallScore: number;
  riskLevel: string;
  categories: {
    name: string;
    score: number;
    risk: string;
  }[];
  findings: {
    categoryName: string;
    items: {
      question: string;
      answer: string;
      riskScore: number;
      risk: string;
    }[];
  }[];
  actionItems: {
    title: string;
    description: string;
    severity: string;
    article: string;
  }[];
}

const getRiskColor = (score: number) => {
  if (score >= 76) return '#2E7D4F';
  if (score >= 51) return '#B06A00';
  return '#B02A20';
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    color: '#16181A',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    height: '100%'
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: '#3F5B3C'
  },
  coverHeader: {
    position: 'absolute',
    top: 50,
    left: 50,
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logoBox: {
    width: 20,
    height: 20,
    backgroundColor: '#3F5B3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  logoInner: {
    width: 6.8,
    height: 6.8,
    backgroundColor: '#F7F5EF'
  },
  brandText: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 2,
    color: '#16181A'
  },
  subBrandText: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#5A5F57'
  },
  coverTitleArea: {
    position: 'absolute',
    top: 180,
    left: 50,
    right: 50
  },
  coverConfidential: {
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5A5F57',
    marginBottom: 20
  },
  coverTitle: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 31,
    lineHeight: 1.12,
    letterSpacing: -0.5,
    maxWidth: 360
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#16181A',
    marginVertical: 25,
    width: 90
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'flex-start'
  },
  metaCol: {
    marginRight: 40
  },
  metaLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#5A5F57',
    marginBottom: 5
  },
  metaValue: {
    fontFamily: 'Geist',
    fontWeight: 500,
    fontSize: 11.5
  },
  scoreArea: {
    position: 'absolute',
    top: 425,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D8D6CE',
    paddingVertical: 35,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between'
  },
  scoreLabelText: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#5A5F57',
    marginBottom: 10
  },
  scoreFlex: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  scoreValueText: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 64,
    letterSpacing: -1
  },
  scorePercent: {
    fontFamily: 'Geist',
    fontWeight: 500,
    fontSize: 22,
    marginLeft: 5
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginBottom: 10
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7
  },
  riskBadgeText: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  scoreDesc: {
    fontSize: 8.5,
    color: '#3D4142',
    lineHeight: 1.5,
    maxWidth: 175,
    textAlign: 'right'
  },
  disclaimer: {
    position: 'absolute',
    bottom: 80,
    left: 50,
    right: 50,
    fontSize: 8.5,
    lineHeight: 1.6,
    color: '#3D4142',
    maxWidth: 340
  },
  footer: {
    position: 'absolute',
    bottom: 35,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderColor: '#D8D6CE',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: {
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: '#4C5150'
  },
  pageHeader: {
    position: 'absolute',
    top: 40,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: '#D8D6CE',
    paddingBottom: 10
  },
  pageHeaderText: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#4C5150'
  },
  pageHeaderBrand: {
    fontFamily: 'Geist',
    fontWeight: 600,
    letterSpacing: 1.5
  },
  contentArea: {
    position: 'absolute',
    top: 85,
    left: 50,
    right: 50,
    bottom: 85
  },
  contentAreaFlex: {
    paddingTop: 85,
    paddingHorizontal: 50,
    paddingBottom: 85
  },
  sectionTitleFlex: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 15
  },
  sectionNum: {
    fontFamily: 'Geist',
    fontWeight: 500,
    fontSize: 8.5,
    color: '#5A5F57',
    marginRight: 10
  },
  sectionTitleText: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: -0.5
  },
  summaryText: {
    fontSize: 10.5,
    lineHeight: 1.65,
    color: '#22262A',
    maxWidth: 425,
    marginBottom: 40
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#16181A',
    paddingBottom: 5,
    marginBottom: 3
  },
  chartHeaderText: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#4C5150'
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: '#E4E2DA',
    paddingVertical: 12
  },
  catName: {
    fontFamily: 'Geist',
    fontWeight: 500,
    fontSize: 10.5
  },
  catBarArea: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  catBarTrack: {
    width: 125,
    height: 4,
    backgroundColor: '#E8E6DE',
    marginRight: 10
  },
  catBarFill: {
    height: 4
  },
  catScoreNum: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 10,
    width: 30
  },
  catRiskArea: {
    width: 75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  catRiskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  catRiskText: {
    fontSize: 9,
    fontWeight: 500
  },
  legend: {
    flexDirection: 'row',
    marginTop: 15
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  legendText: {
    fontSize: 8,
    color: '#3D4142'
  },
  findingDesc: {
    fontSize: 9,
    color: '#3D4142',
    marginBottom: 20,
    maxWidth: 400
  },
  findingGroup: {
    marginBottom: 20
  },
  findingGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#16181A',
    paddingBottom: 5,
    marginBottom: 3
  },
  findingGroupName: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 11
  },
  findingGroupMeta: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#4C5150'
  },
  findingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderColor: '#E4E2DA',
    paddingVertical: 9
  },
  findingNum: {
    fontFamily: 'Geist',
    fontSize: 8.5,
    color: '#5A5F57',
    width: 20,
    paddingTop: 1.5
  },
  findingContent: {
    flex: 1
  },
  findingQ: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: '#16181A',
    marginBottom: 4
  },
  findingA: {
    fontSize: 9,
    color: '#3D4142'
  },
  findingALabel: {
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 7.5,
    color: '#5A5F57',
    marginRight: 5
  },
  findingRiskArea: {
    width: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 1
  },
  findingRiskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  findingRiskText: {
    fontSize: 8.5,
    fontWeight: 500
  },
  actionHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#16181A',
    paddingBottom: 5,
    marginBottom: 3
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderColor: '#E4E2DA',
    paddingVertical: 10
  },
  actionPriorityCol: {
    width: 68
  },
  actionPriorityBadge: {
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignSelf: 'flex-start'
  },
  actionPriorityText: {
    fontFamily: 'Geist',
    fontWeight: 600,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  actionTextCol: {
    flex: 1,
    paddingRight: 17
  },
  actionText: {
    fontSize: 9.5,
    lineHeight: 1.45
  },
  actionArticleCol: {
    width: 85,
    textAlign: 'right'
  },
  actionArticleText: {
    fontFamily: 'Geist',
    fontSize: 9,
    color: '#22262A'
  }
});

const Header = ({ orgName }: { orgName: string }) => (
  <View style={styles.pageHeader} fixed>
    <Text style={styles.pageHeaderText}>
      <Text style={styles.pageHeaderBrand}>PRIVARO</Text>   GDPR Compliance Assessment Report · {orgName}
    </Text>
  </View>
);

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Generated by Privaro | getprivaro.com | Confidential</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

export const AssessmentReport: React.FC<{ data: AssessmentReportData }> = ({ data }) => {
  const overallRiskColor = getRiskColor(data.overallScore);

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />
        
        <View style={styles.coverHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.logoBox}><View style={styles.logoInner} /></View>
            <Text style={styles.brandText}>PRIVARO</Text>
          </View>
          <Text style={styles.subBrandText}>GDPR Compliance Platform</Text>
        </View>

        <View style={styles.coverTitleArea}>
          <Text style={styles.coverConfidential}>Gap Assessment · Confidential</Text>
          <Text style={styles.coverTitle}>GDPR Compliance Assessment Report</Text>
          <View style={styles.dividerLine} />
          
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Organization</Text>
              <Text style={styles.metaValue}>{data.organizationName}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Assessment date</Text>
              <Text style={styles.metaValue}>{data.reportDate}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Report ID</Text>
              <Text style={styles.metaValue}>PRV-GA-{new Date(data.reportDate).getFullYear()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.scoreArea}>
          <View>
            <Text style={styles.scoreLabelText}>Overall compliance score</Text>
            <View style={styles.scoreFlex}>
              <Text style={[styles.scoreValueText, { color: overallRiskColor }]}>{data.overallScore}</Text>
              <Text style={[styles.scorePercent, { color: overallRiskColor }]}>%</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.riskBadge, { borderColor: overallRiskColor }]}>
              <View style={[styles.riskDot, { backgroundColor: overallRiskColor }]} />
              <Text style={[styles.riskBadgeText, { color: overallRiskColor }]}>{data.riskLevel}</Text>
            </View>
            <Text style={styles.scoreDesc}>
              {data.categories.length * 4} questions assessed across {data.categories.length} compliance categories.
            </Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          This report reflects self-reported responses and is intended to support internal compliance planning. It does not constitute legal advice or certification of compliance with Regulation (EU) 2016/679.
        </Text>
        <Footer />
      </Page>

      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <Header orgName={data.organizationName} />
        
        <View style={styles.contentArea}>
          <View style={styles.sectionTitleFlex}>
            <Text style={styles.sectionNum}>01</Text>
            <Text style={styles.sectionTitleText}>Executive summary</Text>
          </View>
          
          <Text style={styles.summaryText}>
            {data.organizationName} achieved an overall compliance score of {data.overallScore}%, placing the organization at {data.riskLevel.toLowerCase()} of non-compliance with the GDPR.
          </Text>

          <View style={styles.sectionTitleFlex}>
            <Text style={styles.sectionNum}>02</Text>
            <Text style={styles.sectionTitleText}>Score breakdown by category</Text>
          </View>

          <View style={styles.chartHeader}>
            <Text style={styles.chartHeaderText}>Category</Text>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.chartHeaderText, { width: 175 }]}>Score</Text>
              <Text style={[styles.chartHeaderText, { width: 75, textAlign: 'right' }]}>Risk level</Text>
            </View>
          </View>

          {data.categories.map((cat, i) => {
            const riskColor = getRiskColor(cat.score);
            return (
              <View key={i} style={styles.catRow}>
                <Text style={styles.catName}>{cat.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.catBarArea}>
                    <View style={styles.catBarTrack}>
                      <View style={[styles.catBarFill, { width: `${cat.score}%`, backgroundColor: riskColor }]} />
                    </View>
                    <Text style={styles.catScoreNum}>{cat.score}%</Text>
                  </View>
                  <View style={styles.catRiskArea}>
                    <View style={[styles.catRiskDot, { backgroundColor: riskColor }]} />
                    <Text style={[styles.catRiskText, { color: riskColor }]}>{cat.risk}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2E7D4F' }]} />
              <Text style={styles.legendText}>Low risk — 76–100%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#B06A00' }]} />
              <Text style={styles.legendText}>Moderate risk — 51–75%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#B02A20' }]} />
              <Text style={styles.legendText}>High risk — 0–50%</Text>
            </View>
          </View>
        </View>
        <Footer />
      </Page>

      {/* Detailed Findings Page (Auto-wraps) */}
      <Page size="A4" style={[styles.page, { paddingHorizontal: 50, paddingTop: 85, paddingBottom: 85 }]} wrap>
        <Header orgName={data.organizationName} />
        
        <View style={styles.sectionTitleFlex}>
          <Text style={styles.sectionNum}>03</Text>
          <Text style={styles.sectionTitleText}>Detailed findings</Text>
        </View>
        <Text style={styles.findingDesc}>Responses as submitted, grouped by category. The indicator reflects the residual risk associated with each response.</Text>

        {data.findings.map((group, groupIdx) => (
          <View key={groupIdx} style={styles.findingGroup} wrap={false}>
            <View style={styles.findingGroupHeader}>
              <Text style={styles.findingGroupName}>{group.categoryName}</Text>
              <Text style={styles.findingGroupMeta}>{group.items.length} QUESTIONS</Text>
            </View>
            {group.items.map((q, qIdx) => {
              const qColor = getRiskColor(q.riskScore);
              return (
                <View key={qIdx} style={styles.findingItem}>
                  <Text style={styles.findingNum}>0{qIdx + 1}</Text>
                  <View style={styles.findingContent}>
                    <Text style={styles.findingQ}>{q.question}</Text>
                    <Text style={styles.findingA}><Text style={styles.findingALabel}>RESPONSE  </Text>{q.answer}</Text>
                  </View>
                  <View style={styles.findingRiskArea}>
                    <View style={[styles.findingRiskDot, { backgroundColor: qColor }]} />
                    <Text style={[styles.findingRiskText, { color: qColor }]}>{q.risk}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <Footer />
      </Page>

      {/* Action Items Page (Auto-wraps) */}
      <Page size="A4" style={[styles.page, { paddingHorizontal: 50, paddingTop: 85, paddingBottom: 85 }]} wrap>
        <Header orgName={data.organizationName} />
        
        <View style={styles.sectionTitleFlex}>
          <Text style={styles.sectionNum}>04</Text>
          <Text style={styles.sectionTitleText}>Recommended action items</Text>
        </View>
        <Text style={styles.findingDesc}>{data.actionItems.length} actions generated from the gaps identified, ordered by priority.</Text>

        <View style={styles.actionHeader}>
          <Text style={[styles.chartHeaderText, { width: 68 }]}>Priority</Text>
          <Text style={[styles.chartHeaderText, { flex: 1 }]}>Action</Text>
          <Text style={[styles.chartHeaderText, { width: 85, textAlign: 'right' }]}>GDPR article</Text>
        </View>

        {data.actionItems.map((a, i) => {
          let aColor = '#5A5F57';
          if (a.severity === 'High') aColor = '#B02A20';
          if (a.severity === 'Medium') aColor = '#B06A00';

          return (
            <View key={i} style={styles.actionItem} wrap={false}>
              <View style={styles.actionPriorityCol}>
                <View style={[styles.actionPriorityBadge, { borderColor: aColor }]}>
                  <Text style={[styles.actionPriorityText, { color: aColor }]}>{a.severity}</Text>
                </View>
              </View>
              <View style={styles.actionTextCol}>
                <Text style={styles.actionText}>{a.description || a.title}</Text>
              </View>
              <View style={styles.actionArticleCol}>
                <Text style={styles.actionArticleText}>{a.article || '-'}</Text>
              </View>
            </View>
          );
        })}

        <View style={[styles.sectionTitleFlex, { marginTop: 40 }]}>
          <Text style={styles.sectionNum}>05</Text>
          <Text style={styles.sectionTitleText}>Next steps</Text>
        </View>
        <Text style={styles.summaryText}>
          The high-priority actions above account for the majority of the current score deficit. Privaro tracks each of them as a remediation task with owners, deadlines and evidence attachments, and re-scores the assessment automatically as tasks are closed.
        </Text>
        <Footer />
      </Page>
    </Document>
  );
};
