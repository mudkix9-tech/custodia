import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type TeamInvitationProps = {
  inviterName: string;
  orgName: string;
  role: string;
  url: string;
};

export const TeamInvitation = ({
  inviterName = 'Jane Doe',
  orgName = 'Acme Corp',
  role = 'admin',
  url = 'https://app.example.com/invite/123'
}: TeamInvitationProps) => {
  return (
    <Layout previewText={`${inviterName} invited you to manage GDPR compliance`}>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi,
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        <strong>{inviterName}</strong> invited you to join <strong>{orgName}</strong> on Custodia as a <strong>{role}</strong>.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Custodia is a GDPR compliance platform that helps your team manage data protection, vendor tracking, and regulatory requirements.
      </Text>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Accept Invitation</Button>
      </div>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        This invitation expires in 7 days.
      </Text>
    </Layout>
  );
};

export default TeamInvitation;
