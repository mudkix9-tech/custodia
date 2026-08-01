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
  t?: any;
}

const getRiskColor = (score: number) => {
  if (score >= 76) return '#2E7D4F';
  if (score >= 51) return '#B06A00';
  return '#B02A20';
};


function T(tObj: any, key: string, fallback: string): string {
  if (!tObj || !tObj[key]) return fallback;
  return tObj[key];
}

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
    marginRight: 40,
    maxWidth: 180,
    flexWrap: 'wrap'
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

const Header = ({ orgName, t }: { orgName: string; t?: any }) => (
  <View style={styles.pageHeader} fixed>
    <Text style={styles.pageHeaderText}>
      <Text style={styles.pageHeaderBrand}>CUSTODIA</Text>   {T(t, 'headerText', 'GDPR Compliance Assessment Report · {orgName}').replace('{orgName}', orgName)}
    </Text>
  </View>
);

const Footer = ({ t }: { t?: any }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>{T(t, 'footerText', 'Generated by Custodia | trycustodia.com | Confidential')}</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => T(t, 'footerPage', 'Page {pageNumber} of {totalPages}').replace('{pageNumber}', String(pageNumber)).replace('{totalPages}', String(totalPages))} />
  </View>
);

export const AssessmentReport: React.FC<{ data: AssessmentReportData }> = ({ data }) => {
  const overallRiskColor = getRiskColor(data.overallScore);
  const totalQuestions = data.findings.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />
        
        <View style={styles.coverHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.logoBox}><View style={styles.logoInner} /></View>
            <Text style={styles.brandText}>CUSTODIA</Text>
          </View>
          <Text style={styles.subBrandText}>GDPR Compliance Platform</Text>
        </View>

        <View style={styles.coverTitleArea}>
          <Text style={styles.coverConfidential}>{T(data.t, 'confidential', 'Gap Assessment · Confidential')}</Text>
          <Text style={styles.coverTitle}>{T(data.t, 'title', 'GDPR Compliance Assessment Report')}</Text>
          <View style={styles.dividerLine} />
          
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{T(data.t, 'orgLabel', 'Organization')}</Text>
              <Text style={styles.metaValue}>{data.organizationName}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{T(data.t, 'dateLabel', 'Assessment date')}</Text>
              <Text style={styles.metaValue}>{data.reportDate}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{T(data.t, 'idLabel', 'Report ID')}</Text>
              <Text style={styles.metaValue}>PRV-GA-{new Date(data.reportDate).getFullYear()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.scoreArea}>
          <View>
            <Text style={styles.scoreLabelText}>{T(data.t, 'overallScoreLabel', 'Overall compliance score')}</Text>
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
              {T(data.t, 'assessedDesc', '{questions} questions assessed across {categories} compliance categories.').replace('{questions}', String(totalQuestions)).replace('{categories}', String(data.categories.length))}
            </Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          {T(data.t, 'disclaimer', 'This report reflects self-reported responses and is intended to support internal compliance planning. It does not constitute legal advice or certification of compliance with Regulation (EU) 2016/679.')}
        </Text>
        <Footer t={data.t} />
      </Page>

      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <Header orgName={data.organizationName} t={data.t} />
        
        <View style={styles.contentArea}>
          <View style={styles.sectionTitleFlex}>
            <Text style={styles.sectionNum}>01</Text>
            <Text style={styles.sectionTitleText}>{T(data.t, 'execSummaryTitle', 'Executive summary')}</Text>
          </View>
          
          <Text style={styles.summaryText}>
            {T(data.t, 'execSummaryText', '{orgName} achieved an overall compliance score of {score}%, placing the organization at {risk} risk of non-compliance with the GDPR.').replace('{orgName}', data.organizationName).replace('{score}', String(data.overallScore)).replace('{risk}', T(data.t, 'risk' + data.riskLevel, data.riskLevel).toLowerCase())}
          </Text>

          <View style={styles.sectionTitleFlex}>
            <Text style={styles.sectionNum}>02</Text>
            <Text style={styles.sectionTitleText}>{T(data.t, 'scoreBreakdownTitle', 'Score breakdown by category')}</Text>
          </View>

          <View style={styles.chartHeader}>
            <Text style={styles.chartHeaderText}>{T(data.t, 'catHeaderCategory', 'Category')}</Text>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.chartHeaderText, { width: 175 }]}>{T(data.t, 'catHeaderScore', 'Score')}</Text>
              <Text style={[styles.chartHeaderText, { width: 75, textAlign: 'right' }]}>{T(data.t, 'catHeaderRisk', 'Risk level')}</Text>
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
                    <Text style={[styles.catRiskText, { color: riskColor }]}>{cat.risk === 'High risk' ? T(data.t, 'riskHigh', 'High risk') : cat.risk === 'Moderate risk' ? T(data.t, 'riskModerate', 'Moderate risk') : T(data.t, 'riskLow', 'Low risk')}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2E7D4F' }]} />
              <Text style={styles.legendText}>{T(data.t, 'legendLow', 'Low risk — 76–100%')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#B06A00' }]} />
              <Text style={styles.legendText}>{T(data.t, 'legendModerate', 'Moderate risk — 51–75%')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#B02A20' }]} />
              <Text style={styles.legendText}>{T(data.t, 'legendHigh', 'High risk — 0–50%')}</Text>
            </View>
          </View>
        </View>
        <Footer t={data.t} />
      </Page>

      {/* Detailed Findings Page (Auto-wraps) */}
      <Page size="A4" style={[styles.page, { paddingHorizontal: 50, paddingTop: 85, paddingBottom: 85 }]} wrap>
        <Header orgName={data.organizationName} t={data.t} />
        
        <View style={styles.sectionTitleFlex}>
          <Text style={styles.sectionNum}>03</Text>
          <Text style={styles.sectionTitleText}>{T(data.t, 'findingsTitle', 'Detailed findings')}</Text>
        </View>
        <Text style={styles.findingDesc}>{T(data.t, 'findingsDesc', 'Responses as submitted, grouped by category. The indicator reflects the residual risk associated with each response.')}</Text>

        {data.findings.map((group, groupIdx) => (
          <View key={groupIdx} style={styles.findingGroup}>
            {/* Wrap header and first item together to prevent orphaned headers */}
            <View wrap={false}>
              <View style={styles.findingGroupHeader}>
                <Text style={styles.findingGroupName}>{group.categoryName}</Text>
                <Text style={styles.findingGroupMeta}>{T(data.t, 'questionsLabel', '{count} QUESTIONS').replace('{count}', String(group.items.length))}</Text>
              </View>
              {group.items.length > 0 && (() => {
                const q = group.items[0]!;
                const qColor = getRiskColor(q.riskScore);
                return (
                  <View style={styles.findingItem}>
                    <Text style={styles.findingNum}>01</Text>
                    <View style={styles.findingContent}>
                      <Text style={styles.findingQ}>{q.question}</Text>
                      <Text style={styles.findingA}><Text style={styles.findingALabel}>{T(data.t, 'responseLabel', 'RESPONSE')}  </Text>{q.answer}</Text>
                    </View>
                    <View style={styles.findingRiskArea}>
                      <View style={[styles.findingRiskDot, { backgroundColor: qColor }]} />
                      <Text style={[styles.findingRiskText, { color: qColor }]}>{q.risk === 'High' ? T(data.t, 'riskHigh', 'High risk').split(' ')[0] : q.risk === 'Moderate' ? T(data.t, 'riskModerate', 'Moderate risk').split(' ')[0] : T(data.t, 'riskLow', 'Low risk').split(' ')[0]}</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
            {/* Render the remaining items, individually preventing page breaks inside them */}
            {group.items.slice(1).map((q, qIdx) => {
              const actualIdx = qIdx + 1;
              const qColor = getRiskColor(q.riskScore);
              return (
                <View key={actualIdx} style={styles.findingItem} wrap={false}>
                  <Text style={styles.findingNum}>{actualIdx + 1 < 10 ? `0${actualIdx + 1}` : actualIdx + 1}</Text>
                  <View style={styles.findingContent}>
                    <Text style={styles.findingQ}>{q.question}</Text>
                    <Text style={styles.findingA}><Text style={styles.findingALabel}>{T(data.t, 'responseLabel', 'RESPONSE')}  </Text>{q.answer}</Text>
                  </View>
                  <View style={styles.findingRiskArea}>
                    <View style={[styles.findingRiskDot, { backgroundColor: qColor }]} />
                    <Text style={[styles.findingRiskText, { color: qColor }]}>{q.risk === 'High' ? T(data.t, 'riskHigh', 'High risk').split(' ')[0] : q.risk === 'Moderate' ? T(data.t, 'riskModerate', 'Moderate risk').split(' ')[0] : T(data.t, 'riskLow', 'Low risk').split(' ')[0]}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <Footer t={data.t} />
      </Page>

      {/* Action Items Page (Auto-wraps) */}
      <Page size="A4" style={[styles.page, { paddingHorizontal: 50, paddingTop: 85, paddingBottom: 85 }]} wrap>
        <Header orgName={data.organizationName} t={data.t} />
        
        <View style={styles.sectionTitleFlex}>
          <Text style={styles.sectionNum}>04</Text>
          <Text style={styles.sectionTitleText}>{T(data.t, 'actionTitle', 'Recommended action items')}</Text>
        </View>
        <Text style={styles.findingDesc}>{T(data.t, 'actionDesc', '{count} actions generated from the gaps identified, ordered by priority.').replace('{count}', String(data.actionItems.length))}</Text>

        <View style={styles.actionHeader}>
          <Text style={[styles.chartHeaderText, { width: 68 }]}>{T(data.t, 'actionHeaderPriority', 'Priority')}</Text>
          <Text style={[styles.chartHeaderText, { flex: 1 }]}>{T(data.t, 'actionHeaderAction', 'Action')}</Text>
          <Text style={[styles.chartHeaderText, { width: 85, textAlign: 'right' }]}>{T(data.t, 'actionHeaderArticle', 'GDPR article')}</Text>
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
                <Text style={styles.actionText}>{a.description || `${T(data.t, 'actionItemPrefix', 'Address risk regarding: ')}${a.title}`}</Text>
              </View>
              <View style={styles.actionArticleCol}>
                <Text style={styles.actionArticleText}>{a.article || '-'}</Text>
              </View>
            </View>
          );
        })}

        <View style={[styles.sectionTitleFlex, { marginTop: 40 }]}>
          <Text style={styles.sectionNum}>05</Text>
          <Text style={styles.sectionTitleText}>{T(data.t, 'nextStepsTitle', 'Next steps')}</Text>
        </View>
        
        {(() => {
          const highPriorityCount = data.actionItems.filter(a => a.severity === 'High').length;
          
          const categories = new Set(data.actionItems.filter(a => a.severity === 'High').map((a: any) => a.category));
          const modules: string[] = [];
          if (categories.has('Data Mapping')) modules.push(T(data.t, 'module_ropa', 'ROPA engine'));
          if (categories.has('Cookie Consent')) modules.push(T(data.t, 'module_cookie', 'cookie consent manager'));
          if (categories.has('Vendor Management')) modules.push(T(data.t, 'module_vendor', 'vendor risk tracking'));
          if (categories.has('Data Subject Rights')) modules.push(T(data.t, 'module_dsar', 'DSAR automation'));
          if (categories.has('Security')) modules.push(T(data.t, 'module_security', 'Security & Breach module'));
          
          let moduleText = "Custodia's automated compliance modules";
          if (modules.length === 1) moduleText = T(data.t, 'nextStepsModules_1', "Custodia's {m1}").replace('{m1}', modules[0]);
          else if (modules.length === 2) moduleText = T(data.t, 'nextStepsModules_2', "Custodia's {m1} and {m2}").replace('{m1}', modules[0]).replace('{m2}', modules[1]);
          else if (modules.length > 2) moduleText = T(data.t, 'nextStepsModules_multi', "Custodia's {modules}, and {last}").replace('{modules}', modules.slice(0, -1).join(', ')).replace('{last}', modules[modules.length - 1]);

          return (
            <>
              <Text style={styles.summaryText}>
                {T(data.t, 'nextStepsSummary', 'You have {highCount} high-priority gaps. {moduleText} can address {autoCount} of these automatically.').replace('{highCount}', String(highPriorityCount)).replace('{moduleText}', moduleText).replace('{autoCount}', String(Math.min(highPriorityCount, modules.length * 2)))}
              </Text>
              <Text style={[styles.summaryText, { marginTop: 10, color: '#3F5B3C', fontWeight: 600 }]}>
                {T(data.t, 'nextStepsCTA', 'Start a free trial at trycustodia.com to resolve these issues and generate a compliance certificate.')}
              </Text>
            </>
          );
        })()}
        <Footer t={data.t} />
      </Page>
    </Document>
  );
};
