/**
 * The security-certification vocabulary (audit P-4).
 *
 * Three data sources describe the same fact in three incompatible shapes: the
 * seed writes `soc2`, the gatherer's model returns `SOC 2 Type II`, and a CSV
 * column says whatever the spreadsheet says. The risk engine matches by
 * substring today (`c.includes('soc2') || c.includes('soc 2')`), which survives
 * the first two spellings and nothing else — and every unmatched spelling scores
 * as "no certifications", which is the direction that inflates the high-risk
 * tile rather than the one that flatters it.
 *
 * Like `transferMechanisms.ts`: the API constrains input to this list, the
 * label is a translation key resolved in the UI, and everything arriving at the
 * boundary maps into it before it is stored.
 */
export const VENDOR_CERTIFICATIONS = [
  'soc2',
  'soc3',
  'iso27001',
  'iso27017',
  'iso27018',
  'iso27701',
  'iso42001',
  'pci_dss',
  'hipaa',
  'gdpr_compliant',
  'csa_star',
  'fedramp',
] as const;

export type VendorCertification = (typeof VENDOR_CERTIFICATIONS)[number];

/**
 * Folded spelling -> vocabulary key. Keys are looked up through the same table,
 * so `soc2` maps to itself and the lookup never special-cases the canonical
 * form. Matched against the folded (lowercased, punctuation stripped) value, so
 * `ISO/IEC 27001:2022`, `iso-27001` and `SOC 2 Type II` all land.
 */
const CERTIFICATION_SYNONYMS: Readonly<Record<string, string>> = {
  // Keys are looked up FOLDED (lowercased, non-alphanumerics stripped), so the
  // keys below are folded forms too — "SOC 2 Type II" arrives as `soc2typeii`.
  soc2: 'soc2',
  soc_2: 'soc2',
  socii: 'soc2',
  soc2typeii: 'soc2',
  soc2type1: 'soc2',
  soctypeii: 'soc2',
  soctype1: 'soc2',
  soc_ii: 'soc2',
  soc_type_ii: 'soc2',
  soc_type_1: 'soc2',
  soc3: 'soc3',
  soc_3: 'soc3',
  iso27001: 'iso27001',
  isoiec270012022: 'iso27001',
  iso270012022: 'iso27001',
  isoiec27001: 'iso27001',
  iso27002: 'iso27001',
  iso27017: 'iso27017',
  isoiec27017: 'iso27017',
  iso27018: 'iso27018',
  isoiec27018: 'iso27018',
  iso27701: 'iso27701',
  isoiec27701: 'iso27701',
  iso42001: 'iso42001',
  isoiec42001: 'iso42001',
  pcidss: 'pci_dss',
  pci: 'pci_dss',
  pcidssv40: 'pci_dss',
  hipaa: 'hipaa',
  gdpr: 'gdpr_compliant',
  gdprcompliant: 'gdpr_compliant',
  csastar: 'csa_star',
  star: 'csa_star',
  csastarlevel1: 'csa_star',
  csastarlevel2: 'csa_star',
  fedramp: 'fedramp',
};

/** Lowercase, strip diacritics and everything non-alphanumeric. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * One raw value -> its vocabulary key, or null when nothing fits.
 *
 * Deliberately conservative in the same direction as
 * `normaliseDataCategory`: an unmatched value returns null so callers keep the
 * original string verbatim rather than forcing it onto the nearest neighbour.
 */
export function normaliseCertification(raw: string): VendorCertification | null {
  if (!raw) return null;
  const key = CERTIFICATION_SYNONYMS[fold(raw)];
  if (!key) return null;
  return (VENDOR_CERTIFICATIONS as readonly string[]).includes(key)
    ? (key as VendorCertification)
    : null;
}

/**
 * A whole list -> the canonical subset, order-preserving and de-duplicated.
 * Unrecognised values are kept verbatim after the mapped ones: dropping them
 * would lose a fact the customer typed, and the risk engine's substring scan
 * still gets a chance at them.
 */
export function normaliseCertificationList(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const mapped = normaliseCertification(trimmed);
    if (mapped) {
      if (!seen.has(mapped)) {
        seen.add(mapped);
        out.push(mapped);
      }
      continue;
    }
    const dedupeKey = fold(trimmed);
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Does this list certify SOC 2 / ISO 27001? The risk engine asked this by
 * substring over mixed-case free text; both ends now ask it over the mapped
 * vocabulary, with the substring scan kept as the fallback for the verbatim
 * tail that mapping did not recognise.
 */
export function hasCertification(values: readonly string[], target: 'soc2' | 'iso27001'): boolean {
  return (values ?? []).some((value) => {
    if (typeof value !== 'string') return false;
    const mapped = normaliseCertification(value);
    if (mapped === target) return true;
    if ((VENDOR_CERTIFICATIONS as readonly string[]).includes(value)) return false;
    // Fallback only for values the vocabulary could not place — a recognised
    // key that is not the target must answer false, not re-scan.
    const folded = fold(target);
    return fold(value).includes(folded.replace('iso', ''));
  });
}
