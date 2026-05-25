import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type AssessmentResultsProps = {
  name: string;
  score: number;
  url: string;
};

export const AssessmentResults = ({
  name = 'Jane',
  score = 34,
  url = 'https://app.example.com/assessment/results'
}: AssessmentResultsProps) => {
  return (
    <Layout previewText={`Your GDPR assessment results are ready: ${score}%`}>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {name},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        You recently completed a GDPR assessment. Your overall compliance score is {score}%.
      </Text>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>View Full Results</Button>
      </div>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        Review your results to see detailed action items and improve your score.
      </Text>
    </Layout>
  );
};

export default AssessmentResults;
