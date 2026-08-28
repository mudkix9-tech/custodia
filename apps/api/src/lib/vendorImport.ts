/**
 * D40 — CSV import for the vendor register.
 *
 * Every DPO already has the spreadsheet; the register's first-run experience is
 * decided by how fast that spreadsheet becomes a populated, matched register.
 * This module owns the parts of that pipeline that must be identical whether
 * the caller is the tRPC procedure or a test:
 *
 *   - `parseCsvRows` — RFC 4180 reader (the twin of utils/csv.ts's writer);
 *   - `buildColumnMapping` / `normaliseVendorRow` — maps free-form headers and
 *     values onto what the schema can hold;
 *   - `matchCatalogue` — fuzzy match against the global catalogue.
 *
 * Pure. No db import: the procedure supplies the catalogue rows, so the whole
 * file runs in fixtures without a database.
 */

import {
  normaliseDataCategoryList,
} from '../constants/vendorDataCategories.js';

// ---------------------------------------------------------------------------
// Parsing.
// ---------------------------------------------------------------------------

/**
 * RFC 4180: quoted fields may contain the delimiter, escaped quotes and line
 * breaks; rows end at CRLF or a bare LF. Tolerant of a trailing newline and of
 * a BOM, because both arrive from Excel exports daily. Blank rows are dropped —
 * Excel writes one at the end of every second file.
 *
 * The delimiter is detected rather than assumed. A German or French Excel
 * writes `;`, because the comma is its decimal separator; read as
 * comma-delimited, such a file has exactly one column, so every row fails as
 * "a vendor name is required" and the importer looks broken rather than
 * mismatched.
 *
 * Returns an error, not rows, for a file it cannot honestly parse. An
 * unbalanced quote used to swallow the remainder of the file into a single
 * field, so a 400-row spreadsheet containing one stray `"` imported as one
 * vendor whose name was the rest of the document — quietly, under a success
 * message.
 */
export type CsvParseResult = { rows: string[][] } | { error: string };

const DELIMITERS = [',', ';', '\t'] as const;

/** The delimiter that yields the most columns on the first non-empty line. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  let best = ',';
  let bestCount = 0;
  for (const candidate of DELIMITERS) {
    // Counted outside quotes only, so a quoted "Acme, Inc." does not get a vote.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine.charAt(i);
      if (char === '"') {
        if (inQuotes && firstLine.charAt(i + 1) === '"') { i++; continue; }
        inQuotes = !inQuotes;
      } else if (!inQuotes && char === candidate) {
        count++;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsvRows(text: string, delimiter?: string): CsvParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const sep = delimiter ?? detectDelimiter(clean);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let quoteOpenedAtLine = 0;
  let line = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // A trailing separator produces a lone empty field; keep only real rows.
    if (row.length > 1 || (row[0] ?? '').trim() !== '') {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const char = clean.charAt(i);
    const next = clean.charAt(i + 1);

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
        continue;
      }
      // A newline inside a quoted field is data. Normalised to \n so a value
      // written on Windows and the same value written on macOS compare equal —
      // which matters because the sub-processor diff splits on \n.
      if (char === '\r') {
        if (next === '\n') i++;
        field += '\n';
        line++;
        continue;
      }
      if (char === '\n') { field += '\n'; line++; continue; }
      field += char;
      continue;
    }

    if (char === sep) { pushField(); continue; }
    if (char === '"') { inQuotes = true; quoteOpenedAtLine = line; continue; }
    if (char === '\r') {
      // CRLF is one row terminator, not two. Consuming the LF here is what the
      // blank-row filter below was quietly compensating for.
      if (next === '\n') i++;
      pushRow();
      line++;
      continue;
    }
    if (char === '\n') { pushRow(); line++; continue; }
    field += char;
  }

  if (inQuotes) {
    return {
      error: `Unbalanced quote starting on line ${quoteOpenedAtLine}: everything after it was read as a single ` +
        'value. Check that row for a stray double quote.',
    };
  }

  if (field !== '' || row.length > 0) pushRow();
  return { rows: rows.filter((r) => r.some((c) => c.trim() !== '')) };
}

// ---------------------------------------------------------------------------
// Header mapping.
// ---------------------------------------------------------------------------

export type ImportableField =
  | 'name'
  | 'website'
  | 'category'
  | 'country'
  | 'purpose'
  | 'dataCategoriesShared'
  | 'businessOwner'
  | 'contactEmail'
  | 'criticality';

/**
 * The header vocabulary the importer accepts. A DPO's spreadsheet says
 * "Supplier Name", "URL", "HQ" — not our column names. Each canonical field
 * lists its aliases; first match wins per column, leftmost column wins per
 * field.
 */
