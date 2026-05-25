import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { BRAND } from '../../constants';

type DsarAcknowledgmentProps = {
  subjectName: string;
  requestType: string;
  referenceNumber: string;
  orgName: string;
  orgLogo?: string;
};

export const DsarAcknowledgment = ({
  subjectName = 'John Doe',
  requestType = 'Right to Erasure',
  referenceNumber = 'DSAR-2026-0042',
  orgName = 'Acme Corp',
  orgLogo
}: DsarAcknowledgmentProps) => {
  return (
    <Layout
      previewText={`Reference: [${referenceNumber}] — we'll respond within 30 days`}
      orgName={orgName}
      orgLogo={orgLogo}
    >
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Dear {subjectName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We have received your {requestType} request and assigned it reference number <strong>{referenceNumber}</strong>.
      </Text>

      <Text style={{ fontSize: '16px', fontWeight: 'bold', color: BRAND.textPrimary, margin: '0 0 16px' }}>
        What happens next:
      </Text>

      <ul style={{ margin: '0 0 24px', paddingLeft: '20px', color: BRAND.textPrimary, fontSize: '15px' }}>
        <li style={{ marginBottom: '8px' }}>We will verify your identity</li>
        <li style={{ marginBottom: '8px' }}>We will search our systems for your data</li>
        <li style={{ marginBottom: '8px' }}>We will respond within 30 days of receipt</li>
      </ul>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        If you have questions, reply to this email.
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

export default DsarAcknowledgment;
