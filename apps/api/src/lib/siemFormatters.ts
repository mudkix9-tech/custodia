export function formatJSON(entry: any) {
  return JSON.stringify({
    timestamp: entry.createdAt,
    source: 'custodia',
    organizationId: entry.organizationId,
    actor: {
      userId: entry.userId,
      email: entry.userEmail,
      ip: entry.ipAddress,
    },
    action: entry.action,
    resource: {
      type: entry.resourceType,
      id: entry.resourceId,
    },
    description: entry.description,
    changes: entry.changes,
    severity: 'info',
  });
}

// CEF gives `|` structural meaning in the header and `=` in the extension, so a
// value carrying either forges fields in the SIEM. Audit descriptions are built
// from user-supplied names, so an entry described as "renamed to x= suser=root"
// silently rewrote the attributed user of the event a defender was reading.
// Escaping per the ArcSight CEF spec: backslash first, then the delimiters, and
// newlines folded so one record cannot become two.
const cefHeader = (value: unknown) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");

const cefExtension = (value: unknown) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/=/g, "\\=")
    .replace(/\r?\n/g, " ");

export function formatCEF(entry: any) {
  const severity = '3'; // maps to info usually

  const extensions = [];
  extensions.push(`suser=${cefExtension(entry.userEmail || entry.userId || 'unknown')}`);
  if (entry.ipAddress) extensions.push(`src=${cefExtension(entry.ipAddress)}`);
  if (entry.organizationId) extensions.push(`cs1Label=organizationId cs1=${cefExtension(entry.organizationId)}`);
  if (entry.resourceType) extensions.push(`cs2Label=resourceType cs2=${cefExtension(entry.resourceType)}`);
  if (entry.resourceId) extensions.push(`cs3Label=resourceId cs3=${cefExtension(entry.resourceId)}`);
  if (entry.description) extensions.push(`msg=${cefExtension(entry.description)}`);

  // Adding JSON payload for changes/metadata as a custom field isn't standard CEF but can be useful
  if (entry.changes) {
    extensions.push(`cs4Label=changes cs4=${cefExtension(JSON.stringify(entry.changes))}`);
  }

  const extensionStr = extensions.join(' ');

  return `CEF:0|Custodia|Custodia|1.0|${cefHeader(entry.action)}|${cefHeader(entry.description || entry.action)}|${severity}|${extensionStr}`;
}

export function formatSyslog(entry: any) {
  const timestamp = new Date(entry.createdAt).toISOString();
  // Construct a standard syslog format string (RFC 5424) or basic BSD syslog
  // Using a simplified RFC 5424 structure without strict facility/severity numbers
  const hostname = 'custodia';
  const appName = 'audit';
  const procId = '-';
  const msgId = entry.action;

  const msg = JSON.stringify({
    organizationId: entry.organizationId,
    actor: entry.userEmail || entry.userId,
    ip: entry.ipAddress,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    description: entry.description,
    changes: entry.changes,
  });

  return `<134>1 ${timestamp} ${hostname} ${appName} ${procId} ${msgId} - ${msg}`;
}

export function formatSiemPayload(format: string, entry: any) {
  switch (format) {
    case 'cef':
      return formatCEF(entry);
    case 'syslog':
      return formatSyslog(entry);
    case 'json':
    default:
      return formatJSON(entry);
  }
}
