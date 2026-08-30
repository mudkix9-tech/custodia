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
 * A legal page is a few tens of kilobytes of prose wrapped in a few hundred of
 * navigation and inlined JSON. Past this the marginal byte is menu, and eighty
 * vendors times three documents makes the difference between megabytes and
 * gigabytes. Truncation is silent by design: the reviewer is being shown what
 * the probe read, and the probe read this much.
 */
export const PROBE_TEXT_LIMIT = 64_000;

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

/** `htmlToText`, truncated to what is worth storing. */
export function htmlToStoredText(html: string, limit: number = PROBE_TEXT_LIMIT): string {
  const text = htmlToText(html);
  return text.length <= limit ? text : text.slice(0, limit);
}
