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

export interface BreachRegisterData {
  orgName: string;
  generatedAt: WireDate;
  breaches: Array<{
    referenceNumber: string;
    title: string;
    discoveredAt: WireDate;
    breachType: string;
    riskToIndividuals: string | null;
    estimatedRecordsAffected: number | null;
    notifyAuthority: boolean | null;
    authorityNotifiedAt: WireDate;
    notifyIndividuals: boolean | null;
    status: string;
    rootCause: string | null;
    vendorOriginated: boolean;
  }>;
  summary: {
    total: number;
    notifiable: number;
    notifiedOnTime: number;
    vendorOriginated: number;
    averageResolutionDays: number;
  };
}

export const BreachRegister: React.FC<{ data: BreachRegisterData }> = ({ data }) => {
  const header = `Breach Register · ${data.orgName}`;

  return (
    <Report>
      <Cover
        eyebrow="Article 33(5) · Confidential"
        title="Personal Data Breach Register"
        meta={[
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Incidents', value: String(data.summary.total) },
          { label: 'Notifiable', value: String(data.summary.notifiable) },
        ]}
        note="Maintained under Article 33(5), which requires the controller to document every personal data breach — including those not notified — with its effects and the remedial action taken."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Incident summary">
          <StatGrid
            items={[
              { value: data.summary.total, label: 'Total breaches' },
              { value: data.summary.notifiable, label: 'Notifiable' },
              {
                value: data.summary.notifiedOnTime,
                label: 'Notified in 72h',
                color:
                  data.summary.notifiable > 0 && data.summary.notifiedOnTime < data.summary.notifiable
                    ? palette.bad
                    : palette.good,
              },
              { value: data.summary.vendorOriginated, label: 'Vendor origin' },
              { value: data.summary.averageResolutionDays, label: 'Avg days to close' },
            ]}
          />
        </Section>

        <Section
          num="02"
          title="Breach log"
          description="Every incident recorded, with the supervisory authority notification decision and its outcome."
        >
          <DataTable
            columns={[
              { header: 'Reference', width: 1 },
              { header: 'Incident', width: 2 },
              { header: 'Discovered', width: 0.9 },
              { header: 'Type', width: 1 },
              { header: 'Risk', width: 68, fixed: true },
              { header: 'Records', width: 52, fixed: true, align: 'right' },
              { header: 'Authority', width: 0.9 },
              { header: 'Status', width: 78, fixed: true },
            ]}
            rows={data.breaches.map(b => [
              <Text style={styles.cellStrong}>{b.referenceNumber}</Text>,
              b.title,
              formatDate(b.discoveredAt),
              titleCase(b.breachType),
              <Badge label={b.riskToIndividuals || 'unknown'} />,
              b.estimatedRecordsAffected == null ? '—' : b.estimatedRecordsAffected.toLocaleString(),
              b.notifyAuthority
                ? formatDate(b.authorityNotifiedAt)
                : 'Not notifiable',
              <Badge label={b.status} />,
            ])}
            empty="No personal data breaches have been recorded."
          />
        </Section>

        <Section
          num="03"
          title="Root cause and individual notification"
          description="Article 33(5) requires the facts and remedial action to be documented for each incident."
        >
          <DataTable
            columns={[
              { header: 'Reference', width: 1 },
              { header: 'Root cause', width: 3.4 },
              { header: 'Vendor origin', width: 70, fixed: true },
              { header: 'Individuals notified', width: 92, fixed: true },
            ]}
            rows={data.breaches.map(b => [
              <Text style={styles.cellStrong}>{b.referenceNumber}</Text>,
              b.rootCause || 'Not recorded',
              <DotLabel
                label={b.vendorOriginated ? 'Yes' : 'No'}
                color={b.vendorOriginated ? palette.warn : palette.muted}
              />,
              <DotLabel
                label={b.notifyIndividuals ? 'Yes' : 'No'}
                color={b.notifyIndividuals ? palette.good : palette.muted}
              />,
            ])}
            empty="No personal data breaches have been recorded."
          />
        </Section>
      </ContentPage>
    </Report>
  );
};
