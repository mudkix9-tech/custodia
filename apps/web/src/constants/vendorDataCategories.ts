/**
 * The picker's copy of the Art. 30(1)(d) vocabulary.
 *
 * Mirrors `apps/api/src/constants/vendorDataCategories.ts`, the same way
 * `constants/transferMechanisms.ts` mirrors its API counterpart: the API
 * validates, the web renders. Only the keys live here — the labels come from
 * the message catalogues, which is the whole point of having keys at all. The
 * previous version of this field was free text, so a German customer's
 * "Gesundheitsdaten" was invisible to an Article 9 check written in English.
 *
 * `special` drives the warning badge on the chip. It is duplicated rather than
 * fetched because it decides how the value *looks*, not what it *means* — the
 * risk engine reads the API's copy, which is the one that counts.
 */
export interface VendorDataCategoryOption {
  key: string;
  special: boolean;
}

export const VENDOR_DATA_CATEGORIES: readonly VendorDataCategoryOption[] = [
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
  { key: 'health_data', special: true },
  { key: 'genetic_data', special: true },
  { key: 'biometric_data_for_id', special: true },
  { key: 'racial_or_ethnic_origin', special: true },
  { key: 'political_opinions', special: true },
  { key: 'religious_or_philosophical_beliefs', special: true },
  { key: 'trade_union_membership', special: true },
  { key: 'sex_life', special: true },
  { key: 'sexual_orientation', special: true },
  { key: 'criminal_offence_data', special: true },
];

const BY_KEY = new Map(VENDOR_DATA_CATEGORIES.map((c) => [c.key, c]));

export function isKnownDataCategory(value: string): boolean {
  return BY_KEY.has(value);
}

export function isSpecialDataCategory(value: string): boolean {
  return BY_KEY.get(value)?.special ?? false;
}

export const MAX_DATA_CATEGORIES = 50;
export const MAX_DATA_CATEGORY_LENGTH = 120;
