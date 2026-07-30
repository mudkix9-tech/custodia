export interface AssessmentReportData {
  organizationName: string;
  reportDate: string;
  overallScore: number;
  riskLevel: string;
  categories: { name: string; score: number; risk: string; }[];
  findings: { categoryName: string; items: { question: string; answer: string; riskScore: number; risk: string; }[]; }[];
  actionItems: { title: string; description: string; severity: string; article: string; }[];
}
export function buildAssessmentReportData(
  orgName: string,
  overallScore: number,
  answersWithTemplates: any[]
): AssessmentReportData {
  const riskLevel = overallScore < 50 ? 'High' : overallScore <= 75 ? 'Moderate' : 'Low';
  
  const categoriesMap = new Map<string, { scoreTotal: number; count: number; items: any[] }>();
  
  // Pre-processing filter: Evaluate dependsOn conditions
  const answerMap = new Map(answersWithTemplates.map(a => [a.questionId, a.selectedOption]));
  const validAnswers = answersWithTemplates.filter(a => {
    if (!a.dependsOn || !a.dependsOn.conditions || !Array.isArray(a.dependsOn.conditions)) return true;
    
    // Check all conditions
    return a.dependsOn.conditions.every((cond: any) => {
      const dependentAnswer = answerMap.get(cond.questionId);
      return dependentAnswer === cond.answerEquals;
    });
  });

  validAnswers.forEach(a => {
    const cat = a.category || 'General';
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, { scoreTotal: 0, count: 0, items: [] });
    }
    const catData = categoriesMap.get(cat)!;
    
    // Risk score is 0-10 where 10 is high risk. We need a compliance score (0-100%).
    // Assuming riskScore 10 = 0% compliance, 0 = 100% compliance.
    const complianceScore = 100 - (a.riskScore * 10);
    catData.scoreTotal += Math.max(0, Math.min(100, complianceScore));
    catData.count++;
    
    catData.items.push({
      question: a.questionText || a.questionId,
      answer: a.selectedOption,
      riskScore: complianceScore,
      risk: complianceScore < 50 ? 'High' : complianceScore <= 75 ? 'Moderate' : 'Low'
    });
  });

  const categories: any[] = [];
  const findings: any[] = [];

  categoriesMap.forEach((val, key) => {
    const catScore = Math.round(val.scoreTotal / val.count) || 0;
    categories.push({
      name: key,
      score: catScore,
      risk: catScore < 50 ? 'High risk' : catScore <= 75 ? 'Moderate risk' : 'Low risk'
    });
    
    findings.push({
      categoryName: key,
      items: val.items
    });
  });

  // Action Items (derived from high risk answers)
  const actionItems = validAnswers
    .filter(a => a.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore) // Sort by highest risk
    .map(a => {
      return {
        title: `Address gap in ${a.category || 'General'}`,
        description: a.remediationGuidance || `Response "${a.selectedOption}" to "${a.questionText || a.questionId}" indicates a compliance gap.`,
        severity: a.riskScore >= 7 ? 'High' : a.riskScore >= 4 ? 'Medium' : 'Low',
        category: a.category,
        article: Array.isArray(a.gdprArticles) && a.gdprArticles.length > 0 
          ? `Art. ${a.gdprArticles.join(', ')}` 
          : '-'
      };
    });

  return {
    organizationName: orgName,
    reportDate: new Date().toLocaleDateString(),
    overallScore,
    riskLevel,
    categories,
    findings,
    actionItems
  };
}
