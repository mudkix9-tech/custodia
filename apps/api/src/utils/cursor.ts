/**
 * The pagination cursor codec.
 *
 * Its own module, and not part of `pagination.ts`, because `pagination.ts` imports
 * `db.js` at module scope and that throws without `DATABASE_URL`. A pure codec
 * should not drag a database connection into everything that wants to encode a
 * cursor — and, more to the point, it should be testable by the standalone `tsx`
 * fixtures, which are the only test style that runs in this workspace.
 */

/**
 * `d` records whether the sort value was a Date, rather than leaving the reader to
 * guess from its text.
 *
 * Guessing is what the decoder used to do — `new Date(value)`, keep it if it parses
 * — and it is wrong in both directions the moment anything but a timestamp column is
 * sorted on. An activity named "2024" produces a cursor that parses as a date, so
 * the next page compares a varchar column against a timestamp; a completeness score
 * of 85 parses as 85 milliseconds past the epoch. Both surface as a list that
 * silently ends after one page, which reads as "there are no more records".
 */
export function encodeCursor(sortValue: string | number | Date, id: string): string {
  const isDate = sortValue instanceof Date;
  const s = isDate ? sortValue.toISOString() : sortValue;
  const payload = JSON.stringify({ s, i: id, d: isDate });
  return Buffer.from(payload).toString('base64url');
}

export function decodeCursor(cursor: string): { sortValue: string | number; id: string; isDate: boolean } {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  return {
    sortValue: payload.s,
    id: payload.i,
    // Cursors minted before this flag existed carry no `d`. They are held in open
    // browser tabs and in React Query caches, so they fall back to the old sniffing
    // rather than being rejected — every one of them sorts on a timestamp, which is
    // the case sniffing gets right.
    isDate: typeof payload.d === 'boolean' ? payload.d : !Number.isNaN(new Date(payload.s).getTime()),
  };
}
