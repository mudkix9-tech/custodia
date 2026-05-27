import { escapeHtml, formatDate, severityBadge, renderHeader, renderFooter, wrapPage } from './shared.js';

type DpiaReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  dpia: {
    title: string;
    description: string | null;
    status: string;
    processingDescription: string | null;
    necessityAssessment: string | null;
    proportionalityAssessment: string | null;
    overallRiskLevel: string | null;
    residualRiskLevel: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    risks: Array<{
      description: string;
      likelihood: number | null;
      severity: number | null;
      initialRiskScore: number | null;
      residualRiskScore: number | null;
      measures: Array<{
        description: string;
        status: string;
        implementedAt: Date | null;
      }>;
    }>;
    linkedActivities: string[];
  };
};

export function renderDpiaReportHtml(data: DpiaReportData): string {
  const header = renderHeader(data.orgName, `DPIA: ${data.dpia.title}`, data.generatedAt, data.logoUrl);

  const overview = `
    <div class="section">
      <div class="section-title">Assessment Overview</div>
      <table>
        <tr><th style="width:200px">Title</th><td>${escapeHtml(data.dpia.title)}</td></tr>
        <tr><th>Status</th><td>${escapeHtml(data.dpia.status)}</td></tr>
        <tr><th>Overall Risk</th><td>${data.dpia.overallRiskLevel ? severityBadge(data.dpia.overallRiskLevel) : '—'}</td></tr>
        <tr><th>Residual Risk</th><td>${data.dpia.residualRiskLevel ? severityBadge(data.dpia.residualRiskLevel) : '—'}</td></tr>
        <tr><th>Approved By</th><td>${escapeHtml(data.dpia.approvedBy) || '—'}</td></tr>
        <tr><th>Approved At</th><td>${formatDate(data.dpia.approvedAt)}</td></tr>
        <tr><th>Linked Activities</th><td>${data.dpia.linkedActivities.map(escapeHtml).join(', ') || '—'}</td></tr>
      </table>
    </div>
  `;

  const description = `
    <div class="section">
      <div class="section-title">Processing Description</div>
      <div class="summary-text">${escapeHtml(data.dpia.processingDescription) || 'Not documented.'}</div>
    </div>
    <div class="section">
      <div class="section-title">Necessity & Proportionality Assessment</div>
      <div class="summary-text"><strong>Necessity:</strong> ${escapeHtml(data.dpia.necessityAssessment) || '—'}</div>
      <div class="summary-text"><strong>Proportionality:</strong> ${escapeHtml(data.dpia.proportionalityAssessment) || '—'}</div>
    </div>
  `;

  const risksSection = data.dpia.risks.length > 0 ? `
    <div class="section">
      <div class="section-title">Risk Assessment & Mitigation</div>
      ${data.dpia.risks.map((risk, i) => `
        <div style="margin-bottom:16px; padding:12px; background:#FAFAF8; border-radius:8px;">
          <div style="font-weight:600; margin-bottom:8px;">Risk ${i + 1}: ${escapeHtml(risk.description)}</div>
          <table>
            <tr><th>Likelihood</th><th>Severity</th><th>Initial Risk</th><th>Residual Risk</th></tr>
            <tr>
              <td>${risk.likelihood ?? '—'}/5</td>
              <td>${risk.severity ?? '—'}/5</td>
              <td>${risk.initialRiskScore ?? '—'}</td>
              <td>${risk.residualRiskScore ?? '—'}</td>
            </tr>
          </table>
          ${risk.measures.length > 0 ? `
            <div style="margin-top:8px; font-weight:600; font-size:11px;">Mitigation Measures:</div>
            <table>
              <tr><th>Measure</th><th>Status</th><th>Implemented</th></tr>
              ${risk.measures.map(m => `
                <tr>
                  <td>${escapeHtml(m.description)}</td>
                  <td>${escapeHtml(m.status)}</td>
                  <td>${formatDate(m.implementedAt)}</td>
                </tr>
              `).join('')}
            </table>
          ` : '<div class="no-data">No mitigation measures documented.</div>'}
        </div>
      `).join('')}
    </div>
  ` : '<div class="no-data">No risks assessed.</div>';

  const footer = renderFooter(data.orgName, `DPIA: ${data.dpia.title}`);
  return wrapPage(`${header}${overview}${description}${risksSection}${footer}`);
}