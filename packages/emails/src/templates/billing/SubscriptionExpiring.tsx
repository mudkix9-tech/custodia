import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type SubscriptionExpiringProps = {
  name: string;
  tier: string;
  expirationDate: string;
  url: string;
};

export const SubscriptionExpiring = ({
  name = 'Jane',
  tier = 'Starter',
  expirationDate = 'November 1, 2026',
  url = 'https://app.example.com/billing'
}: SubscriptionExpiringProps) => {
  return (
    <Layout previewText="Your Custodia subscription is expiring soon">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your Custodia <strong>{tier}</strong> subscription will expire on <strong>{expirationDate}</strong>.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        To continue using your compliance workspace without interruption, please renew your subscription.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Renew Subscription →</Button>
      </div>
    </Layout>
  );
};

export default SubscriptionExpiring;
