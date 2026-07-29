import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { ReportLayout, PageHeader, PageFooter, ReportSection } from '../pdfRenderer.js'; // Ensure correct import path

export interface AssessmentReportData {
  organizationName: string;
  reportDate: string;
  overallScore: number;
  riskLevel: string;
  answers: {
    questionText: string;
    selectedOption: string;
    riskScore: number;
  }[];
  actionItems: {
    title: string;
    description: string;
    severity: string;
  }[];
}

const styles = StyleSheet.create({
  coverPage: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  coverTitle: {
    fontSize: 28,
    color: '#294036',
    borderBottomWidth: 2,
    borderBottomColor: '#294036',
    paddingBottom: 8,
    marginBottom: 16,
  },
  coverSubtitle: {
    fontSize: 24,
    color: '#294036',
    marginBottom: 8,
  },
  coverDate: {
    fontSize: 13,
    color: '#78716c',
    marginBottom: 40,
  },
  scoreBox: {
    padding: 40,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    alignItems: 'center',
    width: '80%',
  },
  scoreLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#78716c',
    fontWeight: 700,
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: 700,
    marginVertical: 20,
  },
  riskLevel: {
    fontSize: 14,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#294036',
    width: '80%',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
  },
  itemDesc: {
    fontSize: 12,
    color: '#57534e',
  },
  table: {
    width: '100%',
    flexDirection: 'column',
    marginTop: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  tableHeader: {
    backgroundColor: '#f5f5f4',
    fontWeight: 600,
  },
  tableCell: {
    padding: 8,
    fontSize: 11,
  },
  col1: { width: '50%' },
  col2: { width: '35%' },
  col3: { width: '15%' },
});

const getScoreColor = (score: number) => {
  if (score < 50) return '#EF4444'; // Red
  if (score <= 75) return '#F59E0B'; // Yellow
  return '#00A67E'; // Green
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  let bg = '#F3F4F6';
  let color = '#374151';
  let text = 'LOW';
  
  if (severity.toLowerCase() === 'high') {
    bg = '#FEE2E2'; color = '#991B1B'; text = 'HIGH';
  } else if (severity.toLowerCase() === 'medium') {
    bg = '#FEF3C7'; color = '#92400E'; text = 'MEDIUM';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color }}>{text}</Text>
    </View>
  );
};

export const AssessmentReport = ({ data }: { data: AssessmentReportData }) => {
  return (
    <ReportLayout>
      {/* Cover Page */}
      <View style={styles.coverPage}>
        <Text style={styles.coverTitle}>GDPR Gap Assessment Report</Text>
        <Text style={styles.coverSubtitle}>{data.organizationName}</Text>
        <Text style={styles.coverDate}>Generated on: {data.reportDate}</Text>
        
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Overall Readiness Score</Text>
          <Text style={[styles.scoreNumber, { color: getScoreColor(data.overallScore) }]}>
            {data.overallScore}/100
          </Text>
          <Text style={styles.riskLevel}>Risk Level: <Text style={{ fontWeight: 700 }}>{data.riskLevel}</Text></Text>
        </View>
      </View>

      {/* Action Items Page */}
      <View break>
        <PageHeader 
          title="Action Items & Recommendations" 
          subtitle={data.organizationName}
          date={data.reportDate}
        />
        <ReportSection title="Recommendations">
          <Text style={{ fontSize: 11, marginBottom: 16 }}>
            Based on your assessment, we identified the following compliance gaps. Prioritize High severity items.
          </Text>
          
          {data.actionItems.length === 0 ? (
            <Text style={{ fontSize: 11 }}>No critical action items identified.</Text>
          ) : (
            data.actionItems.map((item, idx) => (
              <View key={idx} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <SeverityBadge severity={item.severity} />
                </View>
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
            ))
          )}
        </ReportSection>
        <PageFooter orgName={data.organizationName} reportName="Gap Assessment" />
      </View>

      {/* Answers Page */}
      <View break>
        <PageHeader 
          title="Detailed Assessment Answers" 
          subtitle={data.organizationName}
          date={data.reportDate}
        />
        <ReportSection title="Questionnaire Results">
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1]}>Question</Text>
              <Text style={[styles.tableCell, styles.col2]}>Selected Answer</Text>
              <Text style={[styles.tableCell, styles.col3]}>Risk Impact</Text>
            </View>
            
            {/* Table Body */}
            {data.answers.map((ans, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1, { fontWeight: 600 }]}>{ans.questionText}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{ans.selectedOption}</Text>
                <Text style={[styles.tableCell, styles.col3, { color: ans.riskScore > 0 ? '#EF4444' : '#00A67E' }]}>
                  {ans.riskScore > 0 ? `+${ans.riskScore} Risk` : 'Low Risk'}
                </Text>
              </View>
            ))}
          </View>
        </ReportSection>
        <PageFooter orgName={data.organizationName} reportName="Gap Assessment" />
      </View>
    </ReportLayout>
  );
};
