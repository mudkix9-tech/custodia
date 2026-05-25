import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type TrainingCompletedProps = {
  userName: string;
  courseName: string;
  completionDate: string;
  url: string;
};

export const TrainingCompleted = ({
  userName = 'Jane',
  courseName = 'GDPR Basics for Employees',
  completionDate = 'November 10, 2026',
  url = 'https://app.example.com/training/certificates/123'
}: TrainingCompletedProps) => {
  return (
    <Layout previewText={`Certificate available: ${courseName}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="success">COMPLETED</Badge>
      </div>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Thank you for completing the <strong>{courseName}</strong> course on {completionDate}.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Your completion certificate is now available. You can download it for your records.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Download Certificate →</Button>
      </div>
    </Layout>
  );
};

export default TrainingCompleted;
