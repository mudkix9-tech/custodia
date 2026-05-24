import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type VendorBreachAlertProps = {
  vendorName: string;
  dataCategoriesCount: number;
  linkedActivitiesCount: number;
  affectedSubjectsCount: number;
  url: string;
};

export const VendorBreachAlert = ({
  vendorName = 'Mailchimp',
  dataCategoriesCount = 4,
  linkedActivitiesCount = 2,
  affectedSubjectsCount = 1500,
  url = 'https://app.example.com/breaches/new'
}: VendorBreachAlertProps) => {
  return (
    <Layout previewText={`${vendorName} reported a data breach — review impact on your organization`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">VENDOR BREACH</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        <strong>{vendorName}</strong> has reported a data breach.
      </Text>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        Your exposure:
      </Text>

      <ul style={{ margin: '0 0 24px', paddingLeft: '20px', color: BRAND.textPrimary, fontSize: '15px' }}>
        <li style={{ marginBottom: '8px' }}>You share {dataCategoriesCount} data categories with this vendor</li>
        <li style={{ marginBottom: '8px' }}>Linked to {linkedActivitiesCount} processing activities</li>
        <li style={{ marginBottom: '8px' }}>{affectedSubjectsCount} data subjects potentially affected</li>
      </ul>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        Action required:
      </Text>

      <ul style={{ margin: '0 0 24px', paddingLeft: '20px', color: BRAND.textPrimary, fontSize: '15px' }}>
        <li style={{ marginBottom: '8px' }}>Assess whether your data was affected</li>
        <li style={{ marginBottom: '8px' }}>Determine if you need to notify your supervisory authority</li>
        <li style={{ marginBottom: '8px' }}>Document your assessment in your breach register</li>
      </ul>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Assess Impact →</Button>
      </div>
    </Layout>
  );
};

export default VendorBreachAlert;
