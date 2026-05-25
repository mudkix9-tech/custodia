import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type QuarterlyReportProps = {
  quarter: string;
  year: string;
  score: number;
  scoreChange: number;
  url: string;
};

export const QuarterlyReport = ({
  quarter = 'Q3',
  year = '2026',
  score = 75,
  scoreChange = 12,
  url = 'https://app.example.com/reports'
}: QuarterlyReportProps) => {
  const isPositiveChange = scoreChange >= 0;

  return (
    <Layout previewText={`Your quarterly compliance review for ${quarter} ${year} is ready`}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Quarterly Compliance Review — {quarter} {year}
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your comprehensive quarterly compliance report is now available for review.
      </Text>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Text style={{ fontSize: '32px', fontWeight: 'bold', color: BRAND.primaryColor, margin: '0 0 8px' }}>
          {score}%
        </Text>
        <Text style={{ fontSize: '16px', color: isPositiveChange ? BRAND.successColor : BRAND.criticalColor, margin: '0' }}>
          {isPositiveChange ? 'Up' : 'Down'} {Math.abs(scoreChange)} points since last quarter
        </Text>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        This report is ideal for sharing with your management team or board of directors to demonstrate your organization's commitment to data protection.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Download Report PDF →</Button>
      </div>
    </Layout>
  );
};

export default QuarterlyReport;
