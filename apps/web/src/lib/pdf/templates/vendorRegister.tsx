import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  Badge,
  ContentPage,
  Cover,
  DataTable,
  Report,
  Section,
  StatGrid,
  formatDate,
  palette,
  styles,
  titleCase,
} from '../theme';

/** Dates cross the wire as ISO strings; formatDate accepts either form. */
type WireDate = string | Date | null;

export interface VendorRegisterData {
  orgName: string;
  generatedAt: WireDate;
  vendors: Array<{
    name: string;
    category: string | null;
    headquartersCountry: string | null;
    dataProcessingLocations: string[];
    dpaStatus: string;
    dpaSignedAt: WireDate;
    dpaExpiresAt: WireDate;
    riskLevel: string | null;
    riskScore: number | null;
    securityCertifications: string[];
    transferMechanism: string | null;
    lastReviewedAt: WireDate;
  }>;
  summary: {
    total: number;
    dpasSigned: number;
    dpasExpired: number;
    dpasMissing: number;
    highRisk: number;
  };
}

export const VendorRegister: React.FC<{ data: VendorRegisterData }> = ({ data }) => {
  const header = `Vendor Register · ${data.orgName}`;

  return (
    <Report>
      <Cover
        eyebrow="Processor Register · Confidential"
        title="Vendor Register &amp; DPA Status"
        meta={[
          { label: 'Organisation', value: data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Vendors', value: String(data.summary.total) },
        ]}
        note="Evidence of the Article 28 processor relationships in place, the status of each data processing agreement, and the transfer mechanism relied upon where personal data leaves the EEA."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Register summary">
          <StatGrid
            items={[
              { value: data.summary.total, label: 'Total vendors' },
              { value: data.summary.dpasSigned, label: 'DPAs signed', color: palette.good },
              {
                value: data.summary.dpasExpired,
                label: 'DPAs expired',
                color: data.summary.dpasExpired > 0 ? palette.bad : undefined,
              },
              {
                value: data.summary.dpasMissing,
                label: 'DPAs missing',
                color: data.summary.dpasMissing > 0 ? palette.bad : undefined,
              },
              {
                value: data.summary.highRisk,
                label: 'High risk',
                color: data.summary.highRisk > 0 ? palette.bad : undefined,
              },
            ]}
          />
        </Section>

        <Section
          num="02"
          title="Vendor details"
          description="Every processor and sub-processor on record, with agreement status and the date of last review."
        >
          <DataTable
            columns={[
              { header: 'Vendor', width: 2 },
              { header: 'Category', width: 1.3 },
              { header: 'HQ', width: 0.8 },
              { header: 'DPA', width: 78, fixed: true },
              { header: 'Signed', width: 0.9 },
              { header: 'Expires', width: 0.9 },
              { header: 'Risk', width: 70, fixed: true },
              { header: 'Reviewed', width: 0.9, align: 'right' },
            ]}
            rows={data.vendors.map(v => [
              <Text style={styles.cellStrong}>{v.name}</Text>,
              titleCase(v.category),
              v.headquartersCountry || '—',
              <Badge label={v.dpaStatus} />,
              formatDate(v.dpaSignedAt),
              formatDate(v.dpaExpiresAt),
              <Badge label={v.riskLevel || 'unknown'} />,
              formatDate(v.lastReviewedAt),
            ])}
            empty="No vendors are registered."
          />
        </Section>

        <Section
          num="03"
          title="Transfers and assurances"
          description="Processing locations, transfer mechanism and security certifications as recorded against each vendor."
        >
          <DataTable
            columns={[
              { header: 'Vendor', width: 1.6 },
              { header: 'Processing locations', width: 2 },
              { header: 'Transfer mechanism', width: 1.6 },
              { header: 'Certifications', width: 2 },
            ]}
            rows={data.vendors.map(v => [
              <Text style={styles.cellStrong}>{v.name}</Text>,
              (v.dataProcessingLocations || []).join(', ') || '—',
              v.transferMechanism ? titleCase(v.transferMechanism) : 'None recorded',
              (v.securityCertifications || []).join(', ') || '—',
            ])}
            empty="No vendors are registered."
          />
        </Section>
      </ContentPage>
    </Report>
  );
};
