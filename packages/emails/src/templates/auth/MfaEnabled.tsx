import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { BRAND } from '../../constants';

type MfaEnabledProps = {
  time: string;
};

export const MfaEnabled = ({
  time = new Date().toLocaleString()
}: MfaEnabledProps) => {
  return (
    <Layout previewText="Two-factor authentication has been enabled">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi,
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Two-factor authentication was successfully enabled for your Custodia account on {time}.
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Your account is now more secure. You will be required to enter a code from your authenticator app when signing in.
      </Text>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        If you did not make this change, please contact support immediately.
      </Text>
    </Layout>
  );
};

export default MfaEnabled;
