/**
 * Whether a vendor's own country actually clears Chapter V — VD-23.
 *
 * The defect this closes: `isAdequateDestination('US')` used to return `true`
 * unconditionally, and thirteen of its fourteen call sites believed it. Only
 * `calculateVendorRisk` qualified the answer with the vendor's DPF status, and
 * it did so with an inline `country !== 'US' || isDpfActive` that nothing else
 * could reuse. So a US processor whose certification had lapsed scored 20/20 on
 * the risk factor while the Art. 44 gap rule excused it, the Article 30 export
 * printed it as adequate, and the TIA queue said it needed no assessment.
 *
 * The US decision is not a statement about the United States. It covers
 * organisations holding a current Data Privacy Framework certification, which
 * is a property of the recipient, published per entity, and withdrawn or lapsed
 * without the decision changing — 6,719 of the 16,534 rows in the register are
 * inactive. So the question "is this vendor in an adequate country" cannot be
 * answered from the country alone, and a caller that answers it from the
 * country alone is guessing in the unsafe direction.
 *
 * Two grades of evidence, and this module prefers the stronger:
 *
 *   1. the register, via `matchDpfStatus` — what the Department of Commerce
 *      publishes about that legal entity today;
 *   2. the recorded `transfer_mechanisms`, which is the controller's own
 *      assertion and may be a year out of date.
 *
 * A vendor the register has never heard of falls back to (2), because a
 * `not_found` is as likely to mean the catalogue has the wrong legal entity
 * name as it is to mean the vendor is uncertified — VD-15's problem, and not
 * one to charge a customer for. A vendor the register says has *lapsed* does
 * not fall back: an explicit inactive listing outranks a stale checkbox, and
 * that is the whole reason the weekly sync exists.
 */
import {
  dpfLookupName,
  matchDpfStatus,
  dpfLapseFinding,
  type DpfEntry,
  type DpfMatchStatus,
} from './vendorDpf.js';
import { loadDpfEntriesFor } from './vendorDpfLookup.js';
import {
  adequacyState,
  isRecipientConditional,
  conditionMetByMechanism,
  type AdequacyState,
} from '../constants/transferDestinations.js';

export interface AdequacyVendorLike {
  name?: string | null;
  legalEntityName?: string | null;
  website?: string | null;
  headquartersCountry?: string | null;
  transferMechanisms?: readonly (string | null)[] | null;
}

/**
 * The DPF condition for one vendor, given what the register said about it.
 *
 * `registryStatus` is `undefined` when nobody looked, which is different from
 * `'not_found'` — the first falls back to the recorded mechanism, and so does
 * the second, but a caller that never asked should not later be described as
 * having checked.
 */
export function dpfConditionMet(
  vendor: AdequacyVendorLike,
  registryStatus: DpfMatchStatus | undefined,
  extraMechanisms: readonly (string | null)[] = [],
): boolean {
  const country = vendor.headquartersCountry?.toUpperCase() ?? '';
  if (!isRecipientConditional(country)) return false;

  if (registryStatus === 'active') return true;
  if (registryStatus === 'lapsed' || registryStatus === 'withdrawn') return false;

  // Never looked, or looked and found nothing. The controller's own record is
  // the only evidence left, and it is evidence — an organisation that ticked
  // "Data Privacy Framework" on a transfer has made an assertion it is
  // accountable for under Art. 5(2).
  return conditionMetByMechanism(country, [
    ...(vendor.transferMechanisms ?? []),
    ...extraMechanisms,
  ]);
}

/**
 * The full state, for a surface that wants to say *why* rather than yes/no.
 *
 * `conditional` and `third_country` are kept apart here on the strength of what
 * the register actually said, which is more than `adequacyState` can know from a
 * boolean: an unevidenced US transfer is `conditional` — "go and find out" — but
 * one whose certification the Department has positively marked lapsed or
 * withdrawn is a third-country transfer, full stop. Collapsing those two would
 * be VD-14's defect with the sign flipped: treating a known negative as merely
 * unresearched, which sends a reviewer to look something up that has already
 * been looked up and answered.
 */
