/**
 * RFC 4180 CSV reader.
 *
 * The ROPA importer used `row.split(',')` against an exporter that quotes every
 * field, so a purpose containing a comma — "Billing, invoicing and collections"
 * — shifted every later column left: lawful basis landed in status, status in
 * risk level, and the register filled with plausible-looking wrong records. It
 * reported success afterwards, because nothing in that path could fail.
 *
 * Splitting on newlines first has the same bug for quoted fields containing
 * newlines, so this walks the text once as a character stream instead.
 */
export function parseCsv(text: string): string[][] {
  // Excel writes a BOM; left in place it becomes part of the first header name.
  const input = text.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // "" inside a quoted field is one literal quote.
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Swallow CRLF as one terminator; a lone CR also ends the row.
      endRow();
      i += input[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // A file not ending in a newline still has a final row to flush; one that does
  // must not gain a trailing row of one empty field.
  if (field !== '' || row.length > 0) endRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Quotes a value for output. Mirrors `parseCsv`, so a round trip is lossless. */
export function toCsvField(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(toCsvField).join(',');
}

/**
 * Maps a header row onto column indices by name, so a file whose columns were
 * reordered — or which carries extra columns — still imports correctly.
 * Returns -1 for a header that is not present.
 */
export function indexHeaders(header: string[], aliases: Record<string, string[]>): Record<string, number> {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seen = header.map(normalise);
  const out: Record<string, number> = {};

  for (const [key, names] of Object.entries(aliases)) {
    out[key] = seen.findIndex((h) => names.some((n) => normalise(n) === h));
  }
  return out;
}
