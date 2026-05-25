import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type ScoreDroppedProps = {
  previousScore: number;
  currentScore: number;
  reason: string;
  url: string;
};

export const ScoreDropped = ({
  previousScore = 85,
  currentScore = 72,
  reason = 'Multiple Data Processing Agreements expired recently.',
  url = 'https://app.example.com/dashboard'
}: ScoreDroppedProps) => {
  const drop = previousScore - currentScore;

  return (
    <Layout previewText={`Alert: Your compliance score dropped by ${drop} points`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">SCORE DROP ALERT</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        Compliance Score Decrease
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your organization's GDPR compliance score has recently dropped from <strong>{previousScore}%</strong> to <strong>{currentScore}%</strong>.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Primary reason for this change:
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px', fontStyle: 'italic', backgroundColor: '#FAFAFA', padding: '16px', borderRadius: '6px' }}>
        {reason}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Please log in to your dashboard to review the new gaps and take corrective action.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Review Dashboard →</Button>
      </div>
    </Layout>
  );
};

export default ScoreDropped;
