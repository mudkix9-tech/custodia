/**
 * The controlled vocabulary for `organization_vendors.data_categories_shared` —
 * Art. 30(1)(d), "the categories of personal data" going to this recipient.
 *
 * This is a vocabulary rather than free text because something *reads* the
 * field. The risk engine's Art. 9 factor and the `missing_dpa_special_category`
 * gap rule both ask "does this vendor receive special-category data", and the
 * first version of that question was a substring scan for the English words
 * `health`, `biometric`, `racial`… against whatever the customer had typed. The
 * module ships in three languages: a German customer typing `Gesundheitsdaten`
 * into a field whose placeholder reads `z. B. Kontaktdaten` would never trip the
 * Art. 9 factor, and nothing anywhere would say so. A vocabulary of keys is
 * locale-independent by construction, and the web workspace renders the labels.
 *
 * Free text is still accepted — a spreadsheet import cannot be made to speak our
 * vocabulary, and refusing the row would lose the fact entirely. Anything
 * unrecognised is kept verbatim and still passed through the keyword fallback
 * below, which is the old scan widened to the three languages we ship. The
 * ordering matters: a recognised key is a *decision*, the keyword scan is a
 * *guess*, and the guess only runs where there is no decision to read.
 */

export interface VendorDataCategory {
  key: string;
  /** Art. 9(1), or Art. 10 for criminal-offence data — both escalate the risk. */
  special: boolean;
}

export const VENDOR_DATA_CATEGORIES: readonly VendorDataCategory[] = [
  // Ordinary categories, commonest first — this is the order the picker shows.
  { key: 'contact_details', special: false },
  { key: 'identity_details', special: false },
  { key: 'account_credentials', special: false },
  { key: 'employment_details', special: false },
  { key: 'financial_details', special: false },
  { key: 'payment_card_data', special: false },
  { key: 'government_identifiers', special: false },
  { key: 'location_data', special: false },
  { key: 'device_and_usage_data', special: false },
  { key: 'communications_content', special: false },
  { key: 'customer_support_records', special: false },
  { key: 'marketing_preferences', special: false },
  { key: 'behavioural_profiling_data', special: false },
  { key: 'childrens_data', special: false },
  { key: 'user_generated_content', special: false },

  // Article 9(1). The nine, named as the Article names them.
  { key: 'health_data', special: true },
  { key: 'genetic_data', special: true },
  { key: 'biometric_data_for_id', special: true },
  { key: 'racial_or_ethnic_origin', special: true },
  { key: 'political_opinions', special: true },
  { key: 'religious_or_philosophical_beliefs', special: true },
  { key: 'trade_union_membership', special: true },
  { key: 'sex_life', special: true },
  { key: 'sexual_orientation', special: true },

  // Article 10. Not a special category, but it carries the same handling weight
  // and a DPO who omits it from this list has under-described the transfer.
  { key: 'criminal_offence_data', special: true },
];

export const VENDOR_DATA_CATEGORY_KEYS: readonly string[] =
  VENDOR_DATA_CATEGORIES.map((c) => c.key);

const SPECIAL_KEYS: ReadonlySet<string> = new Set(
  VENDOR_DATA_CATEGORIES.filter((c) => c.special).map((c) => c.key),
);

/**
 * Keyword fallback for values that are not vocabulary keys — a CSV column, or a
 * row written before the picker existed.
 *
 * English, German and French, because the module is translated into all three
 * and the import accepts whatever the spreadsheet says. Matched as substrings
 * against a lowercased, accent-stripped value, so `Gesundheitsdaten`,
 * `données de santé` and `Health records` all land on the same answer.
 */
const SPECIAL_CATEGORY_KEYWORDS: readonly string[] = [
  // English
  'health', 'medical', 'biometric', 'genetic', 'racial', 'ethnic', 'political',
  'religious', 'philosophical', 'trade union', 'union membership', 'sex life',
  'sexual', 'criminal', 'conviction', 'offence', 'disability', 'special category',
  // German
  'gesundheit', 'medizin', 'biometri', 'genetisch', 'rassisch', 'ethnisch',
  'politisch', 'religio', 'weltanschau', 'gewerkschaft', 'sexualleben',
  'sexuelle', 'straf', 'behinderung', 'besondere kategorien',
  // French
  'sante', 'medical', 'biometri', 'genetique', 'racial', 'ethnique', 'politique',
  'religieu', 'philosophiqu', 'syndica', 'vie sexuelle', 'orientation sexuelle',
  'penal', 'condamnation', 'handicap', 'categories particulieres',
];

/** Lowercased and stripped of diacritics, so `santé` matches `sante`. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** One value — a vocabulary key or free text — against Art. 9 / Art. 10. */
export function isSpecialCategoryValue(value: string): boolean {
  if (SPECIAL_KEYS.has(value)) return true;
  // Not a key we know: fall back to the keyword scan rather than answering "no",
  // which is the answer that loses an Art. 9 finding.
  if ((VENDOR_DATA_CATEGORY_KEYS as readonly string[]).includes(value)) return false;
  const folded = fold(value);
  return SPECIAL_CATEGORY_KEYWORDS.some((keyword) => folded.includes(keyword));
}

