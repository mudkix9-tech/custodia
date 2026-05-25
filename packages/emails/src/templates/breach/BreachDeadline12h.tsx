import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { MetricRow } from '../../components/MetricRow';
import { BRAND } from '../../constants';

type BreachDeadline12hProps = {
  breachTitle: string;
  referenceNumber: string;
  deadline: string;
  url: string;
};

export const BreachDeadline12h = ({
  breachTitle = 'Unauthorized Access to Customer Database',
  referenceNumber = 'BRE-2026-0001',
  deadline = 'October 15, 2026 at 14:00 UTC',
  url = 'https://app.example.com/breaches/123'
}: BreachDeadline12hProps) => {
  return (
    <Layout previewText="URGENT: 12 hours remaining for breach notification">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">12 HOURS REMAINING</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Immediate Action Required
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Breach <strong>{referenceNumber}</strong>: {breachTitle}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        The GDPR 72-hour notification deadline expires on <strong>{deadline}</strong>.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Complete Notification Now →</Button>
      </div>
    </Layout>
  );
};

export default BreachDeadline12h;
