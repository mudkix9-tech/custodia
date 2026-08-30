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

/**
 * How a destination stands under Chapter V once the caller's own evidence is in.
 *
 * `conditional` is the state VD-23 exists to make representable. An adequacy
 * decision is not always a statement about a *country*: the US decision covers
 * only organisations holding a current Data Privacy Framework certification,
 * which is a property of the recipient, is published per entity, and lapses
 * without the decision itself changing. A caller that cannot evidence the
 * condition has not established adequacy — and "we did not check" is not "yes",
 * which is the distinction VD-14 drew for an unrecorded country and VD-13 for
 * `dpa_available`. The scope discriminator was carried here from the start and
 * read by nothing for a year, so every surface but the vendor risk score
 * reported an uncertified US importer as adequate.
 */
export type AdequacyState = 'eu_eea' | 'adequate' | 'conditional' | 'third_country';

/** The transfer-mechanism vocabulary value that evidences the US condition. */
export const DPF_MECHANISM = 'data_privacy_framework';

/**
 * Decisions whose condition attaches to the recipient *and* which this product
 * can actually evidence.
 *
 * Only the DPF is in here, and Canada's `commercial` scope deliberately is not.
 * The difference is whether anything in Custodia can answer the question. DPF
 * certification is per-entity, published by the Department of Commerce, synced
 * weekly into `dpf_registrations`, and lapses — so a caller either has the
 * answer or is admitting it did not look. Canada's decision narrows by *sector*
 * (PIPEDA covers commercial organisations, not federal public bodies) and the
 * product models no sector for a recipient, so treating CA as unevidenced would
 * fail every Canadian transfer on a distinction nobody using this can act on.
 * A scope nothing can check is documentation; a scope something can check is a
 * gate, and only the second belongs here.
 */
const RECIPIENT_CONDITIONAL_SCOPES: ReadonlySet<string> = new Set([
  'data_privacy_framework',
]);

/** Does this country's decision depend on a fact about the recipient? */
export function isRecipientConditional(countryCode: string): boolean {
  const scope = ADEQUACY_DECISIONS[countryCode]?.scope;
  return scope !== undefined && RECIPIENT_CONDITIONAL_SCOPES.has(scope);
}

/**
 * Whether a recorded set of transfer mechanisms evidences the condition on this
 * country's decision.
 *
 * One place rather than an `includes('data_privacy_framework')` at each call
 * site, for VD-7's reason: a second copy of a matching rule drifts from the
 * first and the drift is invisible. Note this is the *controller's assertion*,
 * which the registry can contradict — `resolveDpfStatus` is the stronger
 * evidence and callers holding a vendor should prefer it.
 */
export function conditionMetByMechanism(
  countryCode: string,
  mechanisms: readonly (string | null | undefined)[],
): boolean {
  if (!isRecipientConditional(countryCode)) return false;
  return mechanisms.some((m) => (m ?? '').toLowerCase().includes(DPF_MECHANISM));
}

export function adequacyState(
  countryCode: string,
  evidence?: { conditionMet?: boolean },
): AdequacyState {
  if (EU_EEA_COUNTRIES.includes(countryCode)) return 'eu_eea';
  if (!(countryCode in ADEQUACY_DECISIONS)) return 'third_country';
  if (!isRecipientConditional(countryCode)) return 'adequate';
  return evidence?.conditionMet === true ? 'adequate' : 'conditional';
}

/**
 * Adequate, taking the caller's evidence into account.
 *
 * Called with no evidence a conditional destination reads **false**, which is
 * the safe direction and a behaviour change: it used to read true for the US
 * whatever the recipient's certification said.
 */
export function isAdequateDestination(
  countryCode: string,
  evidence?: { conditionMet?: boolean },
): boolean {
  const state = adequacyState(countryCode, evidence);
  return state === 'eu_eea' || state === 'adequate';
}

export function getDestinationContext(
  countryCode: string,
  evidence?: { conditionMet?: boolean },
) {
  const state = adequacyState(countryCode, evidence);
  if (state === 'eu_eea') {
    return { status: 'eu_eea', adequacyState: state, requiresTransferMechanism: false };
  }
  if (state === 'third_country') {
    return { status: 'third_country', adequacyState: state, requiresTransferMechanism: true };
  }
  return {
    // `status` keeps its three original values so existing readers are
    // unaffected; `adequacyState` is where the fourth one lives.
    status: state === 'adequate' ? 'adequate' : 'third_country',
    adequacyState: state,
    requiresTransferMechanism: state !== 'adequate',
    adequacyDate: ADEQUACY_DECISIONS[countryCode]?.date,
    adequacyScope: ADEQUACY_DECISIONS[countryCode]?.scope,
  };
}
