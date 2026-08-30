/**
 * HTML to the flattened text everything downstream of a fetch actually works in.
 *
 * There were three copies of this before, and they disagreed in ways that
 * mattered: `registerOutputs.ts` lowercased as it stripped, `vendorUrlCandidates`
 * stripped tags but not the script bodies between them, and the Trust Centre
 * ingester in `routers/vendors.ts` was the only one that removed `<script>` and
 * `<style>` content. The third is the correct one, and it is the shape here —
 * because a page whose navigation JSON survives the strip will match almost any
 * token you scan it for, and a probe that reads a script block is a probe that
 * verifies a marketing page as a DPA.
 *
 * Deliberately not a DOM parse. Nothing in this workspace parses HTML, and the
 * signal evaluation, the anchor-text matcher and the extraction locators are all
 * regex over prose. Adding a parser here would mean two models of a document in
 * one pipeline.
 */

/**
 * How much of a page is kept when one is stored for review.
 *
 * This was 64,000 on the theory that a legal page is a few tens of kilobytes of
 * prose and the rest is navigation. That was wrong, and measurably so: Stripe's
 * privacy notice is **162,077 characters of text** after stripping, so the first
 * version of this stored 39% of it and silently discarded the rest. Every value
 * past the cut was unteachable — not hard to teach, impossible, because the
 * reviewer could not see it and no locator could anchor to it.
 *
 * A cap is still worth having, as a bound on the pathological rather than as a
 * storage optimisation: the fetch itself already stops at `MAX_BYTES` (10MB of
 * HTML), which at the 41% text ratio Stripe's page shows could still be four
 * megabytes of prose in one row and one browser div. A megabyte is six times the
 * largest real page measured and comfortably renders.
 *
 * Storage was never the constraint it was written as. Eighty vendors times three
 * documents at Stripe's size is about forty megabytes.
 */
export const PROBE_TEXT_LIMIT = 1_000_000;

/**
 * What is appended when a page did not fit.
 *
 * Truncation used to be silent, which is the wrong failure for this table: the
 * reviewer is being shown "what the probe read" and would have had no way to
 * tell that it read more. Worse, a locator taught near the boundary would look
 * fine and then behave differently on a run where the page grew. The marker is
 * inside the text so it appears in the panel, in the extraction, and in anything
 * else that reads the column.
 */
export const TRUNCATION_MARKER = '\n\n[… page truncated: it is longer than this store keeps …]';

/**
 * Strip markup and collapse whitespace, preserving case.
 *
 * Case is kept because a reviewer reads this and because extraction locators
 * anchor to it; the callers that want it lowercased do that themselves, which is
 * what `evaluateContentSignals` already does on its own first line.
 */
export function htmlToText(html: string): string {
  return html
    // Script and style *bodies*, not just their tags. A page's inlined JSON will
    // otherwise satisfy nearly any token scan run against it.
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    // A handful of entities, because they appear mid-sentence in legal prose and
    // a locator anchored across one would not match. Not a full entity table:
    // the rest degrade to themselves, which is legible.
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** `htmlToText`, bounded, and saying so when the bound was reached. */
export function htmlToStoredText(html: string, limit: number = PROBE_TEXT_LIMIT): string {
  const text = htmlToText(html);
  if (text.length <= limit) return text;
  return text.slice(0, limit) + TRUNCATION_MARKER;
}
