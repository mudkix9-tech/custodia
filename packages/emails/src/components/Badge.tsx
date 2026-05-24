import React from 'react';

type BadgeStatus = 'critical' | 'warning' | 'success' | 'info';

type BadgeProps = {
  status: BadgeStatus;
  children: React.ReactNode;
};

export function Badge({ status, children }: BadgeProps) {
  const colors = {
    critical: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    warning: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    success: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    info: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  };
  const c = colors[status] || colors.info;

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  );
}
