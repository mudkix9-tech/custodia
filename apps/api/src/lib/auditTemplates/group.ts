import { escapeHtml, formatDate, severityBadge, renderHeader, renderFooter, wrapPage } from './shared.js';

type GroupExecutiveSummaryData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  complianceScores: {
    averageScore: number;
    worstScore: number;
    breakdown: Array<{
      id: string;
      name: string;
      slug: string;
      currentScore: number;
      previousScore: number;
      trend: 'up' | 'down' | 'flat';
    }>;
  };
  vendorConsistency: Array<{
    vendorId: string;
    vendorName: string;
    usedByCount: number;
    inconsistent: boolean;
    entityDetails: Array<{
      orgId: string;
      orgName: string;
      dpaStatus: string;
      riskScore: number;
      riskLevel: string;
    }>;
  }>;
};

export function renderGroupExecutiveSummaryHtml(data: GroupExecutiveSummaryData): string {
  const header = renderHeader(data.orgName, 'Group Executive Summary', data.generatedAt, data.logoUrl);

  const scoresOverview = `
    <div class="section">
      <div class="section-title">Compliance Score Rollup</div>
      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-label">Group Average Score</div>
          <div class="summary-value">${data.complianceScores.averageScore}%</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Group Worst Score</div>
          <div class="summary-value">${data.complianceScores.worstScore}%</div>
        </div>
      </div>
      <table style="margin-top: 16px;">
        <tr>
          <th>Entity Name</th>
          <th>Score</th>
          <th>Trend</th>
        </tr>
        ${data.complianceScores.breakdown.map(b => `
          <tr>
            <td>${escapeHtml(b.name)}</td>
            <td>${b.currentScore}%</td>
            <td>${
              b.trend === 'up' ? '<span style="color: #10B981;">↑</span>' :
              b.trend === 'down' ? '<span style="color: #EF4444;">↓</span>' :
              '<span style="color: #6B7280;">→</span>'
            }</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const vendorInconsistencies = data.vendorConsistency.filter(v => v.inconsistent);
  
  const vendorOverview = `
    <div class="section">
      <div class="section-title">Cross-Entity Vendor Inconsistencies</div>
      ${vendorInconsistencies.length === 0 ? '<div class="no-data">No cross-entity vendor inconsistencies detected.</div>' : `
        ${vendorInconsistencies.map(v => `
          <div style="margin-bottom:16px; padding:12px; background:#FAFAF8; border-radius:8px;">
            <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(v.vendorName)} (used by ${v.usedByCount} entities)</div>
            <table>
              <tr><th>Entity</th><th>DPA Status</th><th>Risk Level</th></tr>
              ${v.entityDetails.map(ed => `
                <tr>
                  <td>${escapeHtml(ed.orgName)}</td>
                  <td>${escapeHtml(ed.dpaStatus)}</td>
                  <td>${severityBadge(ed.riskLevel)}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        `).join('')}
      `}
    </div>
  `;

  const childOrgsNotice = `
    <div class="section">
      <div class="section-title">Child Entity Documentation</div>
      <div class="summary-text">
        Detailed compliance records (ROPA, vendor registers, DPIAs, etc.) for each child entity 
        are bundled in the accompanying <code>child_entities/</code> directory.
      </div>
    </div>
  `;

  const footer = renderFooter(data.orgName, 'Group Executive Summary');
  return wrapPage(`${header}${scoresOverview}${vendorOverview}${childOrgsNotice}${footer}`);
}
