/**
 * Sub-processor list parsing into structured rows — audit P-10.
 *
 * Sprint 0 fixed D7 by preserving line structure, so the reviewer sees
 * "Added: Amazon Web Services    Hosting   United States". Better than two
 * blobs; still not the fact. "AWS added hosting" needs name/service/country as
 * separate values, which is what `vendor_sub_processor_entities` stores and
 * what this parser produces from a snapshot's lines.
 *
 * The parser is heuristic on purpose: vendor sub-processor pages are tables,
 * definition lists or paragraphs with no shared format. It recognises the
 * common shapes and, where it cannot, treats the whole line as a name so
 * nothing is silently dropped — an unparsed line is still a diffed entity,
 * just one with no service/country.
 */

export interface ParsedSubProcessor {
  name: string;
  nameKey: string;
  service?: string | null;
  country?: string | null;
  purpose?: string | null;
  website?: string | null;
}

/** Folded comparison key, so "Twilio Inc." and "twilio inc" dedupe to one row. */
export function subProcessorNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const ISO_2 = /^[a-z]{2}$/i;

const PLACE_NAMES =
  /^(united states|united kingdom|united arab emirates|ireland|germany|france|netherlands|spain|italy|poland|sweden|japan|india|canada|australia|singapore|brazil|mexico)$/i;

/**
 * Parse one snapshot line into an entity row.
 *
 * Recognised shapes:
 *   Name                          (name only)
 *   Name - Service                (dash / pipe / em-dash separated)
 *   Name | Service | Country      (three+ columns)
 *   Name, Service, Country        (comma table row)
 *   Name (Country)                (parenthesised country)
 *   https://sub.example.com       (bare link — named after its host)
 *   Name https://example.com      (name + link)
 */
export function parseSubProcessorLine(line: string): ParsedSubProcessor | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return null;

  // A bare URL line names itself after its host.
  const urlMatch = trimmed.match(/https?:\/\/[^\s|,–—]+/);
  let website: string | null = null;
  let working = trimmed;
  if (urlMatch) {
    website = urlMatch[0];
    working = trimmed.replace(urlMatch[0], ' ').trim();
    if (!working) {
      try {
        const host = new URL(website).hostname.replace(/^www\./, '');
        return {
          name: host,
          nameKey: subProcessorNameKey(host),
          service: null,
          country: null,
          purpose: null,
          website,
        };
      } catch {
        return null;
      }
    }
  }

  // Column separators first; a comma table only counts with three or more
  // cells, because "Twilio, Inc." is one name and not two fields.
  let parts = working
    .split(/\s*[|·]\s*|\s+[–—]\s+|\t+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    const commas = working.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
    if (commas.length >= 3) parts = commas;
  }

  let name: string;
  let rest: string[];
  if (parts.length >= 2 && parts[0] !== undefined) {
    name = parts[0];
    rest = parts.slice(1);
  } else {
    // "Name (Country)" / "Name (Service)" — the last shape worth splitting.
    const paren = working.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const parenName = paren?.[1]?.trim();
    const parenInner = paren?.[2]?.trim();
    if (paren && parenName) {
      name = parenName;
      rest =
        parenInner !== undefined && parenInner.length === 2 && ISO_2.test(parenInner)
          ? [parenInner.toUpperCase()]
          : [parenInner ?? ''];
    } else {
      name = working;
      rest = [];
    }
  }

  name = name.replace(/\s{2,}/g, ' ').trim();
  if (!name || name.length > 255) return null;

  let country: string | null = null;
  let service: string | null = null;
  for (const value of rest) {
    if (!country && value.length === 2 && ISO_2.test(value)) {
      country = value.toUpperCase();
    } else if (!country && PLACE_NAMES.test(value)) {
      country = value;
    } else if (!service && value.length <= 120) {
      service = value;
    }
  }

  return { name, nameKey: subProcessorNameKey(name), service, country, purpose: null, website };
}

/**
 * Entity-level diff between two snapshots' parsed rows.
 *
 * Matching is on `nameKey`, so added/removed fall out of set difference and a
 * row present in both counts as unchanged even where its service text moved.
 */
export function diffSubProcessorEntities(
  previous: readonly ParsedSubProcessor[],
  next: readonly ParsedSubProcessor[],
): { added: ParsedSubProcessor[]; removed: ParsedSubProcessor[] } {
  const previousKeys = new Set(previous.map((p) => p.nameKey));
  const nextKeys = new Set(next.map((p) => p.nameKey));
  return {
    added: next.filter((n) => !previousKeys.has(n.nameKey)),
    removed: previous.filter((p) => !nextKeys.has(p.nameKey)),
  };
}
