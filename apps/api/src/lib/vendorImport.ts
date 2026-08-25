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

// ---------------------------------------------------------------------------
// Parsing.
// ---------------------------------------------------------------------------

/**
 * RFC 4180: quoted fields may contain commas, escaped quotes and line breaks;
 * rows end at CRLF or a bare LF. Tolerant of a trailing newline and of a BOM,
 * because both arrive from Excel exports daily. Blank rows are dropped —
 * Excel writes one at the end of every second file.
 */
export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

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
      field += char;
      continue;
    }

    if (char === ',') { pushField(); continue; }
    if (char === '"') { inQuotes = true; continue; }
    if (char === '\r') { pushRow(); continue; }
    if (char === '\n') { pushRow(); continue; }
    field += char;
  }

  if (field !== '' || row.length > 0) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
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

function normaliseCountry(raw: string): string | null {
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
  /** What the catalogue matcher matches on. */
  matchCandidate: { name: string; domain: string | null };
}

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

  const name = get('name');
  if (!name) return { error: 'A vendor name is required on every row.' };

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

  const domain = website ? extractDomain(website) : null;

  return {
    name,
    website,
    category: get('category'),
    headquartersCountry: get('country') ? normaliseCountry(get('country')!) : null,
    purpose: get('purpose'),
    dataCategoriesShared: get('dataCategoriesShared') ? splitList(get('dataCategoriesShared')!) : [],
    businessOwner: get('businessOwner'),
    contactEmail: contactRaw,
    criticality: criticalityRaw ? normaliseCriticality(criticalityRaw) : null,
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
 * Best catalogue entry for one row, or null under the floor.
 *
 * Domain equality beats exact alias beats exact name beats fuzzy distance —
 * the precedence `findMatchedVendor` uses in the discovery worker, stated as
 * ordered checks instead of nested ifs. Comparison is on www-stripped,
 * lowercased hostnames; the public-suffix list is P-7 work, not this sprint.
 */
export function matchCatalogue(
  candidate: { name: string; domain: string | null },
  catalogue: CatalogueEntry[],
): CatalogueMatch | null {
  let best: CatalogueMatch | null = null;

  const consider = (next: CatalogueMatch) => {
    if (!best || next.confidence > best.confidence) best = next;
  };

  const lowerName = candidate.name.toLowerCase();

  for (const entry of catalogue) {
    if (candidate.domain && entry.website) {
      const entryDomain = extractDomain(entry.website);
      if (entryDomain && candidate.domain === entryDomain) {
        // Exact domain cannot be beaten; stop scanning.
        return { vendorId: entry.id, confidence: MATCH_EXACT_DOMAIN, method: 'domain' };
      }
    }

    const aliasHit = (entry.aliases ?? []).some((a) => a.trim().toLowerCase() === lowerName);
    if (aliasHit) {
      consider({ vendorId: entry.id, confidence: MATCH_EXACT_ALIAS, method: 'alias' });
      continue;
    }

    if (entry.name.trim().toLowerCase() === lowerName) {
      consider({ vendorId: entry.id, confidence: MATCH_EXACT_NAME, method: 'name' });
      continue;
    }

    // Fuzzy distance is meaningless across wildly different lengths -- without
    // this guard "Totally Unrelated Consultancy GmbH" lands within edit
    // distance 4 of "Zendesk" and imports as it. A candidate may differ from
    // its catalogue name by at most two characters of length.
    if (Math.abs(candidate.name.length - entry.name.length) > 2) continue;

    const distance = levenshtein(candidate.name, entry.name, 4);
    const ratio = 1 - distance / Math.max(candidate.name.length, entry.name.length, 1);
    if (ratio >= MATCH_FLOOR) {
      consider({ vendorId: entry.id, confidence: Math.round(ratio * 100) / 100, method: 'name' });
    }
  }

  return best;
}
