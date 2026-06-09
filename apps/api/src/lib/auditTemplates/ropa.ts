import { escapeHtml, formatDate, renderHeader, renderFooter, wrapPage } from './shared.js';

type RopaReportData = {
  orgName: string;
  orgLegalName: string;
  orgCountry: string;
  orgAddress: any;
  dpoName: string | null;
  dpoEmail: string | null;
  logoUrl?: string;
  generatedAt: Date;
  controllerActivities: any[];   // activities where clientId is null
  processorActivities: any[];    // activities grouped by client
  locale?: string;
};

export function renderRopaReportHtml(data: RopaReportData): string {
  const locale = data.locale || 'en';
  const header = renderHeader(data.orgName, 'Article 30 — Record of Processing Activities', data.generatedAt, data.logoUrl, locale);

  const controllerInfo = `
    <div class="section">
      <div class="section-title">Data Controller Information</div>
      <table>
        <tr><th style="width:200px">Controller Name</th><td>${escapeHtml(data.orgLegalName || data.orgName)}</td></tr>
        <tr><th>Country</th><td>${escapeHtml(data.orgCountry)}</td></tr>
        <tr><th>Address</th><td>${escapeHtml(data.orgAddress?.street ? `${data.orgAddress.street}, ${data.orgAddress.city}, ${data.orgAddress.postalCode}` : '—')}</td></tr>
        <tr><th>Data Protection Officer</th><td>${data.dpoName ? `${escapeHtml(data.dpoName)} (${escapeHtml(data.dpoEmail)})` : 'Not appointed'}</td></tr>
      </table>
    </div>
  `;

  const controllerRecords = data.controllerActivities.length > 0 ? `
    <div class="section">
      <div class="section-title">Controller Record (Article 30(1))</div>
      <table>
        <tr>
          <th>Processing Activity</th>
          <th>Purpose</th>
          <th>Lawful Basis</th>
          <th>Data Categories</th>
          <th>Data Subjects</th>
          <th>Recipients</th>
          <th>Transfers</th>
          <th>Retention</th>
          <th>Security Measures</th>
        </tr>
        ${data.controllerActivities.map(a => `
          <tr>
            <td><strong>${escapeHtml(a.name)}</strong></td>
            <td>${escapeHtml(a.purpose)}</td>
            <td>${escapeHtml(a.lawfulBasis)}</td>
            <td>${(a.dataCategories || []).map((c: any) => escapeHtml(c.category)).join(', ') || '—'}</td>
            <td>${(a.dataSubjectCategories || []).join(', ') || '—'}</td>
            <td>${(a.recipients || []).map((r: any) => escapeHtml(r.name)).join(', ') || '—'}</td>
            <td>${(a.transfers || []).map((t: any) => `${t.destinationCountry} (${escapeHtml(t.transferMechanism)})`).join(', ') || 'None'}</td>
            <td>${escapeHtml(a.retentionPeriod) || '—'}</td>
            <td>${(a.securityMeasures || []).join(', ') || '—'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  ` : '<div class="no-data">No controller processing activities documented.</div>';

  const processorSections = Object.entries(
    groupBy(data.processorActivities, (a: any) => a.clientName || 'Unknown Client')
  ).map(([clientName, activities]) => `
    <div class="section page-break">
      <div class="section-title">Processor Record (Article 30(2)) — ${escapeHtml(clientName as string)}</div>
      <table>
        <tr>
          <th>Processing Activity</th>
          <th>Categories of Processing</th>
          <th>Data Categories</th>
          <th>Transfers</th>
          <th>Security Measures</th>
        </tr>
        ${(activities as any[]).map(a => `
          <tr>
            <td><strong>${escapeHtml(a.name)}</strong></td>
            <td>${escapeHtml(a.purpose)}</td>
            <td>${(a.dataCategories || []).map((c: any) => escapeHtml(c.category)).join(', ') || '—'}</td>
            <td>${(a.transfers || []).map((t: any) => `${t.destinationCountry} (${escapeHtml(t.transferMechanism)})`).join(', ') || 'None'}</td>
            <td>${(a.securityMeasures || []).join(', ') || '—'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `).join('');

  const footer = renderFooter(data.orgName, 'Article 30 Record of Processing Activities', locale);

  return wrapPage(`${header}${controllerInfo}${controllerRecords}${processorSections}${footer}`);
}

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}