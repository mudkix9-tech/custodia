import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { MetricRow } from '../../components/MetricRow';
import { BRAND } from '../../constants';

type DsarDeadlineWarningProps = {
  daysRemaining: number;
  referenceNumber: string;
  subjectName: string;
  requestType: string;
  dueDate: string;
  status: string;
  tasksCompletedText: string;
  assignedTo: string;
  url: string;
};

export const DsarDeadlineWarning = ({
  daysRemaining = 3,
  referenceNumber = 'DSAR-2026-0042',
  subjectName = 'John Doe',
  requestType = 'Right to Access',
  dueDate = 'October 15, 2026',
  status = 'In Progress',
  tasksCompletedText = '3 of 7',
  assignedTo = 'Jane Smith',
  url = 'https://app.example.com/dsar/123'
}: DsarDeadlineWarningProps) => {
  const isCritical = daysRemaining <= 3;

  return (
    <Layout previewText={`${subjectName}'s ${requestType} request is due by ${dueDate}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status={isCritical ? 'critical' : 'warning'}>
          {daysRemaining} days remaining
        </Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        DSAR <strong>{referenceNumber}</strong> from <strong>{subjectName}</strong> is due on <strong>{dueDate}</strong>.
      </Text>

      <div style={{ marginBottom: '32px', backgroundColor: '#FAFAFA', padding: '16px', borderRadius: '6px', border: `1px solid ${BRAND.borderColor}` }}>
        <MetricRow label="Current status:" value={status} />
        <MetricRow label="Tasks completed:" value={tasksCompletedText} />
        <MetricRow label="Assigned to:" value={assignedTo} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Open DSAR workspace →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        Under GDPR Article 12, you must respond to data subject requests within 30 days.
      </Text>
    </Layout>
  );
};

export default DsarDeadlineWarning;
