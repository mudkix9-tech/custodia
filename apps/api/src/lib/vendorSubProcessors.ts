/**
 * Sub-processor page snapshots — normalisation and diffing.
 *
 * Extracted from `workers/vendors.ts` because the cleaning chain is the whole
 * Article 28(2) feature: the reviewer's additions/removals list is computed by
 * splitting the stored snapshot on newlines, so a normaliser that eats `\n`
 * turns every detected change into "1 addition, 1 removal" over two unreadable
 * blobs. That is exactly what `.replace(/\s+/g, ' ')` did — `\s` includes `\n` —
 * and `tsc` sees a perfectly good string either way. Only a fixture can tell the
 * difference, which is why this lives here rather than inline in the worker.
 */

/**
 * Strips the boilerplate a vendor's sub-processor page carries around the list
 * itself, so a cookie banner rotating its wording is not reported as a change.
 *
 * Line structure is deliberately preserved: horizontal whitespace collapses,
 * newlines do not.
 */
export function normaliseSubProcessorSnapshot(textContent: string): string {
  return textContent
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const isCookieBanner =
        /cookie/i.test(trimmed) &&
        /(use|experience|accept|agree|decline|consent|settings|manage|policy)/i.test(trimmed);
      const isCopyright = /copyright|all rights reserved|©/i.test(trimmed);
      const isBoilerplateLink =
        /^(privacy policy|terms of service|terms & conditions|contact us|about us|help center|support)$/i.test(trimmed) ||
        (trimmed.includes('|') && /(privacy|terms|contact|about|support)/i.test(trimmed));

      if (isCookieBanner || isCopyright || isBoilerplateLink) {
        return '';
      }
      return trimmed;
    })
    .filter(Boolean)
    .join('\n')
    // Horizontal whitespace only. Collapsing \n as well destroyed the line
    // structure the reviewer's diff splits on.
    .replace(/[^\S\n]+/g, ' ')
    // A "last updated 2026" line changes every year without the list changing,
    // so years are dropped before hashing.
    .replace(/\b(?:202\d|19\d\d)\b/g, '')
    .trim();
}

export type SnapshotDiff = { added: string[]; removed: string[] };

/**
 * Set difference over lines. Mirrors what `SubProcessorList.tsx` renders, so a
 * change that reads as "3 added, 1 removed" here reads the same to the reviewer.
 */
export function diffSubProcessorSnapshots(previous: string, next: string): SnapshotDiff {
  const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const previousLines = lines(previous);
  const nextLines = lines(next);
  const previousSet = new Set(previousLines);
  const nextSet = new Set(nextLines);

  return {
    added: nextLines.filter((l) => !previousSet.has(l)),
    removed: previousLines.filter((l) => !nextSet.has(l)),
  };
}
