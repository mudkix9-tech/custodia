import React from 'react';
import { Hr } from '@react-email/components';
import { BRAND } from '../constants';

type DividerProps = {
  style?: React.CSSProperties;
};

export function Divider({ style }: DividerProps) {
  return (
    <Hr style={{
      borderColor: BRAND.borderColor,
      margin: '24px 0',
      ...style
    }} />
  );
}
