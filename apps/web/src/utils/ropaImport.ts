import { indexHeaders, parseCsv } from './csv';

/**
 * Validation for the ROPA CSV import.
 *
 * The rule this enforces: a row that does not carry a lawful basis is rejected,
 * never defaulted. The previous importer fell back to `legitimate_interest`,
 * which writes an Article 6 basis the customer never chose into their register —
 * the single field a regulator is most likely to ask them to justify. Silence
 * was the whole problem, so every rejection is reported with its line number.
 */

export const LAWFUL_BASES = [
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interest',
] as const;

export const ROPA_STATUSES = ['draft', 'active', 'under_review', 'archived'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

/** The exporter's own headers, plus the spellings a hand-built file is likely to use. */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'activity', 'activity name', 'processing activity'],
  purpose: ['purpose', 'purpose of processing'],
  lawfulBasis: ['lawful basis', 'lawfulbasis', 'legal basis', 'article 6 basis'],
  status: ['status'],
  riskLevel: ['risk level', 'risklevel', 'risk'],
  description: ['description', 'notes'],
};

export type ImportedActivity = {
  name: string;
  purpose: string;
  lawfulBasis: string;
  status: string;
  riskLevel: string;
  description: string;
};

export type RowError = { line: number; message: string };

export type ImportResult = {
  activities: ImportedActivity[];
  errors: RowError[];
  /** Set when the file could not be read at all; `activities` is then empty. */
  fatal?: string;
};

/** `Legitimate Interests` and `legitimate_interest` are the same basis. */
function normaliseEnum(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function matchEnum(value: string, allowed: readonly string[]): string | null {
  const v = normaliseEnum(value);
  if (allowed.includes(v)) return v;
  // The onboarding templates and several regulator exports pluralise these two.
  const singular = v.replace(/s$/, '');
  return allowed.includes(singular) ? singular : null;
}

export function parseRopaCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { activities: [], errors: [], fatal: 'The file is empty.' };

  const [header, ...body] = rows;
  const cols = indexHeaders(header, HEADER_ALIASES);

  const missing = (['name', 'purpose', 'lawfulBasis'] as const).filter((k) => cols[k] === -1);
  if (missing.length > 0) {
    return {
      activities: [],
      errors: [],
      fatal:
        `The file is missing required column${missing.length > 1 ? 's' : ''}: ` +
        `${missing.map((k) => HEADER_ALIASES[k][0]).join(', ')}. ` +
        `Export the register first to get a file with the expected headers.`,
    };
  }

  if (body.length === 0) return { activities: [], errors: [], fatal: 'The file has headers but no rows.' };

  const activities: ImportedActivity[] = [];
  const errors: RowError[] = [];

  body.forEach((row, i) => {
    // +2: one for the header row, one because humans count from 1.
    const line = i + 2;
    const at = (key: string) => (cols[key] === -1 ? '' : (row[cols[key]] ?? '').trim());

    const name = at('name');
    const purpose = at('purpose');
    const rawBasis = at('lawfulBasis');

    if (!name) {
      errors.push({ line, message: 'No activity name.' });
      return;
    }
    if (!purpose) {
      errors.push({ line, message: `"${name}" has no purpose.` });
      return;
    }
    if (!rawBasis) {
      errors.push({ line, message: `"${name}" has no lawful basis. Add one and re-import — it cannot be guessed.` });
      return;
    }

    const lawfulBasis = matchEnum(rawBasis, LAWFUL_BASES);
    if (!lawfulBasis) {
      errors.push({
        line,
        message: `"${name}" has an unrecognised lawful basis "${rawBasis}". Expected one of: ${LAWFUL_BASES.join(', ')}.`,
      });
      return;
    }

    const rawStatus = at('status');
    const status = rawStatus ? matchEnum(rawStatus, ROPA_STATUSES) : 'draft';
    if (!status) {
      errors.push({ line, message: `"${name}" has an unrecognised status "${rawStatus}".` });
      return;
    }

    const rawRisk = at('riskLevel');
    const riskLevel = rawRisk ? matchEnum(rawRisk, RISK_LEVELS) : 'low';
    if (!riskLevel) {
      errors.push({ line, message: `"${name}" has an unrecognised risk level "${rawRisk}".` });
      return;
    }

    activities.push({ name, purpose, lawfulBasis, status, riskLevel, description: at('description') });
  });

  return { activities, errors };
}
