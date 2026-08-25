/**
 * The vendor relationship's own vocabularies.
 *
 * `organization_vendors.status`, `criticality` and `processing_role` are all
 * `varchar` with no enum behind them, so the values live here rather than as
 * string literals spread across the router, the register filter, the metric
 * tiles and the workers. The DPA-status file next door exists for the same
 * reason and for the same lesson: the first version of the register's "missing
 * DPA" filter hand-wrote `not_started` and omitted `expired`, so the filter and
 * the tile counting the same thing disagreed by however many DPAs had lapsed.
 *
 * These are *values*, not display strings — the web workspace renders them from
 * its own message catalogues.
 */

export const VENDOR_STATUS_ACTIVE = 'active';
export const VENDOR_STATUS_PAUSED = 'paused';
export const VENDOR_STATUS_OFFBOARDED = 'offboarded';

export const VENDOR_STATUSES = [
  VENDOR_STATUS_ACTIVE,
  VENDOR_STATUS_PAUSED,
  VENDOR_STATUS_OFFBOARDED,
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/**
 * Statuses that describe a relationship the organisation is still in.
 *
 * Everything that counts, scores, chases or alerts should filter on this rather
 * than on `!= 'offboarded'`: a register that keeps counting a processor it
 * stopped using two years ago reports a DPA it does not owe, and mails the
 * business owner about a renewal that will never happen.
 *
 * `paused` is live: a suspended contract still has the vendor holding the data.
 */
export const VENDOR_STATUSES_LIVE: readonly VendorStatus[] = [
  VENDOR_STATUS_ACTIVE,
  VENDOR_STATUS_PAUSED,
];

export function isLiveVendorStatus(status?: string | null): boolean {
  // A NULL status is a row written before the column meant anything. It is live:
  // treating unknown as offboarded would silently empty an existing register.
  return status == null || (VENDOR_STATUSES_LIVE as readonly string[]).includes(status);
}

/**
 * Art. 28 vs Art. 26 vs two independent controllers. The obligations follow the
 * role: only a processor signs the Art. 28(3) clause checklist, a joint
 * controller needs an Art. 26 arrangement that no DPA template supplies, and an
 * independent controller needs neither but does need a transfer basis.
 */
export const VENDOR_PROCESSING_ROLES = [
  'processor',
  'joint_controller',
  'independent_controller',
] as const;
export type VendorProcessingRole = (typeof VENDOR_PROCESSING_ROLES)[number];

export const VENDOR_CRITICALITIES = ['low', 'medium', 'high', 'critical'] as const;
export type VendorCriticality = (typeof VENDOR_CRITICALITIES)[number];
