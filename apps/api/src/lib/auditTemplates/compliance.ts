import { escapeHtml, formatDate, severityBadge, renderHeader, renderFooter, wrapPage } from './shared.js';

type ComplianceReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  currentScore: number;
  categoryScores: Record<string, number>;
  scoreHistory: Array<{ date: Date; score: number }>;
  activeGaps: Array<{
    title: string;
    gapType: string;
    severity: string;
    entityType: string;
    firstDetectedAt: Date;
    detectionCount: number;
  }>;
  resolvedGaps30d: number;
  summary: {
    totalActiveGaps: number;
    criticalGaps: number;
    highGaps: number;
    mediumGaps: number;
  };
};

export function renderComplianceReportHtml(data: ComplianceReportData): string {
  const header = renderHeader(data.orgName, 'Compliance Posture Report', data.generatedAt, data.logoUrl);

  const scoreColor = data.currentScore >= 70 ? '#16A34A' : data.currentScore >= 40 ? '#D97706' : '#DC2626';

  const overview = `
    <div class="section">
      <div class="section-title">Overall Compliance Score</div>
      <div style="text-align:center; margin:24px 0;">
        <div style="font-size:64px; font-weight:800; color:${scoreColor}">${data.currentScore}%</div>
        <div style="font-size:12px; color:#666; margin-top:4px;">as of ${formatDate(data.generatedAt)}</div>
      </div>
    </div>
  `;

  const pillars = `
    <div class="section">
      <div class="section-title">Pillar Breakdown</div>
      <table>
        <tr><th>Category</th><th>Score</th><th>Weight</th></tr>
        ${Object.entries(data.categoryScores).map(([category, score]) => {
          const weights: Record<string, string> = { ropa: '25%', vendors: '20%', dpia: '15%', policies: '10%', dsar: '10%', breach: '5%', training: '10%', transfers: '5%' };
          return `<tr><td>${category.charAt(0).toUpperCase() + category.slice(1)}</td><td>${score}%</td><td>${weights[category] || '—'}</td></tr>`;
        }).join('')}
      </table>
    </div>
  `;

  const gaps = data.activeGaps.length > 0 ? `
    <div class="section">
      <div class="section-title">Active Compliance Gaps (${data.summary.totalActiveGaps})</div>
      <table>
        <tr><th>Issue</th><th>Type</th><th>Severity</th><th>Module</th><th>First Detected</th><th>Consecutive Detections</th></tr>
        ${data.activeGaps.map(g => `
          <tr>
            <td>${escapeHtml(g.title)}</td>
            <td>${escapeHtml(g.gapType)}</td>
            <td>${severityBadge(g.severity)}</td>
            <td>${escapeHtml(g.entityType)}</td>
            <td>${formatDate(g.firstDetectedAt)}</td>
            <td>${g.detectionCount}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  ` : '<div class="no-data">No active compliance gaps.</div>';

  const trend = data.scoreHistory.length > 1 ? `
    <div class="section">
      <div class="section-title">Score Trend</div>
      <table>
        <tr><th>Date</th><th>Score</th></tr>
        ${data.scoreHistory.map(s => `
          <tr><td>${formatDate(s.date)}</td><td>${s.score}%</td></tr>
        `).join('')}
      </table>
    </div>
  ` : '';

  const footer = renderFooter(data.orgName, 'Compliance Posture Report');
  return wrapPage(`${header}${overview}${pillars}${gaps}${trend}${footer}`);
}