import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type TrialEndingSoonProps = {
  name: string;
  tier: string;
  endDate: string;
  activitiesCount: number;
  vendorsCount: number;
  scoreImprovement: number;
  price: string;
  url: string;
};

export const TrialEndingSoon = ({
  name = 'Jane',
  tier = 'Starter',
  endDate = 'October 15, 2026',
  activitiesCount = 5,
  vendorsCount = 8,
  scoreImprovement = 35,
  price = '€39',
  url = 'https://app.example.com/billing'
}: TrialEndingSoonProps) => {
  return (
    <Layout previewText="Upgrade to keep your compliance workspace">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your 14-day free trial of Custodia {tier} ends on {endDate}.
      </Text>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        During your trial, you:
      </Text>

      <ul style={{ margin: '0 0 24px', paddingLeft: '20px', color: BRAND.textPrimary, fontSize: '15px' }}>
        <li style={{ marginBottom: '8px' }}>Documented {activitiesCount} processing activities</li>
        <li style={{ marginBottom: '8px' }}>Tracked {vendorsCount} vendors</li>
        <li style={{ marginBottom: '8px' }}>Improved your compliance score by {scoreImprovement} points</li>
      </ul>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Upgrade now to keep your workspace and everything you've built.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Upgrade to {tier} — {price}/month →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        Not ready? Your data will be preserved for 30 days after the trial ends. You can upgrade anytime.
      </Text>
    </Layout>
  );
};

export default TrialEndingSoon;
