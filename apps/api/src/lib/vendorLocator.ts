/**
 * Teaching an extraction by example: turn "the answer is *this* bit" into
 * something that finds the same bit next month.
 *
 * The reviewer selects a run of text in the page the probe stored.
 * `deriveLocator` turns that selection into an anchor — the words immediately
 * before it, and the character that ends it — and `applyLocator` runs the anchor
 * against a later copy of the page. Nobody writes a pattern.
 *
 * **Anchored text, not a CSS selector.** Nothing in this workspace parses HTML:
 * the signal evaluation, the anchor-text matcher and the stored documents are
 * all flattened prose, and adding a DOM would mean two models of a page in one
 * pipeline. Text anchors also survive the thing that actually happens to these
 * pages — a marketing redesign that keeps the sentence and moves the markup.
 *
 * **The anchor is grown until it is unique.** A locator that matches in two
 * places is not a locator; it is a coin flip that will read correctly the day it
 * is taught and wrongly the day a second "our regions are" appears on the page.
 * `deriveLocator` widens the prefix a word at a time until exactly one match
 * remains, and gives up rather than returning something ambiguous.
 *
 * **A locator carries what it produced.** `expect` is stored so the rule can be
 * checked at authoring time — `deriveLocator` refuses to hand back a locator
 * that does not reproduce the selection — and so a later mismatch is legible in
 * the console: "this used to say X, now it finds Y".
 */

/** How far back the prefix may grow before the attempt is abandoned. */
const MAX_ANCHOR_WORDS = 12;

/** How much text a single extraction may return. A whole page is not a value. */
export const MAX_EXTRACTED_CHARS = 600;

export interface Locator {
  kind: 'anchored_text';
  /** The run of words immediately before the value. Unique in the document. */
  before: string;
  /**
   * What ends the value. A literal string, usually a full stop or a newline —
   * never a length, because the value's length is the thing most likely to
   * change between two versions of the same sentence.
   */
  after: string;
  /** What the selection was when it was taught, for authoring checks and drift messages. */
  expect: string;
  /** Split the value into a list on this separator. Null for a scalar field. */
  split: string | null;
}

export function isLocator(value: unknown): value is Locator {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Partial<Locator>;
  return (
    l.kind === 'anchored_text' &&
    typeof l.before === 'string' &&
    l.before.length > 0 &&
    typeof l.after === 'string' &&
    typeof l.expect === 'string'
  );
}

/** Case- and whitespace-insensitive comparison, which is how prose varies. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * A searchable copy of a page, and the way back to the original characters.
 *
 * Matching has to ignore case and runs of whitespace, because that is how the
 * same sentence differs between two renderings of a page. Returning what was
 * matched must *not* ignore them: a locator that answers "ireland (eu-west-1)"
 * for a page that says "Ireland (eu-west-1)" has quietly damaged the value on
 * its way out, and the damage lands in a catalogue column a customer reads.
 *
 * So: fold for the search, and carry an index per folded character so the value
 * can be sliced out of the original.
 */
function foldWithIndex(text: string): { folded: string; index: number[] } {
  const chars: string[] = [];
  const index: number[] = [];
  let pendingSpace = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      pendingSpace = chars.length > 0;
      continue;
    }
    if (pendingSpace) {
      chars.push(' ');
      index.push(i);
      pendingSpace = false;
    }
    chars.push(ch.toLowerCase());
    index.push(i);
  }
  return { folded: chars.join(''), index };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

export interface DeriveResult {
  locator: Locator | null;
  /** Why it could not be derived, for the console to show at authoring time. */
  problem?: string;
}

/**
 * Derive a locator from a selection inside `text`.
 *
 * `split` is supplied by the caller rather than guessed: whether
 * "Ireland, Germany" is one value or two is a question about the *field*, and
 * the field is something the reviewer picked from a list. Guessing it from a
 * comma would split a legal entity name at the first "Inc., Ltd".
 */
