export interface ExecutiveReportData {
  organizationName: string;
  reportDate: string;
  overallScore: number;
  industryAverage: number;
  topQuartile: number;
  trendData: { month: string; score: number }[];
  topRisks: string[];
  keyAchievements: string[];
  recommendedActions: string[];
}

export const generateExecutiveReportHtml = (data: ExecutiveReportData): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1c1917; line-height: 1.6; margin: 0; padding: 0; }
        .container { padding: 40px; }
        h1 { color: #294036; border-bottom: 2px solid #294036; padding-bottom: 12px; font-size: 32px; margin-bottom: 8px; }
        h2 { color: #294036; margin-top: 32px; font-size: 24px; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; }
        h3 { color: #44403c; margin-top: 24px; font-size: 18px; }
        .subtitle { font-size: 18px; color: #57534e; margin-bottom: 40px; }
        .score-card { background-color: #f5f5f4; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 32px; border: 1px solid #e7e5e4; }
        .score-value { font-size: 48px; font-weight: bold; color: #294036; }
        .score-label { font-size: 14px; color: #78716c; text-transform: uppercase; letter-spacing: 1px; }
        .benchmarks { display: flex; justify-content: center; gap: 40px; margin-top: 16px; }
        .benchmark-item { text-align: center; }
        .benchmark-value { font-size: 24px; font-weight: 600; color: #44403c; }
        .benchmark-label { font-size: 12px; color: #78716c; }
        .grid { display: flex; gap: 24px; margin-bottom: 32px; }
        .col { flex: 1; background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px; }
        ul { padding-left: 20px; margin-top: 8px; }
        li { margin-bottom: 8px; color: #44403c; }
        .trend-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
        .trend-table th, .trend-table td { border: 1px solid #e7e5e4; padding: 8px 12px; text-align: center; }
        .trend-table th { background-color: #f5f5f4; font-weight: 600; }
        .page-break { page-break-before: always; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #78716c; padding: 10px 0; border-top: 1px solid #e7e5e4; background: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Executive Compliance Summary</h1>
        <div class="subtitle">${data.organizationName} &bull; ${data.reportDate}</div>

        <div class="score-card">
          <div class="score-label">Overall Compliance Score</div>
          <div class="score-value">${data.overallScore}%</div>
          <div class="benchmarks">
            <div class="benchmark-item">
              <div class="benchmark-value">${data.industryAverage}%</div>
              <div class="benchmark-label">Industry Average</div>
            </div>
            <div class="benchmark-item">
              <div class="benchmark-value">${data.topQuartile}%</div>
              <div class="benchmark-label">Top Quartile</div>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col">
            <h3>Top Risks</h3>
            <ul>
              ${data.topRisks.length > 0 ? data.topRisks.map(r => `<li>${r}</li>`).join('') : '<li>No significant risks identified.</li>'}
            </ul>
          </div>
          <div class="col">
            <h3>Key Achievements</h3>
            <ul>
              ${data.keyAchievements.length > 0 ? data.keyAchievements.map(a => `<li>${a}</li>`).join('') : '<li>No achievements recorded for this period.</li>'}
            </ul>
          </div>
        </div>

        <h2>Compliance Trend (Last 6 Months)</h2>
        <table class="trend-table">
          <thead>
            <tr>
              ${data.trendData.map(t => `<th>${t.month}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${data.trendData.map(t => `<td>${t.score}%</td>`).join('')}
            </tr>
          </tbody>
        </table>

        <h2>Recommended Actions</h2>
        <ul>
          ${data.recommendedActions.length > 0 ? data.recommendedActions.map(ra => `<li>${ra}</li>`).join('') : '<li>Maintain current compliance posture.</li>'}
        </ul>
      </div>
    </body>
    </html>
  `;
};
