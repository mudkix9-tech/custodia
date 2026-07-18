import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type AssessmentReminderProps = {
  orgName: string;
  vendorName: string;
  recipientName: string;
  url: string;
  daysRemaining: number;
};

export const AssessmentReminder = ({
  orgName = 'Acme Corp',
  vendorName = 'Mailchimp',
  recipientName = 'Security Team',
  url = 'https://app.privaro.io/public/assessments/token-uuid',
  daysRemaining = 7
}: AssessmentReminderProps) => {
  return (
    <Layout previewText={`Reminder: Pending Compliance Assessment for ${orgName}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">ASSESSMENT REMINDER</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Compliance Assessment Outstanding
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hello {recipientName || 'Team'},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        This is a friendly reminder that the security and privacy assessment requested by <strong>{orgName}</strong> is still outstanding.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Please complete the questionnaire using the secure link below to ensure your vendor profile remains in compliance:
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '24px' }}>
        <Button href={url}>Complete Compliance Assessment →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0 0 24px' }}>
        Your review link is valid for approximately <strong>{daysRemaining}</strong> more day{daysRemaining === 1 ? '' : 's'}.
      </Text>
    </Layout>
  );
};

export default AssessmentReminder;
