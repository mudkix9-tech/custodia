import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type DpaExpiring30dProps = {
  vendorName: string;
  expirationDate: string;
  daysRemaining: number;
  linkedActivitiesCount: number;
  url: string;
};

export const DpaExpiring30d = ({
  vendorName = 'Mailchimp',
  expirationDate = 'November 15, 2026',
  daysRemaining = 30,
  linkedActivitiesCount = 3,
  url = 'https://app.example.com/vendors/123'
}: DpaExpiring30dProps) => {
  return (
    <Layout previewText={`Your Data Processing Agreement with ${vendorName} expires on ${expirationDate}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">DPA EXPIRING</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your Data Processing Agreement with <strong>{vendorName}</strong> expires on {expirationDate} (in {daysRemaining} days).
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        An expired DPA means you no longer have a legally valid basis for sharing personal data with this vendor under GDPR Article 28.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        This vendor is linked to {linkedActivitiesCount} processing activities in your ROPA.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Renew DPA →</Button>
      </div>
    </Layout>
  );
};

export default DpaExpiring30d;
