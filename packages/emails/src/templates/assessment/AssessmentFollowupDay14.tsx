import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type AssessmentFollowupDay14Props = {
  name: string;
  expirationDate: string;
  openGapsCount: number;
  url: string;
};

export const AssessmentFollowupDay14 = ({
  name = 'Jane',
  expirationDate = 'October 30, 2026',
  openGapsCount = 5,
  url = 'https://app.example.com/pricing'
}: AssessmentFollowupDay14Props) => {
  return (
    <Layout previewText="Upgrade to keep your compliance dashboard active">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your free GDPR assessment expires on {expirationDate}. After that, your results and action items will no longer be accessible.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        To keep your compliance workspace active and start fixing your {openGapsCount} open issues, upgrade to Privaro Starter — €39/month with a 14-day free trial.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Start free trial →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        No commitment — cancel anytime during the trial.
      </Text>
    </Layout>
  );
};

export default AssessmentFollowupDay14;
