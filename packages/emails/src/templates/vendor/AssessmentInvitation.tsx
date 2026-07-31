import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type AssessmentInvitationProps = {
  orgName: string;
  vendorName: string;
  recipientName: string;
  url: string;
  expiresAt: string;
};

export const AssessmentInvitation = ({
  orgName = 'Acme Corp',
  vendorName = 'Mailchimp',
  recipientName = 'Security Team',
  url = 'https://app.custodia.io/public/assessments/token-uuid',
  expiresAt = 'November 15, 2026'
}: AssessmentInvitationProps) => {
  return (
    <Layout previewText={`Security & GDPR Compliance Assessment Request from ${orgName}`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">COMPLIANCE ASSESSMENT REQUIRED</Badge>
      </div>

      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Security &amp; Privacy Assessment Request
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hello {recipientName || 'Team'},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        To complete our annual vendor compliance review under the GDPR, <strong>{orgName}</strong> requires <strong>{vendorName}</strong> to complete our security and privacy questionnaire.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Please complete the questionnaire at the link below. No login or account creation is required:
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '24px' }}>
        <Button href={url}>Complete Compliance Assessment →</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0 0 24px' }}>
        This assessment is requested to be completed by <strong>{expiresAt}</strong>.
      </Text>
    </Layout>
  );
};

export default AssessmentInvitation;
