export const EU_EEA_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA additions
  'IS', 'LI', 'NO',
];

export const ADEQUACY_DECISIONS: Record<string, { date: string; scope: string }> = {
  'AD': { date: '2010-12-01', scope: 'full' },         // Andorra
  'AR': { date: '2003-07-01', scope: 'full' },         // Argentina
  'CA': { date: '2002-01-04', scope: 'commercial' },   // Canada (commercial only)
  'FO': { date: '2010-03-09', scope: 'full' },         // Faroe Islands
  'GG': { date: '2003-11-21', scope: 'full' },         // Guernsey
  'IL': { date: '2011-01-31', scope: 'full' },         // Israel
  'IM': { date: '2004-04-28', scope: 'full' },         // Isle of Man
  'JP': { date: '2019-01-23', scope: 'full' },         // Japan
  'JE': { date: '2008-05-08', scope: 'full' },         // Jersey
  'NZ': { date: '2012-12-19', scope: 'full' },         // New Zealand
  'KR': { date: '2021-12-17', scope: 'full' },         // South Korea
  'CH': { date: '2000-07-26', scope: 'full' },         // Switzerland
  'UY': { date: '2012-08-21', scope: 'full' },         // Uruguay
  'GB': { date: '2021-06-28', scope: 'full' },         // United Kingdom
  'US': { date: '2023-07-10', scope: 'data_privacy_framework' }, // US (DPF only, certified orgs)
};

export function isAdequateDestination(countryCode: string): boolean {
  return EU_EEA_COUNTRIES.includes(countryCode) || countryCode in ADEQUACY_DECISIONS;
}

export function getDestinationContext(countryCode: string) {
  if (EU_EEA_COUNTRIES.includes(countryCode)) {
    return { status: 'eu_eea', requiresTransferMechanism: false };
  }
  if (countryCode in ADEQUACY_DECISIONS) {
    return {
      status: 'adequate',
      requiresTransferMechanism: false,
      adequacyDate: ADEQUACY_DECISIONS[countryCode]?.date,
      adequacyScope: ADEQUACY_DECISIONS[countryCode]?.scope,
    };
  }
  return { status: 'third_country', requiresTransferMechanism: true };
}