const HEADER_ALIASES: Readonly<Record<ImportableField, readonly string[]>> = {
  name: ['name', 'vendor', 'supplier', 'vendor name', 'supplier name', 'tool'],
  website: ['website', 'url', 'domain', 'site', 'homepage'],
  category: ['category', 'service type', 'type', 'vertical'],
  country: ['country', 'hq', 'headquarters', 'hq country', 'headquarters country', 'location'],
  purpose: ['purpose', 'use', 'usage'],
  dataCategoriesShared: ['data categories', 'data shared', 'categories shared', 'data category'],
  businessOwner: ['owner', 'business owner', 'responsible', 'accountable'],
  contactEmail: ['contact', 'contact email', 'email', 'vendor email'],
  criticality: ['criticality', 'tier', 'importance', 'criticality tier'],
};

/** Maps one header cell to a canonical field, or null when unmapped. */
export function mapHeader(header: string): ImportableField | null {
  const key = header.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES) as Array<[ImportableField, readonly string[]]>) {
    if (aliases.includes(key)) return canonical;
  }
  return null;
}

/** Canonical field -> column index, built once from the header row. */
export type ColumnMapping = Partial<Record<ImportableField, number>>;

export function buildColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((header, index) => {
    const canonical = mapHeader(header);
    if (canonical !== null && mapping[canonical] === undefined) {
      mapping[canonical] = index;
    }
  });
  return mapping;
}

// ---------------------------------------------------------------------------
// Row normalisation.
// ---------------------------------------------------------------------------

/**
 * Country spellings -> ISO-3166 alpha-2, so `char(2)` never receives prose
 * (D42's failure was exactly this shape). Two-letter input passes straight
 * through uppercased. Unknown names become null rather than a guess.
 */
const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  'united states': 'US', usa: 'US',
  'united kingdom': 'GB', uk: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  germany: 'DE', deutschland: 'DE',
  france: 'FR',
  netherlands: 'NL',
  ireland: 'IE', 'republic of ireland': 'IE',
  spain: 'ES',
  italy: 'IT',
  sweden: 'SE',
  denmark: 'DK',
  finland: 'FI',
  norway: 'NO',
  switzerland: 'CH',
  austria: 'AT',
  belgium: 'BE',
  portugal: 'PT',
  canada: 'CA',
  australia: 'AU',
  japan: 'JP',
  india: 'IN',
  brazil: 'BR',
  poland: 'PL',
  czechia: 'CZ', 'czech republic': 'CZ',
  singapore: 'SG',
  'south korea': 'KR',
  israel: 'IL',
  'new zealand': 'NZ',
};

/**
 * Prose or ISO alpha-2 to an ISO alpha-2 code, or null where we do not recognise it.
 *
 * Exported because the Add Custom Vendor form needs exactly this: it took free text
 * straight into `char(2)`, so a user typing "Germany" got a raw Postgres
 * `value too long for type character(2)` and a shorter unrecognised word landed as
 * whatever two characters it happened to be (D42). One normaliser, used by both the
 * CSV import and the form, rather than two that disagree.
 */
export function normaliseCountry(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return COUNTRY_NAMES[key] ?? null;
}

const CRITICALITY_VALUES: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  low: 'low', medium: 'medium', high: 'high', critical: 'critical',
  'very low': 'low', 'very high': 'critical',
};

function normaliseCriticality(raw: string): 'low' | 'medium' | 'high' | 'critical' | null {
  return CRITICALITY_VALUES[raw.trim().toLowerCase()] ?? null;
}

