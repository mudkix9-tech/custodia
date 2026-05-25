import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type DpaExpiring7dProps = {
  vendorName: string;
  expirationDate: string;
  daysRemaining: number;
  url: string;
};

export const DpaExpiring7d = ({
  vendorName = 'Mailchimp',
  expirationDate = 'November 15, 2026',
  daysRemaining = 7,
  url = 'https://app.example.com/vendors/123'
}: DpaExpiring7dProps) => {
  return (
    <Layout previewText={`Urgent: Your DPA with ${vendorName} expires in ${daysRemaining} days`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">DPA EXPIRING SOON</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your Data Processing Agreement with <strong>{vendorName}</strong> will expire in just {daysRemaining} days (on {expirationDate}).
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Please take immediate action to renew this agreement to ensure continued compliance with GDPR Article 28.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Renew DPA Now →</Button>
      </div>
    </Layout>
  );
};

export default DpaExpiring7d;
