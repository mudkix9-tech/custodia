/**
 * RFC 4180 CSV output, shared by every server-side export.
 *
 * There were two of these: `ropaExportFormats.ts` quoted conditionally so a
 * round trip through the ROPA importer stayed lossless, and the vendor register
 * export quoted everything. Both are valid CSV and that is the problem — two
 * files in one codebase disagreeing about the format an auditor receives, with
 * only one of them covered by a round-trip test.
 *
 * `apps/web/src/utils/csv.ts` is the browser-side twin (it also carries the
 * reader); the two workspaces cannot import from each other.
 */

/** Quotes a value only when it needs it, so a round trip through `parseCsv` is lossless. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

/** Rows joined with CRLF, which is what Excel expects and what the importer reads. */
export function csvDocument(rows: unknown[][]): string {
  return rows.map(csvRow).join('\r\n');
}
