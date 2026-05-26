import { escapeHtml, formatDate, renderHeader, renderFooter, wrapPage } from './shared.js';

type DsarReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  requests: Array<{
    referenceNumber: string;
    requestType: string;
    subjectName: string;
    receivedAt: Date;
    deadlineAt: Date;
    completedAt: Date | null;
    status: string;
    extended: boolean;
    daysToComplete: number | null;
    withinDeadline: boolean | null;
  }>;
  summary: {
    total: number;
    completed: number;
    active: number;
    overdue: number;
    averageDays: number;
    slaAdherence: number;
  };
};

export function renderDsarRegisterHtml(data: DsarReportData): string {
  const header = renderHeader(data.orgName, 'Data Subject Access Request Register', data.generatedAt, data.logoUrl);

  const stats = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${data.summary.total}</div><div class="stat-label">Total DSARs</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.completed}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-value" style="color:${data.summary.overdue > 0 ? '#DC2626' : '#16A34A'}">${data.summary.overdue}</div><div class="stat-label">Overdue</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.slaAdherence}%</div><div class="stat-label">SLA Adherence</div></div>
    </div>
  `;

  const table = `
    <div class="section">
      <div class="section-title">Request Log</div>
      <table>
        <tr>
          <th>Reference</th>
          <th>Type</th>
          <th>Subject</th>
          <th>Received</th>
          <th>Deadline</th>
          <th>Completed</th>
          <th>Days</th>
          <th>Status</th>
          <th>Within SLA</th>
        </tr>
        ${data.requests.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.referenceNumber)}</strong></td>
            <td>${escapeHtml(r.requestType)}</td>
            <td>${escapeHtml(r.subjectName)}</td>
            <td>${formatDate(r.receivedAt)}</td>
            <td>${formatDate(r.deadlineAt)}</td>
            <td>${formatDate(r.completedAt)}</td>
            <td>${r.daysToComplete !== null ? r.daysToComplete : '—'}</td>
            <td>${escapeHtml(r.status)}</td>
            <td>${r.withinDeadline === null ? '—' : r.withinDeadline ? '✅' : '❌'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const footer = renderFooter(data.orgName, 'DSAR Register');
  return wrapPage(`${header}${stats}${table}${footer}`);
}