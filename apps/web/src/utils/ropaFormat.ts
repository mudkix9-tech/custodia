/**
 * Display and normalisation helpers for the register's stored enum values.
 *
 * `processing_activities` stores machine keys — `6_months`, `legitimate_interest`,
 * `duration_of_contract` — and the list, the CSV and both PDFs printed them exactly
 * as stored, to users and to supervisory authorities. The message catalogue already
 * carries a translation for every one of them; nothing was looking them up.
 *
 * Retention is the awkward one, and deliberately so. The column is a free varchar,
 * the editor offers seven presets, and the onboarding templates seed prose that is
 * a better answer than any preset ("7 years (statutory requirement for tax audit
 * purposes)"). So a value is either a preset key, which translates, or it is the
 * user's own words, which are shown as written. Anything else — including the
 * literal string `custom`, which the Custom option used to write — is neither.
 */

export const LAWFUL_BASIS_KEYS = [
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interest',
] as const;

export const RETENTION_PRESET_KEYS = [
  '6_months',
  '1_year',
  '3_years',
  '5_years',
  'duration_of_contract',
  'indefinite',
] as const;

/**
 * The onboarding templates and several regulator exports pluralise this one basis,
 * which the editor's select cannot represent — it rendered empty, and the amber
 * "an LIA is required" panel never appeared for ten of the seeded activities.
 * The CSV importer already did this; it is the same rule.
 */
export function normaliseLawfulBasis(value?: string | null): string {
  if (!value) return '';
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((LAWFUL_BASIS_KEYS as readonly string[]).includes(v)) return v;
  const singular = v.replace(/s$/, '');
  return (LAWFUL_BASIS_KEYS as readonly string[]).includes(singular) ? singular : v;
}

export function isLawfulBasisKey(value?: string | null): boolean {
  return !!value && (LAWFUL_BASIS_KEYS as readonly string[]).includes(normaliseLawfulBasis(value));
}

export function isRetentionPreset(value?: string | null): boolean {
  return !!value && (RETENTION_PRESET_KEYS as readonly string[]).includes(value);
}

/**
 * True when the stored retention is the user's own words rather than a preset.
 * `custom` is excluded: the Custom option wrote that literal string and rendered no
 * field to put anything in, so it means "nothing was recorded", not a period.
 */
export function isCustomRetention(value?: string | null): boolean {
  return !!value && value !== 'custom' && !isRetentionPreset(value);
}
