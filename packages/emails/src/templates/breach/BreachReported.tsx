import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type BreachReportedProps = {
  breachTitle: string;
  referenceNumber: string;
  reportedBy: string;
  url: string;
};

export const BreachReported = ({
  breachTitle = 'Unauthorized Access to Customer Database',
  referenceNumber = 'BRE-2026-0001',
  reportedBy = 'Alice Walker',
  url = 'https://app.example.com/breaches/123'
}: BreachReportedProps) => {
  return (
    <Layout previewText="A new potential data breach has been reported">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">NEW BREACH REPORT</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        A new potential data breach has been logged in Custodia by {reportedBy}.
      </Text>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        {referenceNumber}: {breachTitle}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Immediate action is required to assess the risk. You have 72 hours from the moment you became aware of the breach to notify the supervisory authority, if applicable.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Assess Breach Risk →</Button>
      </div>
    </Layout>
  );
};

export default BreachReported;
