// List of EU/EEA country codes (ISO-2)
export const EU_EEA_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'FI', 'IS', 'LI', 'NO'
];

export interface VendorProfile {
  name: string;
  headquartersCountry: string | null;
  parentCompanyCountry?: string | null;
  dpaUrl: string | null;
  isDpfCertified: boolean;
  sccsInDpa: boolean;
  subProcessorNotificationType: 'webpage' | 'email' | 'none' | string | null;
  dataResidencyOptions: string[]; // e.g. ["eu", "us"]
  breachNotificationTerms: string | null;
  dataDeletionOnTermination: string | null;
  subProcessorObjectionWindow: string | null; // e.g. "30 days" or null
}

/**
 * Calculates dynamic risk flags for a vendor profile using the defined legal/automation rules.
 */
export function getDerivedRiskFlags(vendor: VendorProfile): string[] {
  const flags: string[] = [];

  // Helper variables
  const hq = vendor.headquartersCountry?.toUpperCase() || null;
  const parentHq = vendor.parentCompanyCountry?.toUpperCase() || null;
  const isEuHq = hq ? EU_EEA_COUNTRIES.includes(hq) : false;

  // 1. dpf_only: isDpfCertified AND NOT sccsInDpa
  if (vendor.isDpfCertified && !vendor.sccsInDpa) {
    flags.push('dpf_only');
  }

  // 2. no_sccs: NOT sccsInDpa
  if (!vendor.sccsInDpa) {
    flags.push('no_sccs');
  }

  // 3. no_dpa: dpaUrl is null
  if (!vendor.dpaUrl || vendor.dpaUrl.trim() === '') {
    flags.push('no_dpa');
  }

  // 4. passive_subprocessor_notification: subProcessorNotificationType is "webpage"
  if (vendor.subProcessorNotificationType === 'webpage') {
    flags.push('passive_subprocessor_notification');
  }

  // 5. no_eu_residency: "eu" not in dataResidencyOptions
  const hasEuResidency = vendor.dataResidencyOptions.some(option => option.toLowerCase() === 'eu');
  if (!hasEuResidency) {
    flags.push('no_eu_residency');
  }

  // 6. undue_delay_breach_terms: breachNotificationTerms contains "undue delay" AND no numeric hour/day cap
  if (vendor.breachNotificationTerms) {
    const termsLower = vendor.breachNotificationTerms.toLowerCase();
    const containsUndueDelay = termsLower.includes('undue delay');
    const hasNumericCap = /\b\d+\s*(calendar\s+|business\s+)?(hours?|days?)\b/.test(termsLower);
    if (containsUndueDelay && !hasNumericCap) {
      flags.push('undue_delay_breach_terms');
    }
  }

  // 7. no_deletion_timeline: dataDeletionOnTermination is vague or unspecified
  if (vendor.dataDeletionOnTermination) {
    const deletionLower = vendor.dataDeletionOnTermination.toLowerCase();
    const isVague = deletionLower.includes('vague') ||
                    deletionLower.includes('unspecified') ||
                    deletionLower.includes('reasonable time') ||
                    deletionLower.includes('as soon as practicable') ||
                    deletionLower.includes('upon request') ||
                    deletionLower.trim() === '';
    if (isVague) {
      flags.push('no_deletion_timeline');
    }
  } else {
    flags.push('no_deletion_timeline');
  }

  // 8. no_objection_window: subProcessorObjectionWindow is null
  if (!vendor.subProcessorObjectionWindow || vendor.subProcessorObjectionWindow.trim() === '') {
    flags.push('no_objection_window');
  }

  // 9. us_parent_company: headquartersCountry is not in EU/EEA AND parentCompany headquarters is US
  const isNotEuHq = !isEuHq;
  const parentIsUs = parentHq === 'US';
  if (isNotEuHq && parentIsUs) {
    flags.push('us_parent_company');
  }

  return flags;
}
