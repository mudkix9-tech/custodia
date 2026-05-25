import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type DsarVerificationProps = {
  subjectName: string;
  referenceNumber: string;
  orgName: string;
  orgLogo?: string;
  verificationUrl: string;
};

export const DsarVerification = ({
  subjectName = 'John Doe',
  referenceNumber = 'DSAR-2026-0042',
  orgName = 'Acme Corp',
  orgLogo,
  verificationUrl = 'https://example.com/verify'
}: DsarVerificationProps) => {
  return (
    <Layout
      previewText="Please verify your identity to proceed with your data request"
      orgName={orgName}
      orgLogo={orgLogo}
    >
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Dear {subjectName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        To process your data request ({referenceNumber}), we need to securely verify your identity. This is a standard procedure to protect your personal data and ensure we are releasing it to the correct person.
      </Text>
      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={verificationUrl}>Verify Identity Securely</Button>
      </div>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0 0 24px' }}>
        Please note that the 30-day timeline to process your request begins once we have successfully verified your identity.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 4px' }}>
        Kind regards,
      </Text>
      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0' }}>
        {orgName}
      </Text>
    </Layout>
  );
};

export default DsarVerification;
