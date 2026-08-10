import React from 'react';
import { Text } from '@react-pdf/renderer';
import {
  ContentPage,
  Cover,
  DataTable,
  DotLabel,
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

export interface ConsentReportData {
  orgName: string;
  generatedAt: WireDate;
  domains: Array<{
    domain: string;
    totalPageviews30d: number;
    consentRate30d: number;
    lastScanAt: WireDate;
    cookieCount: number;
    gcmEnabled: boolean;
    tcfEnabled: boolean;
  }>;
  summary: {
    totalDomains: number;
    averageConsentRate: number;
    totalPageviews: number;
    totalCookiesTracked: number;
  };
}

export const ConsentReport: React.FC<{ data: ConsentReportData }> = ({ data }) => {
  const header = `Consent Analytics · ${data.orgName}`;
  const yesNo = (on: boolean) => (
    <DotLabel label={on ? 'Enabled' : 'Off'} color={on ? palette.good : palette.muted} />
  );

  return (
    <Report>
      <Cover
        eyebrow="Article 7 · Confidential"
        title="Cookie Consent Analytics Report"
        meta={[
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Domains', value: String(data.summary.totalDomains) },
          { label: 'Window', value: 'Last 30 days' },
        ]}
        note="Article 7(1) requires the controller to be able to demonstrate that the data subject consented. These figures record consent outcomes captured by the Custodia CMP across the monitored domains."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Consent summary">
          <StatGrid
            items={[
              { value: data.summary.totalDomains, label: 'Domains' },
              {
                value: `${data.summary.averageConsentRate}%`,
                label: 'Avg consent rate',
                color: scoreColor(data.summary.averageConsentRate),
              },
              { value: data.summary.totalPageviews.toLocaleString(), label: 'Pageviews (30d)' },
              { value: data.summary.totalCookiesTracked, label: 'Cookies tracked' },
            ]}
          />
        </Section>

        <Section
          num="02"
          title="Domain overview"
          description="Consent rate is the share of banner interactions in the last 30 days that resulted in consent to non-essential categories."
        >
          <DataTable
            columns={[
              { header: 'Domain', width: 2 },
              { header: 'Pageviews (30d)', width: 1, align: 'right' },
              { header: 'Consent rate', width: 1.6 },
              { header: 'Cookies', width: 48, fixed: true, align: 'right' },
              { header: 'GCM v2', width: 66, fixed: true },
              { header: 'TCF', width: 66, fixed: true },
              { header: 'Last scan', width: 64, fixed: true, align: 'right' },
            ]}
            rows={data.domains.map(d => [
              <Text style={styles.cellStrong}>{d.domain}</Text>,
              d.totalPageviews30d.toLocaleString(),
              <ScoreBar score={d.consentRate30d} />,
              String(d.cookieCount),
              yesNo(d.gcmEnabled),
              yesNo(d.tcfEnabled),
              formatDate(d.lastScanAt),
            ])}
            empty="No domains are being monitored."
          />
        </Section>
      </ContentPage>
    </Report>
  );
};
