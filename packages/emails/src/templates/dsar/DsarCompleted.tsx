import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type DsarCompletedProps = {
  subjectName: string;
  referenceNumber: string;
  orgName: string;
  orgLogo?: string;
  downloadUrl?: string;
};

export const DsarCompleted = ({
  subjectName = 'John Doe',
  referenceNumber = 'DSAR-2026-0042',
  orgName = 'Acme Corp',
  orgLogo,
  downloadUrl
}: DsarCompletedProps) => {
  return (
    <Layout
      previewText="Your data request has been completed"
      orgName={orgName}
      orgLogo={orgLogo}
    >
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Dear {subjectName},
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We have completed processing your data request ({referenceNumber}).
      </Text>

      {downloadUrl && (
        <div style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={downloadUrl}>Download Your Data</Button>
          <Text style={{ fontSize: '14px', color: BRAND.textSecondary, marginTop: '12px' }}>
            This link will expire in 7 days for security reasons.
          </Text>
        </div>
      )}

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        If you have any questions or concerns regarding this response, please reply directly to this email.
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

export default DsarCompleted;
