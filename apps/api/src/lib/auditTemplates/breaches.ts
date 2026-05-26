import { escapeHtml, formatDate, severityBadge, renderHeader, renderFooter, wrapPage } from './shared.js';

type BreachReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  breaches: Array<{
    referenceNumber: string;
    title: string;
    discoveredAt: Date;
    breachType: string;
    riskToIndividuals: string | null;
    estimatedRecordsAffected: number | null;
    notifyAuthority: boolean | null;
    authorityNotifiedAt: Date | null;
    notifyIndividuals: boolean | null;
    status: string;
    rootCause: string | null;
    vendorOriginated: boolean;
  }>;
  summary: {
    total: number;
    notifiable: number;
    notifiedOnTime: number;
    vendorOriginated: number;
    averageResolutionDays: number;
  };
};

export function renderBreachRegisterHtml(data: BreachReportData): string {
  const header = renderHeader(data.orgName, 'Breach Register (Article 33(5))', data.generatedAt, data.logoUrl);

  const stats = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${data.summary.total}</div><div class="stat-label">Total Breaches</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.notifiable}</div><div class="stat-label">Required Notification</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.notifiedOnTime}</div><div class="stat-label">Notified Within 72h</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.vendorOriginated}</div><div class="stat-label">Vendor-Originated</div></div>
    </div>
  `;

  const note = `
    <div class="summary-text">
      This register documents all personal data breaches in accordance with GDPR Article 33(5),
      including breaches assessed as not requiring notification to the supervisory authority.
    </div>
  `;

  const table = `
    <div class="section">
      <div class="section-title">Breach Log</div>
      <table>
        <tr>
          <th>Reference</th>
          <th>Title</th>
          <th>Discovered</th>
          <th>Type</th>
          <th>Risk</th>
          <th>Records</th>
          <th>Authority Notified</th>
          <th>Individuals Notified</th>
          <th>Status</th>
        </tr>
        ${data.breaches.map(b => `
          <tr>
            <td><strong>${escapeHtml(b.referenceNumber)}</strong></td>
            <td>${escapeHtml(b.title)}${b.vendorOriginated ? ' <em>(vendor)</em>' : ''}</td>
            <td>${formatDate(b.discoveredAt)}</td>
            <td>${escapeHtml(b.breachType)}</td>
            <td>${b.riskToIndividuals ? severityBadge(b.riskToIndividuals) : '—'}</td>
            <td>${b.estimatedRecordsAffected ?? '—'}</td>
            <td>${b.notifyAuthority ? (b.authorityNotifiedAt ? formatDate(b.authorityNotifiedAt) : '⚠️ Pending') : 'Not required'}</td>
            <td>${b.notifyIndividuals ? '✅ Yes' : 'Not required'}</td>
            <td>${escapeHtml(b.status)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const footer = renderFooter(data.orgName, 'Breach Register (Article 33(5))');
  return wrapPage(`${header}${stats}${note}${table}${footer}`);
}