import { describe, test, expect } from 'vitest';

// Mimics the backend scoring logic in submitAssessmentResponses
function calculateBaseScore(questions: any[], responses: Record<string, string>): number {
  let earnedPoints = 0;
  let maxPoints = 0;

  for (const q of questions) {
    const answer = responses[q.id];
    const maxQScore = Math.max(...(q.options || []).map((o: any) => o.score || 0));
    maxPoints += maxQScore;

    if (answer) {
      const selected = (q.options || []).find((o: any) => o.text === answer);
      if (selected) {
        earnedPoints += selected.score || 0;
      }
    }
  }

  return maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
}

// Mimics the risk modifier mapping logic in updateVendorRiskScore
function calculateRiskModifier(status: string, score: number | null, aiAdjustment: number): number {
  if (status === 'completed') {
    const baseVal = score || 0;
    const finalQScore = Math.max(0, Math.min(100, baseVal + aiAdjustment));
    
    if (finalQScore >= 50) {
      return Math.round(-10 * ((finalQScore - 50) / 50)) || 0;
    } else {
      return Math.round(25 * ((50 - finalQScore) / 50)) || 0;
    }
  } else if (status === 'expired') {
    return 25;
  }
  return 0;
}

const MOCK_QUESTIONS = [
  {
    id: "q1",
    options: [
      { text: "Fully Compliant", score: 10 },
      { text: "Partial", score: 5 },
      { text: "None", score: 0 }
    ]
  },
  {
    id: "q2",
    options: [
      { text: "Yes", score: 5 },
      { text: "No", score: 0 }
    ]
  }
];

describe('Assessment Questionnaire Scoring Math', () => {
  test('should calculate 100% when all answers are fully compliant', () => {
    const responses = { q1: "Fully Compliant", q2: "Yes" };
    const baseScore = calculateBaseScore(MOCK_QUESTIONS, responses);
    expect(baseScore).toBe(100);
  });

  test('should calculate 0% when all answers are non-compliant', () => {
    const responses = { q1: "None", q2: "No" };
    const baseScore = calculateBaseScore(MOCK_QUESTIONS, responses);
    expect(baseScore).toBe(0);
  });

  test('should calculate partial percentage correctly', () => {
    const responses = { q1: "Partial", q2: "No" }; // 5 out of 15 (10+5) points
    const baseScore = calculateBaseScore(MOCK_QUESTIONS, responses);
    expect(baseScore).toBe(33); // 5/15 = 33.333% -> 33
  });

  test('should ignore missing answers and count them as 0 points', () => {
    const responses = { q1: "Partial" }; // q2 not answered, so 5 out of 15 points
    const baseScore = calculateBaseScore(MOCK_QUESTIONS, responses);
    expect(baseScore).toBe(33);
  });
});

describe('Risk Score Modifier Bounds Mapping', () => {
  test('should reduce risk score by 10 points when final questionnaire score is 100', () => {
    const modifier = calculateRiskModifier('completed', 100, 0);
    expect(modifier).toBe(-10);
  });

  test('should reduce risk score by 5 points when final questionnaire score is 75', () => {
    const modifier = calculateRiskModifier('completed', 75, 0);
    expect(modifier).toBe(-5);
  });

  test('should result in 0 modifier when final questionnaire score is exactly 50', () => {
    const modifier = calculateRiskModifier('completed', 50, 0);
    expect(modifier).toBe(0);
  });

  test('should increase risk score by 25 points when final questionnaire score is 0', () => {
    const modifier = calculateRiskModifier('completed', 0, 0);
    expect(modifier).toBe(25);
  });

  test('should increase risk score by 13 points when final questionnaire score is 25', () => {
    const modifier = calculateRiskModifier('completed', 25, 0);
    expect(modifier).toBe(13); // 25 * (25 / 50) = 12.5 -> 13
  });

  test('should layer AI adjustment penalty (e.g. -20) on top of base score and recalculate modifier', () => {
    // Base score is 80, but AI penalty is -20 -> final score is 60
    // Modifier for 60 is Math.round(-10 * ((60 - 50) / 50)) = -2
    const modifier = calculateRiskModifier('completed', 80, -20);
    expect(modifier).toBe(-2);
  });

  test('should clamp final score to 0 when AI penalty exceeds base score', () => {
    // Base score is 10, AI penalty is -20 -> final score is clamped to 0
    // Modifier for 0 is +25
    const modifier = calculateRiskModifier('completed', 10, -20);
    expect(modifier).toBe(25);
  });

  test('should apply strict +25 penalty when vendor assessment status is expired', () => {
    const modifier = calculateRiskModifier('expired', null, 0);
    expect(modifier).toBe(25);
  });
});