export function vendorAdequacyState(
  vendor: AdequacyVendorLike,
  registryStatus: DpfMatchStatus | undefined,
  extraMechanisms: readonly (string | null)[] = [],
): AdequacyState {
  const country = vendor.headquartersCountry?.toUpperCase() ?? '';
  if (!country) return 'third_country';

  if (
    isRecipientConditional(country) &&
    (registryStatus === 'lapsed' || registryStatus === 'withdrawn')
  ) {
    return 'third_country';
  }

  return adequacyState(country, {
    conditionMet: dpfConditionMet(vendor, registryStatus, extraMechanisms),
  });
}

/**
 * Resolve the register's verdict for a batch of vendors in one query.
 *
 * Batched rather than per-vendor because the gap scanner runs this over every
 * linked vendor in an organisation, and `loadDpfEntriesFor` is the VD-8 fix —
 * reintroducing a per-row call would put the full-table scan back one level up.
 * Only conditional-adequacy countries are looked up at all; everything else
 * needs no registry answer and asking for one is 16,500 rows of nothing.
 */
export async function resolveDpfStatusBatch<T extends AdequacyVendorLike>(
  dbInstance: any,
  vendorList: readonly T[],
): Promise<Map<T, DpfMatch>> {
  const out = new Map<T, DpfMatch>();
  const conditional = vendorList.filter((v) =>
    isRecipientConditional(v.headquartersCountry?.toUpperCase() ?? ''),
  );
  if (conditional.length === 0) return out;

  const entries = await loadDpfEntriesFor(
    dbInstance,
    conditional.map((v) => ({ name: dpfLookupName(v), website: v.website })),
  );

  for (const vendor of conditional) {
    out.set(vendor, matchDpfStatus(dpfLookupName(vendor), vendor.website, entries));
  }
  return out;
}

export interface DpfMatch {
  status: DpfMatchStatus;
  entry: DpfEntry | null;
}

export interface DpfLapseNotice {
  vendorId: string;
  vendorName: string;
  status: DpfMatchStatus;
  /** The day the register says the certification stopped being current. */
  effectiveDate: string | null;
  finding: NonNullable<ReturnType<typeof dpfLapseFinding>>;
}

/**
 * Which linked vendors have stopped evidencing the framework, and what to say.
 *
 * Pure, so `test:vendors` can hold the decision still while the worker around it
 * does the querying — and so `dpfLapseFinding` is finally reachable from the
 * path that discovers a lapse. It shipped in Sprint 7 with fixtures and exactly
 * one caller, the questionnaire cross-check, which fires when a *vendor* fills
 * in a form. The weekly sync, which is the thing that actually learns about a
 * lapse, had no way to say so. Three sprints went past that (§8).
 *
 * `not_found` raises nothing. A vendor the register has never heard of is as
 * likely to be a legal-entity name we got wrong (VD-15) as an uncertified one,
 * and a finding a customer cannot act on is the queue-poisoning VD-14 describes.
 * A vendor that *was* matched and is now inactive is a different claim entirely.
 */
export function dpfLapseNotices<T extends AdequacyVendorLike & { id: string }>(
  vendorList: readonly T[],
  matches: ReadonlyMap<T, DpfMatch>,
): DpfLapseNotice[] {
  const notices: DpfLapseNotice[] = [];
  for (const vendor of vendorList) {
    const match = matches.get(vendor);
    if (!match || match.status === 'active' || match.status === 'not_found') continue;

    const raw = match.entry?.inactiveStartDate ?? null;
    const effectiveDate = raw ? new Date(raw).toISOString().slice(0, 10) : null;
    const name = dpfLookupName(vendor) || vendor.name || 'This vendor';
    const finding = dpfLapseFinding(match.status, name, effectiveDate);
    if (!finding) continue;

    notices.push({
      vendorId: vendor.id,
      vendorName: name,
      status: match.status,
      effectiveDate,
      finding,
    });
  }
  return notices;
}
