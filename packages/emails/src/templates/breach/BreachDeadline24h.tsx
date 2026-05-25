import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { MetricRow } from '../../components/MetricRow';
import { BRAND } from '../../constants';

type BreachDeadline24hProps = {
  breachTitle: string;
  referenceNumber: string;
  deadline: string;
  status: string;
  riskAssessment: string;
  notificationDecision: string;
  url: string;
};

export const BreachDeadline24h = ({
  breachTitle = 'Unauthorized Access to Customer Database',
  referenceNumber = 'BRE-2026-0001',
  deadline = 'October 15, 2026 at 14:00 UTC',
  status = 'Investigating',
  riskAssessment = 'Completed',
  notificationDecision = 'Required',
  url = 'https://app.example.com/breaches/123'
}: BreachDeadline24hProps) => {
  return (
    <Layout previewText="Supervisory authority notification deadline in 24 hours">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">24 HOURS REMAINING</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Breach <strong>{referenceNumber}</strong>: {breachTitle}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        The 72-hour notification deadline expires on <strong>{deadline}</strong>.
      </Text>

      <div style={{ marginBottom: '32px', backgroundColor: '#FAFAFA', padding: '16px', borderRadius: '6px', border: `1px solid ${BRAND.borderColor}` }}>
        <MetricRow label="Status:" value={status} />
        <MetricRow label="Risk assessment:" value={riskAssessment} />
        <MetricRow label="Notification decision:" value={notificationDecision} />
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        If notification is required, the draft must be approved and sent before the deadline.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Open Breach Workspace →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        Under GDPR Article 33, failure to notify within 72 hours may result in additional penalties.
      </Text>
    </Layout>
  );
};

export default BreachDeadline24h;
