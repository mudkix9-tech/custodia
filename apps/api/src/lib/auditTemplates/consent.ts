import { escapeHtml, formatDate, renderHeader, renderFooter, wrapPage } from './shared.js';

type ConsentReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  domains: Array<{
    domain: string;
    totalPageviews30d: number;
    consentRate30d: number;
    lastScanAt: Date | null;
    cookieCount: number;
    gcmEnabled: boolean;
    tcfEnabled: boolean;
  }>;
  summary: {
    totalDomains: number;
    averageConsentRate: number;
    totalPageviews: number;
    totalCookiesTracked: number;
  };
};

export function renderConsentReportHtml(data: ConsentReportData): string {
  const header = renderHeader(data.orgName, 'Cookie Consent Analytics Report', data.generatedAt, data.logoUrl);

  const stats = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${data.summary.totalDomains}</div><div class="stat-label">Domains</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.averageConsentRate}%</div><div class="stat-label">Avg Consent Rate</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.totalPageviews.toLocaleString()}</div><div class="stat-label">Pageviews (30d)</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.totalCookiesTracked}</div><div class="stat-label">Cookies Tracked</div></div>
    </div>
  `;

  const table = `
    <div class="section">
      <div class="section-title">Domain Overview</div>
      <table>
        <tr><th>Domain</th><th>Pageviews (30d)</th><th>Consent Rate</th><th>Cookies</th><th>GCM v2</th><th>TCF</th><th>Last Scan</th></tr>
        ${data.domains.map(d => `
          <tr>
            <td><strong>${escapeHtml(d.domain)}</strong></td>
            <td>${d.totalPageviews30d.toLocaleString()}</td>
            <td>${d.consentRate30d}%</td>
            <td>${d.cookieCount}</td>
            <td>${d.gcmEnabled ? '✅' : '❌'}</td>
            <td>${d.tcfEnabled ? '✅' : '❌'}</td>
            <td>${formatDate(d.lastScanAt)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const footer = renderFooter(data.orgName, 'Consent Analytics');
  return wrapPage(`${header}${stats}${table}${footer}`);
}