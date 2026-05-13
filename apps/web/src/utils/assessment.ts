export type Condition = {
  questionId: string;
  answerEquals?: string;
  answerNotEquals?: string;
};

export type DependsOn = {
  conditions: Condition[];
  logic: 'AND' | 'OR';
};

export function evaluateDependsOn(dependsOn: DependsOn | null | undefined, answers: Record<string, any>): boolean {
  if (!dependsOn || !dependsOn.conditions || dependsOn.conditions.length === 0) {
    return true; // No dependencies = always show
  }

  const results = dependsOn.conditions.map(condition => {
    const userAnswer = answers[condition.questionId]?.text;
    
    // If the required question hasn't been answered yet, we probably shouldn't show this question yet
    // Wait, if it hasn't been answered, does it equal the condition? No.
    if (userAnswer === undefined) return false;

    if (condition.answerEquals !== undefined) {
      return userAnswer === condition.answerEquals;
    }
    if (condition.answerNotEquals !== undefined) {
      return userAnswer !== condition.answerNotEquals;
    }
    
    return true;
  });

  if (dependsOn.logic === 'OR') {
    return results.some(r => r === true);
  }
  
  // Default to AND
  return results.every(r => r === true);
}
