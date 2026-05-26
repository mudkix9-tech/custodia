import { escapeHtml, formatDate, renderHeader, renderFooter, wrapPage } from './shared.js';

type TrainingReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  modules: Array<{
    title: string;
    isMandatory: boolean;
    completionRate: number;
    totalAssigned: number;
    totalCompleted: number;
  }>;
  completions: Array<{
    userName: string;
    userEmail: string;
    moduleTitle: string;
    status: string;
    quizScore: number | null;
    completedAt: Date | null;
    expiresAt: Date | null;
    certificateId: string | null;
  }>;
  summary: {
    overallCompletionRate: number;
    totalModules: number;
    totalCompletions: number;
    overdueCount: number;
  };
};

export function renderTrainingReportHtml(data: TrainingReportData): string {
  const header = renderHeader(data.orgName, 'Employee Training Compliance Report', data.generatedAt, data.logoUrl);

  const stats = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${data.summary.overallCompletionRate}%</div><div class="stat-label">Overall Completion</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.totalModules}</div><div class="stat-label">Active Modules</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.totalCompletions}</div><div class="stat-label">Completions</div></div>
      <div class="stat-card"><div class="stat-value" style="color:${data.summary.overdueCount > 0 ? '#DC2626' : '#16A34A'}">${data.summary.overdueCount}</div><div class="stat-label">Overdue</div></div>
    </div>
  `;

  const modulesSummary = `
    <div class="section">
      <div class="section-title">Module Overview</div>
      <table>
        <tr><th>Module</th><th>Mandatory</th><th>Assigned</th><th>Completed</th><th>Completion Rate</th></tr>
        ${data.modules.map(m => `
          <tr>
            <td><strong>${escapeHtml(m.title)}</strong></td>
            <td>${m.isMandatory ? 'Yes' : 'No'}</td>
            <td>${m.totalAssigned}</td>
            <td>${m.totalCompleted}</td>
            <td>${m.completionRate}%</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const records = `
    <div class="section">
      <div class="section-title">Individual Completion Records</div>
      <table>
        <tr><th>Employee</th><th>Email</th><th>Module</th><th>Status</th><th>Score</th><th>Completed</th><th>Expires</th><th>Certificate</th></tr>
        ${data.completions.map(c => `
          <tr>
            <td>${escapeHtml(c.userName)}</td>
            <td>${escapeHtml(c.userEmail)}</td>
            <td>${escapeHtml(c.moduleTitle)}</td>
            <td>${escapeHtml(c.status)}</td>
            <td>${c.quizScore !== null ? `${c.quizScore}%` : '—'}</td>
            <td>${formatDate(c.completedAt)}</td>
            <td>${formatDate(c.expiresAt)}</td>
            <td>${escapeHtml(c.certificateId) || '—'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const footer = renderFooter(data.orgName, 'Training Compliance Report');
  return wrapPage(`${header}${stats}${modulesSummary}${records}${footer}`);
}