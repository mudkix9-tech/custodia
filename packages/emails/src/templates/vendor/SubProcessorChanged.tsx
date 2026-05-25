import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type SubProcessorChangedProps = {
  vendorName: string;
  changeDetails: string;
  url: string;
};

export const SubProcessorChanged = ({
  vendorName = 'Mailchimp',
  changeDetails = 'Added AWS as a new sub-processor in the EU region.',
  url = 'https://app.example.com/vendors/123'
}: SubProcessorChangedProps) => {
  return (
    <Layout previewText={`${vendorName} has updated their list of sub-processors`}>
      <div style={{ marginBottom: '24px' }}>
        <Badge status="info">VENDOR UPDATE</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        <strong>{vendorName}</strong> has announced a change to their sub-processors.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px', fontStyle: 'italic' }}>
        "{changeDetails}"
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Under GDPR Article 28, you have the right to review and object to new sub-processors. Please review this change to ensure it aligns with your compliance requirements.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Review Changes →</Button>
      </div>
    </Layout>
  );
};

export default SubProcessorChanged;
