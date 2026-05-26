import { escapeHtml, formatDate, dpaBadge, severityBadge, renderHeader, renderFooter, wrapPage } from './shared.js';

type VendorReportData = {
  orgName: string;
  logoUrl?: string;
  generatedAt: Date;
  vendors: Array<{
    name: string;
    category: string | null;
    headquartersCountry: string | null;
    dataProcessingLocations: string[];
    dpaStatus: string;
    dpaSignedAt: Date | null;
    dpaExpiresAt: Date | null;
    riskLevel: string | null;
    riskScore: number | null;
    securityCertifications: string[];
    transferMechanism: string | null;
    lastReviewedAt: Date | null;
  }>;
  summary: {
    total: number;
    dpasSigned: number;
    dpasExpired: number;
    dpasMissing: number;
    highRisk: number;
  };
};

export function renderVendorRegisterHtml(data: VendorReportData): string {
  const header = renderHeader(data.orgName, 'Vendor Register & DPA Status', data.generatedAt, data.logoUrl);

  const stats = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${data.summary.total}</div><div class="stat-label">Total Vendors</div></div>
      <div class="stat-card"><div class="stat-value">${data.summary.dpasSigned}</div><div class="stat-label">DPAs Signed</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#DC2626">${data.summary.dpasExpired + data.summary.dpasMissing}</div><div class="stat-label">DPAs Missing/Expired</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#D97706">${data.summary.highRisk}</div><div class="stat-label">High/Critical Risk</div></div>
    </div>
  `;

  const table = `
    <div class="section">
      <div class="section-title">Vendor Details</div>
      <table>
        <tr>
          <th>Vendor</th>
          <th>Category</th>
          <th>HQ</th>
          <th>DPA Status</th>
          <th>DPA Signed</th>
          <th>DPA Expires</th>
          <th>Risk</th>
          <th>Certifications</th>
          <th>Last Reviewed</th>
        </tr>
        ${data.vendors.map(v => `
          <tr>
            <td><strong>${escapeHtml(v.name)}</strong></td>
            <td>${escapeHtml(v.category)}</td>
            <td>${escapeHtml(v.headquartersCountry)}</td>
            <td>${dpaBadge(v.dpaStatus)}</td>
            <td>${formatDate(v.dpaSignedAt)}</td>
            <td>${formatDate(v.dpaExpiresAt)}</td>
            <td>${v.riskLevel ? severityBadge(v.riskLevel) : '—'}</td>
            <td>${(v.securityCertifications || []).join(', ') || '—'}</td>
            <td>${formatDate(v.lastReviewedAt)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  const footer = renderFooter(data.orgName, 'Vendor Register');
  return wrapPage(`${header}${stats}${table}${footer}`);
}