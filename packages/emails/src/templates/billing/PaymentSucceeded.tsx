import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { MetricRow } from '../../components/MetricRow';
import { BRAND } from '../../constants';

type PaymentSucceededProps = {
  name: string;
  amount: string;
  tier: string;
  date: string;
  invoiceUrl: string;
};

export const PaymentSucceeded = ({
  name = 'Jane',
  amount = '€39',
  tier = 'Starter',
  date = 'October 1, 2026',
  invoiceUrl = 'https://app.example.com/billing/invoices/123'
}: PaymentSucceededProps) => {
  return (
    <Layout previewText="Your payment was successful">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We have successfully processed your payment for your Custodia subscription.
      </Text>

      <div style={{ marginBottom: '32px', backgroundColor: '#FAFAFA', padding: '16px', borderRadius: '6px', border: `1px solid ${BRAND.borderColor}` }}>
        <MetricRow label="Amount paid:" value={amount} />
        <MetricRow label="Plan:" value={tier} />
        <MetricRow label="Date:" value={date} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={invoiceUrl}>Download Invoice</Button>
      </div>
    </Layout>
  );
};

export default PaymentSucceeded;
