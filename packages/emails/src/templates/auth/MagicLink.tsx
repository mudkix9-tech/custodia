import React from 'react';
import { Text } from '@react-email/components';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { BRAND } from '../../constants';

type MagicLinkProps = {
  url: string;
};

export const MagicLink = ({ url = 'https://app.example.com/api/auth/callback/email?token=123' }: MagicLinkProps) => {
  return (
    <Layout previewText="Click to sign in — link expires in 10 minutes">
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 20px' }}>
        Hi,
      </Text>
      <Text style={{ fontSize: '16px', color: BRAND.textPrimary, margin: '0 0 24px' }}>
        Click the button below to sign in to Privaro.
      </Text>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={url}>Sign in to Privaro</Button>
      </div>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0 0 20px' }}>
        This link expires in 10 minutes.
      </Text>
      <Text style={{ fontSize: '14px', color: BRAND.textSecondary, margin: '0' }}>
        If you didn't request this, you can safely ignore this email.
      </Text>
    </Layout>
  );
};

export default MagicLink;
