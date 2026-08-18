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

/**
 * Recognised on the way in, so a file exported from this product round-trips and a
 * row saying "active" gets a sentence explaining itself rather than "unrecognised
 * status". What may actually be *imported* is `IMPORTABLE_STATUSES` — an imported
 * row arrives with no data subjects, no data categories and no recipients, so it
 * cannot meet the Art. 30 publication gate.
 */
export const ROPA_STATUSES = ['draft', 'active', 'under_review', 'archived'] as const;

/**
 * What may actually be imported. 'active' is recognised above so a file exported
 * from this product round-trips and the row gets a sentence explaining itself
 * rather than "unrecognised status" — but it cannot be imported: a row arrives with
 * no data subjects, no data categories and no recipients, so it cannot meet the
 * Art. 30 publication gate.
 */
export const IMPORTABLE_STATUSES = ['draft', 'under_review', 'archived'] as const;
export type ImportableStatus = (typeof IMPORTABLE_STATUSES)[number];

function isImportableStatus(value: string): value is ImportableStatus {
  return (IMPORTABLE_STATUSES as readonly string[]).includes(value);
}

/** Art. 30(1) is the controller's record; 30(2) is the processor's. */
export const ROPA_ROLES = ['controller', 'processor', 'joint_controller'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

/** The exporter's own headers, plus the spellings a hand-built file is likely to use. */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'activity', 'activity name', 'processing activity'],
  purpose: ['purpose', 'purpose of processing'],
  lawfulBasis: ['lawful basis', 'lawfulbasis', 'legal basis', 'article 6 basis'],
  status: ['status'],
  riskLevel: ['risk level', 'risklevel', 'risk'],
  description: ['description', 'notes'],
  role: ['role', 'controller or processor', 'capacity'],
  controllerName: ['controller', 'controller name', 'on behalf of'],
};

export type ImportedActivity = {
  name: string;
  purpose: string;
  lawfulBasis: string;
  status: ImportableStatus;
  riskLevel: string;
  description: string;
  role: 'controller' | 'processor' | 'joint_controller';
  controllerName?: string;
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
    // Named and refused, the same way an unrecognised lawful basis is, rather than
    // downgraded behind the importer's back — the row is one edit away from being
    // importable, and a silent change of status is the class of bug D10 was.
    // A predicate rather than a cast, so adding a status to ROPA_STATUSES without
    // deciding whether it is importable fails here rather than at runtime.
    if (!isImportableStatus(status)) {
      errors.push({
        line,
        message: `"${name}" is marked ${status}. An activity becomes active once its record is complete; import it as draft and publish it from the editor.`,
      });
      return;
    }

    const rawRisk = at('riskLevel');
    const riskLevel = rawRisk ? matchEnum(rawRisk, RISK_LEVELS) : 'low';
    if (!riskLevel) {
      errors.push({ line, message: `"${name}" has an unrecognised risk level "${rawRisk}".` });
      return;
    }

    // A file without a role column is a controller register: that is what every
    // row written before the column existed was, and what the exporter emitted.
    const rawRole = at('role');
    const role = rawRole ? matchEnum(rawRole, ROPA_ROLES) : 'controller';
    if (!role) {
      errors.push({
        line,
        message: `"${name}" has an unrecognised role "${rawRole}". Expected one of: ${ROPA_ROLES.join(', ')}.`,
      });
      return;
    }

    const controllerName = at('controllerName');
    if (role === 'processor' && !controllerName) {
      errors.push({
        line,
        message: `"${name}" is a processor activity with no controller named. Article 30(2)(a) requires it.`,
      });
      return;
    }

    activities.push({
      name,
      purpose,
      lawfulBasis,
      status,
      riskLevel,
      description: at('description'),
      role: role as ImportedActivity['role'],
      controllerName: controllerName || undefined,
    });
  });

  return { activities, errors };
}
