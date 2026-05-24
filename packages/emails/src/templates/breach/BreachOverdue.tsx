import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type BreachOverdueProps = {
  breachTitle: string;
  referenceNumber: string;
  deadline: string;
  url: string;
};

export const BreachOverdue = ({
  breachTitle = 'Unauthorized Access to Customer Database',
  referenceNumber = 'BRE-2026-0001',
  deadline = 'October 15, 2026 at 14:00 UTC',
  url = 'https://app.example.com/breaches/123'
}: BreachOverdueProps) => {
  return (
    <Layout previewText="OVERDUE: 72-hour breach notification deadline has passed">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">DEADLINE MISSED</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Breach Notification Overdue
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        The 72-hour deadline to notify the supervisory authority for Breach <strong>{referenceNumber}</strong> ({breachTitle}) passed on <strong>{deadline}</strong>.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        You must still notify the supervisory authority as soon as possible and provide a valid reason for the delay.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Complete Notification →</Button>
      </div>
    </Layout>
  );
};

export default BreachOverdue;
