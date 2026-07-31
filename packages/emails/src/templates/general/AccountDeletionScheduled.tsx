import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type AccountDeletionScheduledProps = {
  userName: string;
  deletionDate: string;
  url: string;
};

export const AccountDeletionScheduled = ({
  userName = 'Jane',
  deletionDate = 'November 1, 2026',
  url = 'https://app.example.com/settings/account'
}: AccountDeletionScheduledProps) => {
  return (
    <Layout previewText="Your account deletion has been scheduled">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="warning">DELETION SCHEDULED</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We've received your request to delete your Custodia account and all associated data.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Your account is scheduled for permanent deletion on <strong>{deletionDate}</strong>. After this date, your data cannot be recovered.
      </Text>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url} variant="secondary">Cancel Deletion</Button>
      </div>
    </Layout>
  );
};

export default AccountDeletionScheduled;
