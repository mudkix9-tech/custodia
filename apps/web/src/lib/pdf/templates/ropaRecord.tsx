import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  Badge,
  ContentPage,
  Cover,
  DataTable,
  DotLabel,
  KeyValue,
  Report,
  Section,
  formatDate,
  styles,
  titleCase,
} from '../theme';

/**
 * Article 30 record for a single organisation, replacing the inline HTML that
 * routers/export.ts used to hand to Puppeteer.
 */
export interface RopaRecordData {
  organizationName: string;
  reportDate: string;
  reportType: 'full_audit' | 'client_summary';
  activities: Array<{
    name: string;
    purpose: string | null;
    description?: string | null;
    lawfulBasis: string | null;
    status: string | null;
    riskLevel: string | null;
    retentionPeriod?: string | null;
    retentionJustification?: string | null;
    securityMeasures?: string[] | null;
  }>;
}

const HEADER = 'Record of Processing Activities';

export const RopaRecord: React.FC<{ data: RopaRecordData }> = ({ data }) => {
  const label = data.reportType === 'full_audit' ? 'Full audit report' : 'Client summary';

  return (
    <Report>
      <Cover
        eyebrow="Article 30 GDPR · Confidential"
        title="Record of Processing Activities"
        meta={[
          { label: 'Organisation', value: data.organizationName },
          { label: 'Generated', value: data.reportDate },
          { label: 'Report type', value: label },
          { label: 'Activities', value: String(data.activities.length) },
        ]}
        note="Maintained under Article 30 of Regulation (EU) 2016/679. This record reflects the processing activities registered in Custodia at the time of generation and should be read alongside the controller's supporting documentation."
      />

      <ContentPage headerLabel={`${HEADER} · ${data.organizationName}`}>
        <Section
          num="01"
          title="Processing activities inventory"
          description={`${data.activities.length} registered ${
            data.activities.length === 1 ? 'activity' : 'activities'
          }, summarised. Full records follow in section 02.`}
        >
          <DataTable
            columns={[
              { header: 'Activity', width: 2.2 },
              { header: 'Purpose', width: 2.6 },
              { header: 'Lawful basis', width: 1.6 },
              { header: 'Status', width: 1 },
              { header: 'Risk', width: 78, fixed: true, align: 'right' },
            ]}
            rows={data.activities.map(a => [
              <Text style={styles.cellStrong}>{a.name}</Text>,
              a.purpose || '—',
              titleCase(a.lawfulBasis),
              titleCase(a.status),
              <View style={{ alignItems: 'flex-end' }}>
                <DotLabel label={a.riskLevel || 'unknown'} />
              </View>,
            ])}
            empty="No processing activities have been registered."
          />
        </Section>
      </ContentPage>

      <ContentPage headerLabel={`${HEADER} · ${data.organizationName}`}>
        <Section
          num="02"
          title="Detailed activity records"
          description="Each record as registered, including retention rationale and the technical and organisational measures applied."
        >
          {data.activities.length === 0 ? (
            <Text style={styles.emptyText}>No processing activities have been registered.</Text>
          ) : (
            data.activities.map((a, i) => (
              <View key={i} style={{ marginBottom: 22 }} wrap={false}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderColor: '#16181A',
                    paddingBottom: 5,
                    marginBottom: 3,
                  }}
                >
                  <Text style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: 11 }}>{a.name}</Text>
                  <Badge label={a.riskLevel || 'unknown'} />
                </View>
                <KeyValue
                  rows={[
                    { label: 'Purpose', value: a.purpose || '—' },
                    { label: 'Description', value: a.description || '—' },
                    { label: 'Lawful basis', value: titleCase(a.lawfulBasis) },
                    {
                      label: 'Retention',
                      value: [a.retentionPeriod || 'Not specified', a.retentionJustification]
                        .filter(Boolean)
                        .join(' — '),
                    },
                    {
                      label: 'Security measures',
                      value:
                        (Array.isArray(a.securityMeasures) ? a.securityMeasures : []).join(', ') ||
                        'None specified',
                    },
                    { label: 'Status', value: titleCase(a.status) },
                  ]}
                />
              </View>
            ))
          )}
        </Section>
      </ContentPage>
    </Report>
  );
};
