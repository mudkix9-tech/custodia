import React from 'react';
import { Text, Link } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type ActionItem = {
  title: string;
  url: string;
};

type WelcomeNewUserProps = {
  score: number;
  actionItems: ActionItem[];
  dashboardUrl: string;
};

export const WelcomeNewUser = ({
  score = 34,
  actionItems = [
    { title: 'Document your top 5 processing activities', url: 'https://app.example.com/ropa' },
    { title: 'Add your vendors and check DPA status', url: 'https://app.example.com/vendors' },
    { title: 'Generate a privacy policy from your data', url: 'https://app.example.com/policies' },
  ],
  dashboardUrl = 'https://app.example.com/dashboard'
}: WelcomeNewUserProps) => {
  return (
    <Layout previewText={`Your GDPR score is ${score}% — here's what to do next`}>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Welcome to Privaro,
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        You scored {score}% on your GDPR compliance assessment. Here's what that means:
      </Text>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Text style={{ fontSize: '24px', fontWeight: 'bold', color: BRAND.primaryColor, margin: '0' }}>
          Your score: {score}%
        </Text>
      </div>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        Your top {actionItems.length} priorities:
      </Text>

      <div style={{ margin: '0 0 32px', paddingLeft: '20px' }}>
        {actionItems.map((item, i) => (
          <Text key={i} style={{ fontSize: '15px', color: BRAND.textPrimary, margin: '0 0 12px' }}>
            {i + 1}. "{item.title}" — <Link href={item.url} style={{ color: BRAND.primaryColor, fontWeight: 'bold' }}>Fix this →</Link>
          </Text>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Button href={dashboardUrl}>Go to Dashboard</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        Need help getting started? Reply to this email — we read every message.
      </Text>
    </Layout>
  );
};

export default WelcomeNewUser;
