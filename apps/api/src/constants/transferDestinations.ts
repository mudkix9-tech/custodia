export const EU_EEA_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA additions
  'IS', 'LI', 'NO',
];

/**
 * When a human last checked this list against the Commission's own page — VD-10.
 *
 * The list below is hand-maintained and there is no feed behind it, which is
 * fine: adequacy decisions are rare, deliberate and announced. What is not fine
 * is a hand-maintained list with no way to tell whether anybody has looked
 * lately, because an adequacy decision that has been *withdrawn* leaves this
 * file asserting a Chapter V safeguard that no longer exists, and it does so
 * silently and identically to a correct entry.
 *
 * So the staleness is the tested thing rather than the contents:
 * `test:transfers` fails once this date is twelve months old, which turns a
 * quiet drift into a red build. The review is a five-minute job — open
 * `https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en`,
 * compare, and move this date whether or not anything changed. Moving it
 * without looking is the one thing that defeats the whole mechanism.
 *
 * Checked against the Commission's list on the date below: fifteen decisions,
 * Canada still commercial-only, the US still DPF-scoped, and the two 2025
 * reviews (Japan, UK) both continued.
 */
export const ADEQUACY_REVIEWED_ON = '2026-08-29';

/** How long a review stands before `test:transfers` calls the list unverified. */
export const ADEQUACY_REVIEW_INTERVAL_MONTHS = 12;

/**
 * Whether the adequacy list is overdue a review, as of `now`.
 *
 * Exported so the fixture and any future surface ask the same question rather
 * than each doing their own date arithmetic — and calendar-aware for the same
 * reason `computeDisposalDate` is: adding twelve months to 29 February is
 * 28 February, not 1 March.
 */
export function isAdequacyReviewOverdue(now: Date = new Date()): boolean {
  const reviewed = new Date(`${ADEQUACY_REVIEWED_ON}T00:00:00Z`);
  const due = new Date(reviewed);
  due.setUTCMonth(due.getUTCMonth() + ADEQUACY_REVIEW_INTERVAL_MONTHS);
  // setUTCMonth rolls a day that the target month does not have into the next
  // month (31 January + 1 month reads as 3 March in a leap year), so clamp back
  // to the last day of the intended month.
  if (due.getUTCDate() !== reviewed.getUTCDate()) due.setUTCDate(0);
  return now.getTime() >= due.getTime();
}

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
