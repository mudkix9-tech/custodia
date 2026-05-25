import React from 'react';
import { BRAND } from '../constants';

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const style = variant === 'primary'
    ? { backgroundColor: BRAND.primaryColor, color: '#ffffff', border: '1px solid transparent' }
    : { backgroundColor: 'transparent', color: BRAND.primaryColor, border: `1px solid ${BRAND.primaryColor}` };

  return (
    <a href={href} style={{
      display: 'inline-block',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 600,
      textDecoration: 'none',
      textAlign: 'center',
      ...style,
    }}>
      {children}
    </a>
  );
}
