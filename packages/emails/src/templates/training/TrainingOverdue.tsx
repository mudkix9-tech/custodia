import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type TrainingOverdueProps = {
  userName: string;
  courseName: string;
  dueDate: string;
  url: string;
};

export const TrainingOverdue = ({
  userName = 'Jane',
  courseName = 'GDPR Basics for Employees',
  dueDate = 'November 15, 2026',
  url = 'https://app.example.com/training/123'
}: TrainingOverdueProps) => {
  return (
    <Layout previewText={`OVERDUE: Mandatory training - ${courseName}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="critical">OVERDUE</Badge>
      </div>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your mandatory compliance training course, <strong>{courseName}</strong>, is now overdue. It was due on <strong>{dueDate}</strong>.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Please complete this training immediately to ensure our organization meets its regulatory obligations.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Complete Training Immediately →</Button>
      </div>
    </Layout>
  );
};

export default TrainingOverdue;
