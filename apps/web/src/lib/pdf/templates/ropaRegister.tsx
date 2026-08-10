import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  ContentPage,
  Cover,
  DataTable,
  KeyValue,
  Report,
  Section,
  formatDate,
  styles,
  titleCase,
} from '../theme';

type WireDate = string | Date | null;

/**
 * The full Article 30 register produced by the audit archive, which — unlike
 * the single-org record in ropaRecord.tsx — splits controller activities
 * (Article 30(1)) from processor activities carried out on behalf of each
 * client (Article 30(2)).
 */
export interface RopaRegisterData {
  orgName: string;
  orgLegalName: string;
  orgCountry: string;
  orgAddress: { street?: string; city?: string; postalCode?: string } | null;
  dpoName: string | null;
  dpoEmail: string | null;
  generatedAt: WireDate;
  controllerActivities: any[];
  processorActivities: any[];
}

const listOf = (rows: any[] | null | undefined, pick: (r: any) => string) =>
  (rows || []).map(pick).filter(Boolean).join(', ') || '—';

const transfersOf = (a: any) =>
  (a.transfers || [])
    .map((t: any) => `${t.destinationCountry} (${titleCase(t.transferMechanism)})`)
    .join(', ') || 'None';

const groupBy = <T,>(arr: T[], fn: (item: T) => string): Record<string, T[]> =>
  arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);

export const RopaRegister: React.FC<{ data: RopaRegisterData }> = ({ data }) => {
  const header = `Article 30 Record · ${data.orgName}`;
  const byClient = groupBy(data.processorActivities || [], (a: any) => a.clientName || 'Unknown client');
  const address = data.orgAddress?.street
    ? `${data.orgAddress.street}, ${data.orgAddress.city}, ${data.orgAddress.postalCode}`
    : '—';

  return (
    <Report>
      <Cover
        eyebrow="Article 30 GDPR · Confidential"
        title="Record of Processing Activities"
        meta={[
          { label: 'Controller', value: data.orgLegalName || data.orgName },
          { label: 'Generated', value: formatDate(data.generatedAt) },
          { label: 'Controller records', value: String(data.controllerActivities.length) },
          { label: 'Processor records', value: String(data.processorActivities.length) },
        ]}
        note="Maintained under Article 30 of Regulation (EU) 2016/679 and made available to the supervisory authority on request. Section 02 records processing carried out as controller; section 03 records processing carried out on behalf of each client as processor."
      />

      <ContentPage headerLabel={header}>
        <Section num="01" title="Data controller information">
          <KeyValue
            rows={[
              { label: 'Controller name', value: data.orgLegalName || data.orgName },
              { label: 'Country', value: data.orgCountry || '—' },
              { label: 'Address', value: address },
              {
                label: 'Data protection officer',
                value: data.dpoName ? `${data.dpoName} (${data.dpoEmail || 'no email recorded'})` : 'Not appointed',
              },
            ]}
          />
        </Section>

        <Section
          num="02"
          title="Controller record"
          description="Article 30(1) — processing carried out by the controller in its own right."
        >
          <DataTable
            columns={[
              { header: 'Activity', width: 1.6 },
              { header: 'Purpose', width: 1.8 },
              { header: 'Lawful basis', width: 1.2 },
              { header: 'Data categories', width: 1.5 },
              { header: 'Data subjects', width: 1.3 },
              { header: 'Recipients', width: 1.3 },
              { header: 'Transfers', width: 1.4 },
              { header: 'Retention', width: 1 },
            ]}
            rows={data.controllerActivities.map((a: any) => [
              <Text style={styles.cellStrong}>{a.name}</Text>,
              a.purpose || '—',
              titleCase(a.lawfulBasis),
              listOf(a.dataCategories, (c: any) => c.category),
              (a.dataSubjectCategories || []).join(', ') || '—',
              listOf(a.recipients, (r: any) => r.name),
              transfersOf(a),
              a.retentionPeriod || '—',
            ])}
            empty="No controller processing activities documented."
          />
        </Section>
      </ContentPage>

      {Object.entries(byClient).map(([clientName, activities], i) => (
        <ContentPage key={i} headerLabel={header}>
          <Section
            num={String(i + 3).padStart(2, '0')}
            title={`Processor record — ${clientName}`}
            description="Article 30(2) — processing carried out on behalf of this controller."
          >
            <DataTable
              columns={[
                { header: 'Activity', width: 1.8 },
                { header: 'Categories of processing', width: 2 },
                { header: 'Data categories', width: 1.8 },
                { header: 'Transfers', width: 1.6 },
                { header: 'Security measures', width: 2 },
              ]}
              rows={(activities as any[]).map((a: any) => [
                <Text style={styles.cellStrong}>{a.name}</Text>,
                a.purpose || '—',
                listOf(a.dataCategories, (c: any) => c.category),
                transfersOf(a),
                (a.securityMeasures || []).join(', ') || '—',
              ])}
            />
          </Section>
        </ContentPage>
      ))}

      {data.processorActivities.length === 0 ? (
        <ContentPage headerLabel={header}>
          <Section num="03" title="Processor record" description="Article 30(2).">
            <View>
              <Text style={styles.emptyText}>
                No processing is carried out on behalf of another controller.
              </Text>
            </View>
          </Section>
        </ContentPage>
      ) : null}
    </Report>
  );
};
