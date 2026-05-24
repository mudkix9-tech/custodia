import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { MetricRow } from '../../components/MetricRow';
import { BRAND } from '../../constants';

type BreachDeadline48hProps = {
  breachTitle: string;
  referenceNumber: string;
  deadline: string;
  status: string;
  riskAssessment: string;
  url: string;
};

export const BreachDeadline48h = ({
  breachTitle = 'Unauthorized Access to Customer Database',
  referenceNumber = 'BRE-2026-0001',
  deadline = 'October 15, 2026 at 14:00 UTC',
  status = 'Investigating',
  riskAssessment = 'Pending',
  url = 'https://app.example.com/breaches/123'
}: BreachDeadline48hProps) => {
  return (
    <Layout previewText="48 hours remaining to notify supervisory authority">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">48 HOURS REMAINING</Badge>
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
        <MetricRow label="Notification decision:" value="Pending" />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Open Breach Workspace →</Button>
      </div>
    </Layout>
  );
};

export default BreachDeadline48h;
