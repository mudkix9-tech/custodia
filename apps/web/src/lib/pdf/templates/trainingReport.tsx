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
} from '../theme';

type WireDate = string | Date | null;

export interface TrainingReportData {
  orgName: string;
  generatedAt: WireDate;
  modules: Array<{
    title: string;
    isMandatory: boolean;
    completionRate: number;
    totalAssigned: number;
    totalCompleted: number;
  }>;
  completions: Array<{
    userName: string;
    userEmail: string;
    moduleTitle: string;
    status: string;
    quizScore: number | null;
    completedAt: WireDate;
    expiresAt: WireDate;
    certificateId: string | null;
  }>;
  summary: {
    overallCompletionRate: number;
    totalModules: number;
    totalCompletions: number;
    overdueCount: number;
  };
}

export const TrainingReport: React.FC<{ data: TrainingReportData }> = ({ data }) => {
  const header = `Training Compliance · ${data.orgName}`;

  return (
    <Report>
      <Cover
        eyebrow="Article 39(1)(b) · Confidential"
        title="Employee Training Compliance Report"
        meta={[
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Modules', value: String(data.summary.totalModules) },
          { label: 'Completion', value: `${data.summary.overallCompletionRate}%` },
        ]}
        note="Evidence of awareness-raising and training of staff involved in processing operations, as required of the data protection officer under Article 39(1)(b)."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Programme summary">
          <StatGrid
            items={[
              {
                value: `${data.summary.overallCompletionRate}%`,
                label: 'Completion rate',
                color: scoreColor(data.summary.overallCompletionRate),
              },
              { value: data.summary.totalModules, label: 'Modules' },
              { value: data.summary.totalCompletions, label: 'Completions' },
              {
                value: data.summary.overdueCount,
                label: 'Overdue',
                color: data.summary.overdueCount > 0 ? palette.bad : palette.good,
              },
            ]}
          />
        </Section>

        <Section num="02" title="Module overview" description="Assignment and completion by module. Mandatory modules are marked.">
          <DataTable
            columns={[
              { header: 'Module', width: 2.6 },
              { header: 'Mandatory', width: 62, fixed: true },
              { header: 'Assigned', width: 52, fixed: true, align: 'right' },
              { header: 'Completed', width: 58, fixed: true, align: 'right' },
              { header: 'Completion rate', width: 1.6 },
            ]}
            rows={data.modules.map(m => [
              <Text style={styles.cellStrong}>{m.title}</Text>,
              m.isMandatory ? <Badge label="Required" color={palette.brand} /> : <Text style={styles.cellText}>Optional</Text>,
              String(m.totalAssigned),
              String(m.totalCompleted),
              <ScoreBar score={m.completionRate} />,
            ])}
            empty="No training modules have been published."
          />
        </Section>
      </ContentPage>

      <ContentPage headerLabel={header}>
        <Section
          num="03"
          title="Individual completion records"
          description="Per-employee record supporting the completion rates above, including certificate references where issued."
        >
          <DataTable
            columns={[
              { header: 'Employee', width: 1.5 },
              { header: 'Email', width: 1.9 },
              { header: 'Module', width: 1.9 },
              { header: 'Status', width: 76, fixed: true },
              { header: 'Score', width: 40, fixed: true, align: 'right' },
              { header: 'Completed', width: 62, fixed: true },
              { header: 'Expires', width: 62, fixed: true },
              { header: 'Certificate', width: 1.3, align: 'right' },
            ]}
            rows={data.completions.map(c => [
              <Text style={styles.cellStrong}>{c.userName}</Text>,
              c.userEmail,
              c.moduleTitle,
              <Badge label={c.status} />,
              c.quizScore == null ? (
                <Text style={styles.cellText}>—</Text>
              ) : (
                <Text style={[styles.cellText, { color: scoreColor(c.quizScore), textAlign: 'right' }]}>
                  {c.quizScore}%
                </Text>
              ),
              formatDate(c.completedAt),
              formatDate(c.expiresAt),
              c.certificateId || '—',
            ])}
            empty="No completions have been recorded."
          />
        </Section>
      </ContentPage>
    </Report>
  );
};
