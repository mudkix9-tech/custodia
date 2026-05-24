import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type DpaExpiredProps = {
  vendorName: string;
  expirationDate: string;
  url: string;
};

export const DpaExpired = ({
  vendorName = 'Mailchimp',
  expirationDate = 'November 15, 2026',
  url = 'https://app.example.com/vendors/123'
}: DpaExpiredProps) => {
  return (
    <Layout previewText={`CRITICAL: Your DPA with ${vendorName} has expired`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">DPA EXPIRED</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Non-Compliant Vendor Alert
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your Data Processing Agreement with <strong>{vendorName}</strong> expired on {expirationDate}.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        You are currently sharing personal data with this vendor without a valid legal framework, violating GDPR requirements. Please rectify this immediately.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Resolve Compliance Gap →</Button>
      </div>
    </Layout>
  );
};

export default DpaExpired;
