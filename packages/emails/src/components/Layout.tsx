import React from 'react';
import {
  Html, Head, Body, Container, Section,
  Img, Text, Link, Hr, Preview
} from '@react-email/components';
import { BRAND } from '../constants';

type LayoutProps = {
  previewText: string;
  children: React.ReactNode;
  orgName?: string;       // for emails sent on behalf of an org
  orgLogo?: string;       // white-label for DSAR comms
};

export function Layout({ previewText, children, orgName, orgLogo }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: BRAND.background, fontFamily: BRAND.fontFamily }}>
        <Container style={{ margin: '0 auto', padding: '20px 0 48px', maxWidth: '580px' }}>
          {/* Header */}
          <Section style={{ padding: '32px 20px', textAlign: 'center' as const }}>
            {orgLogo ? (
              <Img src={orgLogo} alt={orgName} height={32} style={{ margin: '0 auto' }} />
            ) : (
              <Img src={BRAND.logoUrl} alt="Privaro" height={28} style={{ margin: '0 auto' }} />
            )}
          </Section>

          {/* Content */}
          <Section style={{ padding: '32px', backgroundColor: BRAND.cardBackground, borderRadius: '8px', border: `1px solid ${BRAND.borderColor}` }}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={{ borderColor: BRAND.borderColor, margin: '32px 0 20px' }} />
          <Section style={{ textAlign: 'center' as const, padding: '0 20px' }}>
            <Text style={{ margin: '0 0 8px', color: BRAND.textSecondary, fontSize: '14px' }}>
              {orgName
                ? `Sent by ${orgName} via Privaro`
                : 'Sent by Privaro'
              }
            </Text>
            <Text style={{ margin: '0 0 8px', color: BRAND.textMuted, fontSize: '12px' }}>
              EU Hosted · AES-256 Encrypted · GDPR Compliant
            </Text>
            <Link href={BRAND.marketingUrl} style={{ color: BRAND.primaryColor, fontSize: '12px', textDecoration: 'underline' }}>
              [yourdomain].io
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
