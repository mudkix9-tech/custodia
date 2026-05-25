import React from 'react';
import { Section } from '@react-email/components';
import { BRAND } from '../constants';

type CardProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export function Card({ children, style }: CardProps) {
  return (
    <Section style={{
      padding: '16px',
      backgroundColor: '#FAFAFA',
      borderRadius: '6px',
      border: `1px solid ${BRAND.borderColor}`,
      ...style
    }}>
      {children}
    </Section>
  );
}
