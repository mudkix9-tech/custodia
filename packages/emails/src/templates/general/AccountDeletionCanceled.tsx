import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Badge } from '../../components/Badge';
import { BRAND } from '../../constants';

type AccountDeletionCanceledProps = {
  userName: string;
};

export const AccountDeletionCanceled = ({
  userName = 'Jane'
}: AccountDeletionCanceledProps) => {
  return (
    <Layout previewText="Your account deletion has been canceled">
      <div style={{ marginBottom: '24px' }}>
        <Badge status="success">DELETION CANCELED</Badge>
      </div>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi {userName},
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        We've successfully canceled the scheduled deletion of your Privaro account.
      </Text>

      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your account and all associated data will remain active and intact.
      </Text>
    </Layout>
  );
};

export default AccountDeletionCanceled;
