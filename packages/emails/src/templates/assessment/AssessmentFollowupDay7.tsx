import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type AssessmentFollowupDay7Props = {
  name: string;
  score: number;
  url: string;
};

export const AssessmentFollowupDay7 = ({
  name = 'Jane',
  score = 34,
  url = 'https://app.example.com/assessment/results'
}: AssessmentFollowupDay7Props) => {
  return (
    <Layout previewText="The average agency goes from 34% to 72% in their first month">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        A week ago you scored {score}% on your GDPR assessment. Agencies that use Privaro typically improve their score by 30-40 points in the first month.
      </Text>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        Here's what they do first:
      </Text>

      <div style={{ margin: '0 0 24px', paddingLeft: '20px' }}>
        <Text style={{ fontSize: '15px', color: BRAND.textPrimary, margin: '0 0 8px' }}>
          1. Document their top 5 processing activities (15 min)
        </Text>
        <Text style={{ fontSize: '15px', color: BRAND.textPrimary, margin: '0 0 8px' }}>
          2. Add their vendors and check DPA status (10 min)
        </Text>
        <Text style={{ fontSize: '15px', color: BRAND.textPrimary, margin: '0 0 8px' }}>
          3. Generate a privacy policy from their data (2 min)
        </Text>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Your assessment results are still available.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Continue where you left off →</Button>
      </div>
    </Layout>
  );
};

export default AssessmentFollowupDay7;