export function deriveLocator(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  options: { split?: string | null } = {},
): DeriveResult {
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd > text.length ||
    selectionEnd <= selectionStart
  ) {
    return { locator: null, problem: 'The selection is outside the stored page.' };
  }

  const selected = text.slice(selectionStart, selectionEnd).trim();
  if (!selected) {
    return { locator: null, problem: 'The selection is empty.' };
  }
  if (selected.length > MAX_EXTRACTED_CHARS) {
    return {
      locator: null,
      problem: `That selection is ${selected.length} characters. A field value is not a page — select the value, not the section.`,
    };
  }

  /**
   * What ends the value.
   *
   * A punctuation mark where one immediately follows, and otherwise the words
   * that actually come next — not a hardcoded full stop. Defaulting to "." made
   * every value ending mid-sentence unteachable: selecting a company name out of
   * "...added Stripe Technology Company Limited (STC) as an affiliate." derived
   * an anchor that read to the end of the sentence, failed its own authoring
   * check, and told the reviewer to select differently when there was no
   * different selection to make.
   *
   * Capped at two words, because the terminator is the other half of what a
   * redesign can move: the more of the following sentence it pins, the more
   * brittle the rule.
   */
  const tail = text.slice(selectionEnd, selectionEnd + 40);
  const immediate = tail.slice(0, 1);
  const after = /[.;\n)]/.test(immediate)
    ? immediate
    : (tail.trim().split(/\s+/).slice(0, 2).join(' ') || '.');

  const haystack = normalise(text);
  const prefixWords = text.slice(0, selectionStart).trim().split(/\s+/);

  for (let take = 2; take <= MAX_ANCHOR_WORDS; take += 1) {
    if (take > prefixWords.length) break;
    const candidate = prefixWords.slice(prefixWords.length - take).join(' ');
    const normalisedCandidate = normalise(candidate);
    if (!normalisedCandidate) continue;

    if (countOccurrences(haystack, normalisedCandidate) === 1) {
      const locator: Locator = {
        kind: 'anchored_text',
        before: candidate,
        after,
        expect: selected,
        split: options.split ?? null,
      };

      // The authoring check, run against the *raw* extraction rather than the
      // split-and-rejoined one: splitting is a presentation of the same value,
      // and re-joining on the separator loses whatever whitespace followed it —
      // which would fail every list rule for a reason that has nothing to do
      // with whether the anchor works.
      //
      // A locator that does not reproduce what was selected is never saved, so
      // the failure lands on the person who can still see the page rather than
      // on the next run, three weeks later, with no selection to compare to.
      const got = extractRaw(text, locator);
      if (got !== null && normalise(got) === normalise(selected)) {
        return { locator };
      }
      return {
        locator: null,
        problem:
          `An anchor was found but it reads back "${got ?? 'nothing'}" rather than ` +
          `"${selected}". Try selecting from the start of the value.`,
      };
    }
  }

  return {
    locator: null,
    problem:
      'No unique anchor within twelve words. The text before this value repeats ' +
      'elsewhere on the page, so a locator here would match more than one place.',
  };
}

/**
 * Run a locator against a page. `null` when it no longer matches.
 *
 * Null rather than a best guess, deliberately: the caller turns null into "write
 * nothing and raise a signal", and any softer answer here would be the pipeline
 * quietly resuming the guessing this whole design removed.
 */
function extractRaw(text: string, locator: Locator): string | null {
  const { folded, index } = foldWithIndex(text);
  const anchor = normalise(locator.before);
  if (!anchor) return null;

  const at = folded.indexOf(anchor);
  if (at === -1) return null;
  // Ambiguity is refused at read time as well as at authoring time: a page that
  // grew a second copy of the anchor since the rule was taught is a page the
  // rule no longer describes, and picking the first match would be a guess.
  if (folded.indexOf(anchor, at + anchor.length) !== -1) return null;

  const from = at + anchor.length;
  const terminator = normalise(locator.after) || locator.after;
  const rel = terminator ? folded.slice(from).indexOf(terminator) : -1;
  const to = rel === -1 ? folded.length : from + rel;
  if (to <= from) return null;

  // Sliced out of the original, so the value keeps its own capitalisation.
  //
  // Ends at `index[to]` — where the terminator starts — rather than one past
  // `index[to - 1]`. A collapsed run of whitespace is recorded against the
  // *following* character's position, so "one past the last kept character" is
  // one past the terminator's first character whenever the value ends at a
  // space. That put a stray "(" on the end of every value taught mid-sentence.
  const end = to < index.length ? index[to]! : text.length;
  const raw = text.slice(index[from]!, end).trim();
  if (!raw || raw.length > MAX_EXTRACTED_CHARS) return null;
  return raw;
}

export function applyLocator(text: string, locator: Locator): string | string[] | null {
  const raw = extractRaw(text, locator);
  if (raw === null) return null;
  if (!locator.split) return raw;

  const parts = raw
    .split(locator.split)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}
