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

export interface DsarRegisterData {
  orgName: string;
  generatedAt: WireDate;
  requests: Array<{
    referenceNumber: string;
    requestType: string;
    subjectName: string;
    receivedAt: WireDate;
    deadlineAt: WireDate;
    completedAt: WireDate;
    status: string;
    extended: boolean;
    daysToComplete: number | null;
    withinDeadline: boolean | null;
  }>;
  summary: {
    total: number;
    completed: number;
    active: number;
    overdue: number;
    averageDays: number;
    slaAdherence: number;
  };
}

export const DsarRegister: React.FC<{ data: DsarRegisterData }> = ({ data }) => {
  const header = `DSAR Register · ${data.orgName}`;

  return (
    <Report>
      <Cover
        eyebrow="Articles 15–22 · Confidential"
        title="Data Subject Access Request Register"
        meta={[
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Requests', value: String(data.summary.total) },
          { label: 'SLA adherence', value: `${data.summary.slaAdherence}%` },
        ]}
        note="A record of data subject rights requests received, the statutory one-month deadline applying to each, and whether the response was issued within it. Extensions under Article 12(3) are marked."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Response performance">
          <StatGrid
            items={[
              { value: data.summary.total, label: 'Total DSARs' },
              { value: data.summary.completed, label: 'Completed', color: palette.good },
              { value: data.summary.active, label: 'Active' },
              {
                value: data.summary.overdue,
                label: 'Overdue',
                color: data.summary.overdue > 0 ? palette.bad : undefined,
              },
              { value: data.summary.averageDays, label: 'Avg days' },
              {
                value: `${data.summary.slaAdherence}%`,
                label: 'Within SLA',
                color: data.summary.slaAdherence >= 95 ? palette.good : palette.warn,
              },
            ]}
          />
        </Section>

        <Section
          num="02"
          title="Request log"
          description="Every request received, in the order logged. 'Within SLA' reflects the response issued against the deadline in force after any extension."
        >
          <DataTable
            columns={[
              { header: 'Reference', width: 1.2 },
              { header: 'Type', width: 1 },
              { header: 'Subject', width: 1.4 },
              { header: 'Received', width: 0.9 },
              { header: 'Deadline', width: 0.9 },
              { header: 'Completed', width: 0.9 },
              { header: 'Days', width: 40, fixed: true, align: 'right' },
              { header: 'Status', width: 78, fixed: true },
              { header: 'SLA', width: 62, fixed: true },
            ]}
            rows={data.requests.map(r => [
              <Text style={styles.cellStrong}>{r.referenceNumber}</Text>,
              titleCase(r.requestType),
              r.subjectName,
              formatDate(r.receivedAt),
              <Text style={[styles.cellText, r.extended ? { color: palette.warn } : {}]}>
                {formatDate(r.deadlineAt)}
                {r.extended ? ' *' : ''}
              </Text>,
              formatDate(r.completedAt),
              r.daysToComplete == null ? '—' : String(r.daysToComplete),
              <Badge label={r.status} />,
              r.withinDeadline == null ? (
                <Text style={styles.cellText}>—</Text>
              ) : (
                <DotLabel
                  label={r.withinDeadline ? 'Yes' : 'No'}
                  color={r.withinDeadline ? palette.good : palette.bad}
                />
              ),
            ])}
            empty="No data subject requests have been received."
          />
          <Text style={[styles.cellText, { color: palette.muted, marginTop: 12 }]}>
            * Deadline extended under Article 12(3).
          </Text>
        </Section>
      </ContentPage>
    </Report>
  );
};
