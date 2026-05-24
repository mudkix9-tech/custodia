import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type AssessmentFollowupDay3Props = {
  name: string;
  score: number;
  openGapsCount: number;
  criticalGapTitle: string;
  criticalGapExplanation: string;
  url: string;
};

export const AssessmentFollowupDay3 = ({
  name = 'Jane',
  score = 34,
  openGapsCount = 5,
  criticalGapTitle = 'Missing Data Processing Agreements',
  criticalGapExplanation = 'You share personal data with 3 vendors without a valid DPA in place.',
  url = 'https://app.example.com/gaps'
}: AssessmentFollowupDay3Props) => {
  return (
    <Layout previewText={`${openGapsCount} compliance issues need attention`}>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        3 days ago you completed a GDPR assessment and scored {score}%. Since then, nothing has changed — your {openGapsCount} compliance gaps are still open.
      </Text>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        The most critical issue:
      </Text>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '8px' }}>
          <Text style={{ fontSize: '15px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 8px' }}>
            {criticalGapTitle}
          </Text>
          <Badge status="critical">Critical</Badge>
        </div>
        <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
          {criticalGapExplanation}
        </Text>
      </Card>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Most agencies fix this in under 10 minutes with Privaro.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Fix your compliance gaps →</Button>
      </div>
    </Layout>
  );
};

export default AssessmentFollowupDay3;
