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
