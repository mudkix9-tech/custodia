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
  
  // Group findings by category
  const categoriesMap = new Map<string, { scoreTotal: number; count: number; items: any[] }>();

  answersWithTemplates.forEach(a => {
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
  const actionItems = answersWithTemplates
    .filter(a => a.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore) // Sort by highest risk
    .map(a => {
      return {
        title: `Address gap in ${a.category || 'General'}`,
        description: `Response "${a.selectedOption}" to "${a.questionText || a.questionId}" indicates a compliance gap.`,
        severity: a.riskScore >= 7 ? 'High' : a.riskScore >= 4 ? 'Medium' : 'Low',
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