/** Does this vendor receive special-category data? */
export function hasSpecialCategory(values: readonly string[] | null | undefined): boolean {
  return (values ?? []).some((value) => typeof value === 'string' && isSpecialCategoryValue(value));
}

/**
 * Free text -> a vocabulary key where one clearly fits, otherwise null.
 *
 * Used by the CSV import so that "Health data", "Gesundheitsdaten" and
 * "health_data" all arrive in the register as the same value, which is what lets
 * "which vendors receive health data?" be a query rather than a reading
 * exercise. Deliberately conservative: an unmatched value is kept as the
 * customer wrote it rather than forced onto the nearest key.
 */
const CATEGORY_SYNONYMS: Readonly<Record<string, string>> = {
  // contact
  'contact': 'contact_details', 'contact data': 'contact_details',
  'contact details': 'contact_details', 'kontaktdaten': 'contact_details',
  'donnees de contact': 'contact_details', 'email': 'contact_details',
  'email address': 'contact_details', 'e-mail': 'contact_details',
  // identity
  'name': 'identity_details', 'names': 'identity_details',
  'identity': 'identity_details', 'identity data': 'identity_details',
  'identitatsdaten': 'identity_details', 'donnees d identite': 'identity_details',
  // credentials
  'credentials': 'account_credentials', 'passwords': 'account_credentials',
  'zugangsdaten': 'account_credentials', 'identifiants': 'account_credentials',
  // employment
  'hr': 'employment_details', 'hr data': 'employment_details',
  'employee data': 'employment_details', 'employment': 'employment_details',
  'personaldaten': 'employment_details', 'donnees rh': 'employment_details',
  // financial
  'financial': 'financial_details', 'financial data': 'financial_details',
  'bank details': 'financial_details', 'finanzdaten': 'financial_details',
  'donnees financieres': 'financial_details',
  'payment': 'payment_card_data', 'payment data': 'payment_card_data',
  'card data': 'payment_card_data', 'zahlungsdaten': 'payment_card_data',
  // identifiers
  'national id': 'government_identifiers', 'passport': 'government_identifiers',
  'ssn': 'government_identifiers', 'tax id': 'government_identifiers',
  'ausweisnummer': 'government_identifiers',
  // technical
  'location': 'location_data', 'standortdaten': 'location_data',
  'geolocation': 'location_data', 'donnees de localisation': 'location_data',
  'ip address': 'device_and_usage_data', 'device data': 'device_and_usage_data',
  'usage data': 'device_and_usage_data', 'nutzungsdaten': 'device_and_usage_data',
  'analytics': 'device_and_usage_data',
  // content
  'messages': 'communications_content', 'emails': 'communications_content',
  'kommunikationsinhalte': 'communications_content',
  'support tickets': 'customer_support_records',
  'marketing': 'marketing_preferences',
  'profiling': 'behavioural_profiling_data',
  'children': 'childrens_data', 'kinderdaten': 'childrens_data',
  // special
  'health': 'health_data', 'health data': 'health_data',
  'medical data': 'health_data', 'gesundheitsdaten': 'health_data',
  'donnees de sante': 'health_data',
  'genetic': 'genetic_data', 'genetic data': 'genetic_data',
  'biometric': 'biometric_data_for_id', 'biometric data': 'biometric_data_for_id',
  'biometrische daten': 'biometric_data_for_id',
  'ethnicity': 'racial_or_ethnic_origin', 'race': 'racial_or_ethnic_origin',
  'religion': 'religious_or_philosophical_beliefs',
  'trade union membership': 'trade_union_membership',
  'union membership': 'trade_union_membership',
  'gewerkschaftszugehorigkeit': 'trade_union_membership',
  'criminal records': 'criminal_offence_data',
  'criminal convictions': 'criminal_offence_data',
  'strafrechtliche daten': 'criminal_offence_data',
};

export function normaliseDataCategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if ((VENDOR_DATA_CATEGORY_KEYS as readonly string[]).includes(trimmed)) return trimmed;

  const folded = fold(trimmed);
  // `Health Data` and `health_data` fold to the same lookup.
  const underscored = folded.replace(/[\s-]+/g, '_');
  if ((VENDOR_DATA_CATEGORY_KEYS as readonly string[]).includes(underscored)) return underscored;

  return CATEGORY_SYNONYMS[folded] ?? trimmed;
}

/** The cap the register enforces, shared by every write path. */
export const MAX_DATA_CATEGORIES = 50;
export const MAX_DATA_CATEGORY_LENGTH = 120;

/**
 * Clean a list from any source: normalise, drop blanks, de-duplicate
 * case-insensitively, truncate over-long free text, and cap the list.
 *
 * The tRPC input and the CSV import both go through this, because a validation
 * rule that exists on one write path and not the other is a rule that describes
 * nothing about what is in the column.
 */
export function normaliseDataCategoryList(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalised = normaliseDataCategory(value).slice(0, MAX_DATA_CATEGORY_LENGTH);
    if (!normalised) continue;
    const dedupeKey = fold(normalised);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(normalised);
    if (out.length >= MAX_DATA_CATEGORIES) break;
  }
  return out;
}