/** Splits "Email, CRM" / "Email; CRM" / "Email | CRM" into clean values. */
function splitList(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function extractDomain(url: string): string | null {
  try {
    const candidate = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(candidate).hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Full URL for storage, or null when the cell is not even domain-shaped. */
function normaliseWebsite(raw: string): string | null {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export interface NormalisedRow {
  name: string;
  website: string | null;
  category: string | null;
  headquartersCountry: string | null;
  purpose: string | null;
  dataCategoriesShared: string[];
  businessOwner: string | null;
  contactEmail: string | null;
  criticality: 'low' | 'medium' | 'high' | 'critical' | null;
  /**
   * Values that were present in the file and are not in the register.
   *
   * A country spelling we do not know becomes `null`, which scores as an
   * unknown location and reads on screen exactly like a country nobody filled
   * in. Silence here is the failure mode: the row imports, the register looks
   * populated, and the location risk factor is quietly wrong. Saying so is
   * cheap and the preview has somewhere to put it.
   */
  warnings: string[];
  /** What the catalogue matcher matches on. */
  matchCandidate: { name: string; domain: string | null };
}

/** The register's own cap, applied here so both write paths agree. */
const MAX_NAME_LENGTH = 255;

/** One raw CSV row -> values safe to write, or the reason it cannot be. */
export function normaliseVendorRow(
  cells: string[],
  mapping: ColumnMapping,
): NormalisedRow | { error: string } {
  const get = (field: ImportableField): string | null => {
    const idx = mapping[field];
    if (idx === undefined) return null;
    const value = (cells[idx] ?? '').trim();
    return value === '' ? null : value;
  };

  const rawName = get('name');
  if (!rawName) return { error: 'A vendor name is required on every row.' };
  if (rawName.length > MAX_NAME_LENGTH) {
    return { error: `"${rawName.slice(0, 40)}…": the vendor name is longer than ${MAX_NAME_LENGTH} characters.` };
  }
  const name = rawName;

  const warnings: string[] = [];

  const websiteRaw = get('website');
  let website: string | null = null;
  if (websiteRaw) {
    website = normaliseWebsite(websiteRaw);
    if (!website) return { error: `"${name}": website "${websiteRaw}" does not parse as a URL.` };
  }

  const contactRaw = get('contactEmail');
  if (contactRaw && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactRaw)) {
    return { error: `"${name}": contact email "${contactRaw}" is not a valid email address.` };
  }

  const criticalityRaw = get('criticality');
  if (criticalityRaw && !normaliseCriticality(criticalityRaw)) {
    return { error: `"${name}": criticality "${criticalityRaw}" is not one of low, medium, high, critical.` };
  }

  const countryRaw = get('country');
  const headquartersCountry = countryRaw ? normaliseCountry(countryRaw) : null;
  if (countryRaw && !headquartersCountry) {
    warnings.push(`Country "${countryRaw}" was not recognised and has been left blank.`);
  }

  const categoriesRaw = get('dataCategoriesShared');
  const dataCategoriesShared = categoriesRaw
    ? normaliseDataCategoryList(splitList(categoriesRaw))
    : [];
  if (categoriesRaw && splitList(categoriesRaw).length > dataCategoriesShared.length) {
    warnings.push('Some data categories were merged as duplicates or dropped past the 50-value limit.');
  }

  const purposeRaw = get('purpose');
  if (purposeRaw && purposeRaw.length > 2000) {
    warnings.push('The purpose was truncated to 2,000 characters.');
  }

  const domain = website ? extractDomain(website) : null;

  return {
    name,
    website,
    category: get('category')?.slice(0, 100) ?? null,
    headquartersCountry,
    purpose: purposeRaw ? purposeRaw.slice(0, 2000) : null,
    dataCategoriesShared,
    businessOwner: get('businessOwner')?.slice(0, 255) ?? null,
    contactEmail: contactRaw,
    criticality: criticalityRaw ? normaliseCriticality(criticalityRaw) : null,
    warnings,
    matchCandidate: { name, domain },
  };
}

// ---------------------------------------------------------------------------
// Catalogue matching.
// ---------------------------------------------------------------------------

export interface CatalogueEntry {
  id: string;
  name: string;
  website: string | null;
  aliases: string[] | null;
}

/**
 * Levenshtein distance with an early exit above `max`, so scanning a
 * 3,000-row catalogue stays linear-ish per candidate.
 */
export function levenshtein(a: string, b: string, max = 4): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  let prevRow = prev as number[];
  let currRow = curr as number[];
  for (let i = 1; i <= a.length; i++) {
    currRow[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1).toLowerCase() === b.charAt(j - 1).toLowerCase() ? 0 : 1;
      const up = prevRow[j] ?? max + 1;
      const left = currRow[j - 1] ?? max + 1;
      const diag = prevRow[j - 1] ?? max + 1;
      const nextCell = Math.min(up + 1, left + 1, diag + cost);
      currRow[j] = nextCell;
      if (nextCell < rowMin) rowMin = nextCell;
    }
    if (rowMin > max) return max + 1;
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[b.length] ?? max + 1;
}

export const MATCH_EXACT_DOMAIN = 1.0;
export const MATCH_EXACT_NAME = 0.95;
export const MATCH_EXACT_ALIAS = 0.9;
/** At or above this the import links the catalogue row automatically. */
export const AUTO_LINK_THRESHOLD = 0.85;
/** Below this the row is imported as a custom vendor rather than guessed. */
export const MATCH_FLOOR = 0.6;

export interface CatalogueMatch {
  vendorId: string;
  confidence: number;
  method: 'domain' | 'name' | 'alias';
}

/**
 * The catalogue, prepared once for a whole file.
 *
 * `matchCatalogue` used to call `extractDomain(entry.website)` — a `new URL()`
 * — for every catalogue entry on every row, so a 500-row import against a
 * 3,000-row catalogue constructed a million and a half URL objects to answer
 * one question. Domains and lowercased names are hashed here instead, which
 * turns the two exact-match cases from a scan into a lookup and leaves only the
 * genuinely fuzzy case walking the list.
 */
export interface CatalogueIndex {
  entries: CatalogueEntry[];
  byId: Map<string, CatalogueEntry>;
  byDomain: Map<string, CatalogueEntry>;
  byName: Map<string, CatalogueEntry>;
  byAlias: Map<string, CatalogueEntry>;
}

export function buildCatalogueIndex(catalogue: CatalogueEntry[]): CatalogueIndex {
  const index: CatalogueIndex = {
    entries: catalogue,
    byId: new Map(),
    byDomain: new Map(),
    byName: new Map(),
    byAlias: new Map(),
  };

  for (const entry of catalogue) {
    index.byId.set(entry.id, entry);
    // First writer wins throughout: the seeded global catalogue is loaded ahead
    // of an organisation's own custom rows, so a customer's duplicate "Slack"
    // never shadows the canonical one.
    if (entry.website) {
      const domain = extractDomain(entry.website);
      if (domain && !index.byDomain.has(domain)) index.byDomain.set(domain, entry);
    }
    const name = entry.name.trim().toLowerCase();
    if (name && !index.byName.has(name)) index.byName.set(name, entry);
    for (const alias of entry.aliases ?? []) {
      const key = alias.trim().toLowerCase();
      if (key && !index.byAlias.has(key)) index.byAlias.set(key, entry);
    }
  }

  return index;
}

/**
 * Best catalogue entry for one row, or null under the floor.
 *
 * Domain equality beats exact name beats exact alias beats fuzzy distance. The
 * ordering is the confidence constants above, and it is stated here because the
 * previous version of this comment claimed alias beat name while the constants
 * said the opposite — the code was right, the sentence was not.
 *
 * Comparison is on www-stripped, lowercased hostnames; the public-suffix list
 * is P-7 work, not this sprint.
 */
export function matchCatalogue(
  candidate: { name: string; domain: string | null },
  catalogue: CatalogueIndex | CatalogueEntry[],
): CatalogueMatch | null {
  const index = Array.isArray(catalogue) ? buildCatalogueIndex(catalogue) : catalogue;
  const lowerName = candidate.name.trim().toLowerCase();

  // Exact domain cannot be beaten.
  if (candidate.domain) {
    const hit = index.byDomain.get(candidate.domain);
    if (hit) return { vendorId: hit.id, confidence: MATCH_EXACT_DOMAIN, method: 'domain' };
  }

  const nameHit = index.byName.get(lowerName);
  if (nameHit) return { vendorId: nameHit.id, confidence: MATCH_EXACT_NAME, method: 'name' };

  const aliasHit = index.byAlias.get(lowerName);
  if (aliasHit) return { vendorId: aliasHit.id, confidence: MATCH_EXACT_ALIAS, method: 'alias' };

  let best: CatalogueMatch | null = null;
  for (const entry of index.entries) {
    // Fuzzy distance is meaningless across wildly different lengths -- without
    // this guard "Totally Unrelated Consultancy GmbH" lands within edit
    // distance 4 of "Zendesk" and imports as it. A candidate may differ from
    // its catalogue name by at most two characters of length.
    if (Math.abs(candidate.name.length - entry.name.length) > 2) continue;

    const distance = levenshtein(candidate.name, entry.name, 4);
    const ratio = 1 - distance / Math.max(candidate.name.length, entry.name.length, 1);
    if (ratio >= MATCH_FLOOR && (!best || ratio > best.confidence)) {
      best = { vendorId: entry.id, confidence: Math.round(ratio * 100) / 100, method: 'name' };
    }
  }

  return best;
}
