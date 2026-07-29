export interface AssessmentReportData {
  organizationName: string;
  reportDate: string;
  overallScore: number;
  riskLevel: string;
  answers: {
    questionText: string;
    selectedOption: string;
    riskScore: number;
  }[];
  actionItems: {
    title: string;
    description: string;
    severity: string;
  }[];
}

export function generateAssessmentReportHtml(data: AssessmentReportData): string {
  const getScoreColor = (score: number) => {
    if (score < 50) return '#EF4444'; // Red
    if (score <= 75) return '#F59E0B'; // Yellow
    return '#00A67E'; // Green
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return '<span style="background: #FEE2E2; color: #991B1B; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">HIGH</span>';
      case 'medium': return '<span style="background: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">MEDIUM</span>';
      default: return '<span style="background: #F3F4F6; color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">LOW</span>';
    }
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1c1917; line-height: 1.6; margin: 0; padding: 0; }
        h1 { color: #294036; border-bottom: 2px solid #294036; padding-bottom: 8px; font-size: 28px; }
        h2 { color: #294036; margin-top: 24px; font-size: 20px; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; }
        h3 { color: #294036; font-size: 16px; margin-bottom: 4px; }
        p { margin: 8px 0; font-size: 13px; }
        .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        .page-break { page-break-before: always; }
        .score-box { text-align: center; padding: 40px; border: 1px solid #e7e5e4; border-radius: 12px; margin: 40px 0; }
        .score-number { font-size: 72px; font-weight: bold; line-height: 1; margin: 20px 0; color: ${getScoreColor(data.overallScore)}; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #e7e5e4; padding: 10px 12px; text-align: left; vertical-align: top; }
        th { background-color: #f5f5f4; font-weight: 600; color: #44403c; }
        .item-card { border: 1px solid #e7e5e4; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>GDPR Gap Assessment Report</h1>
        <h2 style="border: none; font-size: 24px;">${data.organizationName}</h2>
        <p style="color: #78716c;">Generated on: ${data.reportDate}</p>
        
        <div class="score-box">
          <p style="text-transform: uppercase; letter-spacing: 1px; color: #78716c; font-weight: bold;">Overall Readiness Score</p>
          <div class="score-number">${data.overallScore}/100</div>
          <p>Risk Level: <strong>${data.riskLevel}</strong></p>
        </div>
      </div>
      
      <div class="page-break"></div>

      <h2>Action Items & Recommendations</h2>
      <p>Based on your assessment, we identified the following compliance gaps. Prioritize High severity items.</p>
      
      ${data.actionItems.length === 0 ? '<p>No critical action items identified.</p>' : ''}
      ${data.actionItems.map(item => `
        <div class="item-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h3 style="margin-top: 0;">${item.title}</h3>
            <div>${getSeverityBadge(item.severity)}</div>
          </div>
          <p style="color: #57534e; margin-bottom: 0;">${item.description}</p>
        </div>
      `).join('')}

      <div class="page-break"></div>

      <h2>Detailed Assessment Answers</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Question</th>
            <th style="width: 35%;">Selected Answer</th>
            <th style="width: 15%;">Risk Impact</th>
          </tr>
        </thead>
        <tbody>
          ${data.answers.map(ans => `
            <tr>
              <td><strong>${ans.questionText}</strong></td>
              <td>${ans.selectedOption}</td>
              <td style="color: ${ans.riskScore > 0 ? '#EF4444' : '#00A67E'}">${ans.riskScore > 0 ? '+' + ans.riskScore + ' Risk' : 'Low Risk'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
    </body>
    </html>
  `;
}
