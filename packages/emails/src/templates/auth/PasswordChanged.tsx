import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { BRAND } from '../../constants';

type PasswordChangedProps = {
  time: string;
  ipAddress: string;
};

export const PasswordChanged = ({
  time = new Date().toLocaleString(),
  ipAddress = '192.168.1.1'
}: PasswordChangedProps) => {
  return (
    <Layout previewText="Your password has been changed successfully">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi,
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your password for your Privaro account was successfully changed on {time} from IP address {ipAddress}.
      </Text>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        If you did not make this change, please contact support immediately.
      </Text>
    </Layout>
  );
};

export default PasswordChanged;
