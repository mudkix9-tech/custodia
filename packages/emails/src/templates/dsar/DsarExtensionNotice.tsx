import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { BRAND } from '../../constants';

type DsarExtensionNoticeProps = {
  subjectName: string;
  referenceNumber: string;
  newDueDate: string;
  reason: string;
  orgName: string;
  orgLogo?: string;
};

export const DsarExtensionNotice = ({
  subjectName = 'John Doe',
  referenceNumber = 'DSAR-2026-0042',
  newDueDate = 'November 15, 2026',
  reason = 'the complexity and number of requests we are currently processing',
  orgName = 'Acme Corp',
  orgLogo
}: DsarExtensionNoticeProps) => {
  return (
    <Layout
      previewText="Notice of timeline extension for your data request"
      orgName={orgName}
      orgLogo={orgLogo}
    >
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Dear {subjectName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We are writing to inform you about the status of your data request ({referenceNumber}).
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Under GDPR Article 12(3), we are permitted to extend the standard 30-day response timeframe by an additional two months when necessary.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        We are exercising this extension due to {reason}. We now expect to provide a full response no later than <strong>{newDueDate}</strong>.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        We appreciate your patience. If you have any questions, please reply directly to this email.
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

export default DsarExtensionNotice;
