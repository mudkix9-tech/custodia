/**
 * The Chapter V safeguard vocabulary, mirroring
 * `apps/api/src/constants/transferMechanisms.ts`.
 *
 * These strings are matched, not displayed: the risk engine gates US adequacy on
 * the exact string `data_privacy_framework` and the third-country gap rule
 * substring-matches the rest, so "SCCs" typed by hand scores as no safeguard at
 * all. The two workspaces cannot import from each other, which is why this is
 * duplicated rather than shared — the API validates the same list with a Zod
 * enum, so a value that drifts here is rejected there rather than stored wrong.
 *
 * Labels live in the message catalogue; this file holds only the keys.
 */
export const TRANSFER_MECHANISMS = [
  'standard_contractual_clauses',
  'binding_corporate_rules',
  'data_privacy_framework',
  'adequacy_decision',
  'derogation_article_49',
] as const;

export type TransferMechanism = (typeof TRANSFER_MECHANISMS)[number];
