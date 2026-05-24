import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type GapDetectedProps = {
  gapTitle: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  url: string;
};

export const GapDetected = ({
  gapTitle = 'Missing Privacy Policy',
  severity = 'high',
  description = 'Your organization does not have a published privacy policy linked to your processing activities.',
  url = 'https://app.example.com/gaps/123'
}: GapDetectedProps) => {
  const badgeStatus = severity === 'critical' || severity === 'high' ? 'critical' : 'warning';

  return (
    <Layout previewText={`New compliance gap detected: ${gapTitle}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status={badgeStatus}>NEW GAP DETECTED</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        {gapTitle}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        A new compliance gap has been identified in your workspace.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px', fontStyle: 'italic' }}>
        {description}
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>View Gap Details →</Button>
      </div>
    </Layout>
  );
};

export default GapDetected;
