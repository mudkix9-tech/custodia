import React from 'react';
import { Row, Column, Text } from '@react-email/components';
import { BRAND } from '../constants';

type MetricRowProps = {
  label: string;
  value: string | React.ReactNode;
};

export function MetricRow({ label, value }: MetricRowProps) {
  return (
    <Row style={{ marginBottom: '8px' }}>
      <Column style={{ width: '40%' }}>
        <Text style={{ margin: 0, color: BRAND.textSecondary, fontSize: '14px' }}>
          {label}
        </Text>
      </Column>
      <Column>
        <Text style={{ margin: 0, color: BRAND.textPrimary, fontSize: '14px', fontWeight: 500 }}>
          {value}
        </Text>
      </Column>
    </Row>
  );
}
