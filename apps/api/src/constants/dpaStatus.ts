/**
 * `organization_vendors.dpa_status` is a `varchar(50)` with no enum behind it,
 * so the vocabulary lives here rather than as string literals spread across the
 * router, the gap rules and the risk engine. A register tile counting
 * `not_started | expired` as "missing" while a gap rule counts `!= signed` is
 * two different answers to "how many DPAs do we owe", and nothing in the type
 * system notices.
 *
 * Narrowing the column to a pg enum is a schema change and a migration; naming
 * the values is not, and it is what stops the next status drifting into one
 * place and not the other.
 */
export const DPA_STATUS_SIGNED = 'signed';

/** Statuses that mean the Article 28(3) contract is not in place today. */
export const DPA_STATUS_MISSING = ['not_started', 'expired'] as const;

/** Every status the product writes. Kept together so a new one is a one-line change. */
export const DPA_STATUSES = [DPA_STATUS_SIGNED, 'requested', 'in_review', ...DPA_STATUS_MISSING] as const;

export type DpaStatus = (typeof DPA_STATUSES)[number];

/**
 * `vendors.dpa_available` — a *catalogue* fact, and the counterpart to the
 * tenant fact above. VD-12 is the confusion between the two, and it is worth
 * keeping the two vocabularies in one file precisely so the difference is
 * visible when either is edited.
 *
 * - `available`   — Custodia has looked and the vendor publishes a DPA.
 * - `unavailable` — Custodia has looked and the vendor publishes none. An
 *                   assertion about a named third party, so only a source that
 *                   actually checked may write it.
 * - `unindexed`   — nobody has looked. The default, and the only value a row
 *                   may acquire without evidence.
 *
 * The column was `boolean DEFAULT false` (VD-13), which collapsed the last two:
 * "we have not looked" and "they offer nothing" were both `false`, in a column
 * the vendor marketing page renders as a red cross against a company's name.
 *
 * **Nothing here may suppress an Article 28(3) finding.** A controller who has
 * signed no DPA is in breach whatever the catalogue knows about the vendor's
 * published template, so `gapRules.ts` goes on raising it off `dpa_status`
 * alone. That is the whole of VD-12: the tri-state belongs to the catalogue's
 * ignorance, never to the register's verdict.
 */
export const DPA_AVAILABILITY_UNINDEXED = 'unindexed';

export const DPA_AVAILABILITIES = ['available', 'unavailable', DPA_AVAILABILITY_UNINDEXED] as const;

export type DpaAvailability = (typeof DPA_AVAILABILITIES)[number];

/** Has anyone actually looked? Distinguishes VD-13's two former `false`s. */
export function isDpaAvailabilityIndexed(value: string | null | undefined): boolean {
  return value === 'available' || value === 'unavailable';
}

/**
 * Normalise whatever a row holds into the vocabulary.
 *
 * Takes `boolean` as well as `string` because the trust-centre profile still
 * reports a boolean — it either found a DPA on the page or it did not, and that
 * genuinely is two-valued at the point of observation. The third state belongs
 * to the column, not to the observation: a scan that ran and found nothing is
 * `unavailable`, and `unindexed` is what the row says before any scan ran.
 */
export function toDpaAvailability(value: unknown): DpaAvailability {
  if (value === true) return 'available';
  if (value === false) return 'unavailable';
  return (DPA_AVAILABILITIES as readonly string[]).includes(value as string)
    ? (value as DpaAvailability)
    : DPA_AVAILABILITY_UNINDEXED;
}
