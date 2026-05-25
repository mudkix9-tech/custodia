import React from 'react';
import { Text, Link } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type CategoryScore = {
  name: string;
  score: number;
};

type Gap = {
  title: string;
  severity: string;
  url: string;
};

type MonthlyReportProps = {
  monthYear: string;
  score: number;
  scoreChange: number;
  openGapsCount: number;
  categories: CategoryScore[];
  topGaps: Gap[];
  url: string;
};

export const MonthlyReport = ({
  monthYear = 'October 2026',
  score = 72,
  scoreChange = 5,
  openGapsCount = 3,
  categories = [
    { name: 'ROPA', score: 85 },
    { name: 'Vendors', score: 54 },
    { name: 'Policies', score: 90 },
    { name: 'DSARs', score: 100 },
    { name: 'Training', score: 45 }
  ],
  topGaps = [
    { title: 'Mailchimp DPA expired', severity: 'Critical', url: 'https://app.example.com/gaps/1' },
    { title: '2 team members overdue on training', severity: 'High', url: 'https://app.example.com/gaps/2' },
    { title: 'Privacy policy out of sync', severity: 'Medium', url: 'https://app.example.com/gaps/3' }
  ],
  url = 'https://app.example.com/reports'
}: MonthlyReportProps) => {
  const isPositiveChange = scoreChange >= 0;

  const renderProgressBar = (value: number) => {
    const filled = Math.round(value / 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${value}%`;
  };

  return (
    <Layout previewText={`Score: ${score}% (${isPositiveChange ? '+' : ''}${scoreChange} from last month) — ${openGapsCount} open gaps`}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Compliance Summary — {monthYear}
      </Text>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Text style={{ fontSize: '24px', fontWeight: 'bold', color: BRAND.primaryColor, margin: '0 12px 0 0' }}>
          Score: {score}%
        </Text>
        <Text style={{ fontSize: '16px', color: isPositiveChange ? BRAND.successColor : BRAND.criticalColor, margin: '0' }}>
          Trend: {isPositiveChange ? '↑' : '↓'}{Math.abs(scoreChange)} points
        </Text>
      </div>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 12px' }}>
        Category breakdown:
      </Text>

      <div style={{ fontFamily: 'monospace', fontSize: '14px', marginBottom: '24px', backgroundColor: '#FAFAFA', padding: '16px', borderRadius: '6px' }}>
        {categories.map((cat, i) => (
          <div key={i} style={{ marginBottom: '8px' }}>
            <span style={{ display: 'inline-block', width: '90px' }}>{cat.name}:</span>
            <span>{renderProgressBar(cat.score)}</span>
          </div>
        ))}
      </div>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 12px' }}>
        Top {topGaps.length} open gaps:
      </Text>

      <div style={{ margin: '0 0 24px', paddingLeft: '20px' }}>
        {topGaps.map((gap, i) => (
          <Text key={i} style={{ fontSize: '15px', color: BRAND.textPrimary, margin: '0 0 8px' }}>
            {i + 1}. [{gap.severity}] "{gap.title}" — <Link href={gap.url} style={{ color: BRAND.primaryColor, fontWeight: 'bold' }}>Fix →</Link>
          </Text>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <Button href={url}>View Full Report →</Button>
      </div>
    </Layout>
  );
};

export default MonthlyReport;
