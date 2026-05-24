import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type TrainingDue7dProps = {
  userName: string;
  courseName: string;
  dueDate: string;
  url: string;
};

export const TrainingDue7d = ({
  userName = 'Jane',
  courseName = 'GDPR Basics for Employees',
  dueDate = 'November 15, 2026',
  url = 'https://app.example.com/training/123'
}: TrainingDue7dProps) => {
  return (
    <Layout previewText={`Reminder: Training due in 7 days - ${courseName}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">DUE IN 7 DAYS</Badge>
      </div>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        This is a reminder that your assigned compliance training course, <strong>{courseName}</strong>, is due in 7 days (on <strong>{dueDate}</strong>).
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Completing this training is a mandatory requirement for your role.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Complete Training Now →</Button>
      </div>
    </Layout>
  );
};

export default TrainingDue7d;
