/**
 * The Chapter V safeguard vocabulary.
 *
 * These strings are matched, not displayed: `lib/vendorRisk.ts` gates US
 * adequacy on the exact string `data_privacy_framework`, and the
 * `third_country_transfer_no_safeguards` gap rule substring-matches the rest.
 * A vendor recorded as relying on "SCCs" rather than `standard_contractual_clauses`
 * therefore scores as having no safeguard at all and raises an Article 44 gap the
 * organisation has in fact closed — which is the vocabulary trap the audit's
 * finding 4 describes, where three data sources used three spellings of the same
 * field and nothing normalised between them.
 *
 * So the API constrains input to this list rather than accepting free text, and
 * the label a customer sees is a translation key, resolved in the UI.
 */
export const TRANSFER_MECHANISMS = [
  'standard_contractual_clauses',
  'binding_corporate_rules',
  'data_privacy_framework',
  'adequacy_decision',
  'derogation_article_49',
] as const;

export type TransferMechanism = (typeof TRANSFER_MECHANISMS)[number];

/**
 * The mechanisms that close an Article 44 gap on their own. An Article 49
 * derogation is deliberately absent: it is an exception for occasional
 * transfers, not a safeguard, and treating it as one would let a register
 * report a structural transfer as covered.
 */
export const SAFEGUARDING_MECHANISMS: readonly TransferMechanism[] = [
  'standard_contractual_clauses',
  'binding_corporate_rules',
  'data_privacy_framework',
  'adequacy_decision',
];

/**
 * The mechanisms in force for a relationship: the organisation's own record unioned
 * with the shared catalogue's, de-duplicated and in vocabulary order.
 *
 * Both halves matter and neither is authoritative alone. An organisation may have
 * signed its own SCCs, or know of a DPF certification the catalogue has not caught
 * up with; equally the catalogue may carry a mechanism the customer never recorded.
 * `lib/vendorRisk.ts` and the third-country gap rule have unioned the two since they
 * were written, and the audit export was the one consumer that did not — it
 * hardcoded `null`, which is why the Chapter V column in the auditor pack was always
 * blank (D12).
 */
export function mergeTransferMechanisms(
  orgMechanisms?: string[] | null,
  catalogueMechanisms?: string[] | null,
): TransferMechanism[] {
  const seen = new Set(
    [...(orgMechanisms || []), ...(catalogueMechanisms || [])]
      .filter((m): m is string => typeof m === 'string')
      .map((m) => m.trim().toLowerCase()),
  );
  return TRANSFER_MECHANISMS.filter((m) => seen.has(m));
}
