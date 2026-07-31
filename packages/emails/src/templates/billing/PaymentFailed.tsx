import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type PaymentFailedProps = {
  name: string;
  amount: string;
  tier: string;
  url: string;
};

export const PaymentFailed = ({
  name = 'Jane',
  amount = '€39',
  tier = 'Starter',
  url = 'https://app.example.com/billing'
}: PaymentFailedProps) => {
  return (
    <Layout previewText="Your Custodia subscription payment was unsuccessful">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We were unable to process your payment of <strong>{amount}</strong> for your <strong>{tier}</strong> subscription.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Your access continues for 7 more days while we retry the payment. Please update your payment method to avoid interruption.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Update Payment Method →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        If you believe this is an error, reply to this email.
      </Text>
    </Layout>
  );
};

export default PaymentFailed;
