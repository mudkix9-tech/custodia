import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type TrainingAssignedProps = {
  userName: string;
  courseName: string;
  dueDate: string;
  url: string;
};

export const TrainingAssigned = ({
  userName = 'Jane',
  courseName = 'GDPR Basics for Employees',
  dueDate = 'November 15, 2026',
  url = 'https://app.example.com/training/123'
}: TrainingAssignedProps) => {
  return (
    <Layout previewText={`New training assigned: ${courseName}`}>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        You have been assigned a new compliance training course: <strong>{courseName}</strong>.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Please complete this mandatory training by <strong>{dueDate}</strong> to ensure our organization remains compliant with data protection regulations.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Start Training →</Button>
      </div>
    </Layout>
  );
};

export default TrainingAssigned;
