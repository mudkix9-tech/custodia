import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRiskCalculator } from '../useRiskCalculator';
import { CalculatorQuestion } from '@/types/marketing';

const TEST_QUESTIONS: CalculatorQuestion[] = [
  {
    id: 'jurisdiction',
    text: 'Test Jurisdiction',
    options: [
      { text: 'EU', value: 'eu', score: 30 },
      { text: 'US', value: 'us', score: 5 }
    ]
  },
  {
    id: 'ropa',
    text: 'Test ROPA',
    options: [
      { text: 'Yes', value: 'yes', score: 0 },
      { text: 'No', value: 'no', score: 35 }
    ]
  }
];

describe('useRiskCalculator Scoring Engine & State', () => {
  beforeEach(() => {
    localStorage.clear();
    // Mock window.location.search
    vi.stubGlobal('location', {
      search: '',
      origin: 'http://localhost:3000',
      pathname: '/'
    });
  });

  test('should initialize with default low risk values', () => {
    const { result } = renderHook(() => useRiskCalculator(TEST_QUESTIONS));

    expect(result.current.calcStep).toBe(0);
    expect(result.current.calcAnswers).toEqual({});
    expect(result.current.totalRiskScore).toBe(0);
    expect(result.current.riskLevel).toBe('LOW');
  });

  test('should accumulate scores and advance steps on selection', () => {
    const { result } = renderHook(() => useRiskCalculator(TEST_QUESTIONS));

    act(() => {
      result.current.handleCalculatorSelect('jurisdiction', 'eu', 30);
    });

    expect(result.current.calcStep).toBe(1);
    expect(result.current.calcAnswers.jurisdiction).toBe('eu');
    expect(result.current.totalRiskScore).toBe(30);
    expect(result.current.riskLevel).toBe('MEDIUM'); // 20 <= 30 < 45 is MEDIUM
  });

  test('should correctly classify risk levels based on total score thresholds', () => {
    const { result } = renderHook(() => useRiskCalculator(TEST_QUESTIONS));

    // Select high-risk answers to cross high risk threshold (>= 45)
    act(() => {
      result.current.handleCalculatorSelect('jurisdiction', 'eu', 30);
    });
    act(() => {
      result.current.handleCalculatorSelect('ropa', 'no', 35);
    });

    expect(result.current.calcStep).toBe(2); // Completed
    expect(result.current.totalRiskScore).toBe(65);
    expect(result.current.riskLevel).toBe('HIGH');
  });

  test('should reset state correctly', () => {
    const { result } = renderHook(() => useRiskCalculator(TEST_QUESTIONS));

    act(() => {
      result.current.handleCalculatorSelect('jurisdiction', 'eu', 30);
    });
    expect(result.current.calcStep).toBe(1);

    act(() => {
      result.current.resetCalculator();
    });

    expect(result.current.calcStep).toBe(0);
    expect(result.current.calcAnswers).toEqual({});
    expect(result.current.totalRiskScore).toBe(0);
  });
});
