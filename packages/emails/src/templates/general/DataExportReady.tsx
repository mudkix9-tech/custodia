import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type DataExportReadyProps = {
  userName: string;
  exportType: string;
  url: string;
};

export const DataExportReady = ({
  userName = 'Jane',
  exportType = 'Workspace Data Export',
  url = 'https://app.example.com/settings/export/download/123'
}: DataExportReadyProps) => {
  return (
    <Layout previewText="Your data export is ready to download">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your requested <strong>{exportType}</strong> is now ready to download.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Download Data Export</Button>
      </div>

      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        For security reasons, this download link will expire in 24 hours.
      </Text>
    </Layout>
  );
};

export default DataExportReady;
