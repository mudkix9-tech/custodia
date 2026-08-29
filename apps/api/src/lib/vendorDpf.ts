/**
 * DPF registry matching — audit P-5, VD-7, VD-9, VD-22.
 *
 * The catalogue's DPF status is a string somebody typed into a seed literal,
 * with no date and no source (known-concerns §18), and the standalone
 * pipeline's version was worse: a 13-name array matched by bidirectional
 * substring, where "Go" matches "google" (audit D19). `dpf_registrations` is
 * the durable answer; these are its lookup rules.
 *
 * Matching is deliberately strict: an absent registration must read as "not
 * found", not "maybe". A lapsed certification is a Chapter V event, so the
 * failure mode to design against is false confidence, not missed coverage.
 *
 * **This is the only matcher.** `routers/vendors.ts` used to inline its own fold
 * — lower-cased, stripped of punctuation, no NFD normalisation, no domain check
 * — at the two hot call sites, so the tested rules above were bypassed by every
 * request that actually asked the question (VD-7). Route new call sites through
 * `matchDpfStatus`; if it is missing something, it is missing it here, once.
 */

/** Folded name key — half of the unique key on `dpf_registrations`. */
export function dpfNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * The three certifications the Department of Commerce publishes, and the other
 * half of the unique key. An organisation may hold any subset and they lapse
 * independently, which is the whole of VD-9: a vendor certified EU-U.S. but not
 * under the UK Extension is a correct answer for a German customer and a wrong
 * one for a British one.
 */
export const DPF_FRAMEWORKS = ['eu_us', 'uk_extension', 'swiss_us'] as const;
export type DpfFramework = (typeof DPF_FRAMEWORKS)[number];

/**
 * Which certification answers a transfer out of a given exporting jurisdiction.
 * Custodia is a GDPR product, so `eu_us` is the default everywhere — but the
 * default is named here rather than assumed at each call site, because "which
 * framework did we ask about" is the question VD-9 exists to make askable.
 */
export const DEFAULT_DPF_FRAMEWORK: DpfFramework = 'eu_us';

export interface DpfEntry {
  nameKey: string;
  organisationName: string;
  framework?: string | null;
  domains?: readonly string[] | null;
  status: string;
  nextRecertificationDate?: string | Date | null;
  inactiveStartDate?: string | Date | null;
}

/**
 * `under_review` is the registry's "Active - Re-certification under Review" and
 * is deliberately *not* one of these: the Department still lists those
 * organisations as active participants, so folding it to `active` is the honest
 * answer to the Chapter V question. The raw value stays on the returned entry.
 */
export type DpfMatchStatus = 'active' | 'lapsed' | 'withdrawn' | 'not_found';

/** Registry statuses meaning the certification is currently in good standing. */
const LIVE_REGISTRY_STATUSES = new Set(['active', 'under_review']);

/**
 * Look up a vendor against imported registrations.
 *
 * Match order: domain first (the strongest signal — a registry entry that
 * publishes this hostname's registrable domain is unambiguous), then exact
 * folded name. Never substring: "Go" must not match "Google", which is the
 * exact defect D19 records.
 *
 * `framework` narrows to one certification before either pass runs. Without it
 * the domain pass returns whichever of an organisation's three rows the array
 * happened to hold first — a coin toss between the EU-U.S. answer and the Swiss
 * one, which is worse than the single-row table it replaced because it looks
 * deliberate.
 */
export function matchDpfStatus(
  vendorName: string,
  vendorDomain: string | null | undefined,
  entries: readonly DpfEntry[],
  framework: DpfFramework = DEFAULT_DPF_FRAMEWORK,
): { status: DpfMatchStatus; entry: DpfEntry | null } {
  // A row imported before VD-9 carries no framework. Matching it against
  // whatever was asked would answer a UK question with an EU-U.S. record, so it
  // only answers for the framework it was written under.
  const scoped = entries.filter(
    (entry) => (entry.framework ?? DEFAULT_DPF_FRAMEWORK) === framework,
  );

  if (vendorDomain) {
    const host = vendorDomain
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/^www\./, '');
    const onDomain = scoped.filter((entry) =>
      (entry.domains ?? []).some((d) => {
        if (!d) return false;
        const registered = d.toLowerCase().replace(/^www\./, '');
        return host === registered || host.endsWith('.' + registered);
      }),
    );
    // A live certification wins where two organisations publish the same
    // hostname. Where none is live, the lapsed one is still the answer: a vendor
    // whose certification we can see and can see has expired is a different
    // finding from one the registry has never heard of, and reporting the second
    // for the first is how a Chapter V lapse comes to read as "never certified".
    const byDomain = onDomain.find((entry) => LIVE_REGISTRY_STATUSES.has(entry.status)) ?? onDomain[0];
    if (byDomain) return { status: registryStatusToMatch(byDomain.status), entry: byDomain };
  }

  const key = dpfNameKey(vendorName);
  const byName = scoped.find((entry) => entry.nameKey === key);
  if (!byName) return { status: 'not_found', entry: null };
  // A non-active entry matches by name but reports its real state — that is
  // the lapse signal, not a reason to keep hunting for an older active row.
  return { status: registryStatusToMatch(byName.status), entry: byName };
}

function registryStatusToMatch(status: string): DpfMatchStatus {
  if (LIVE_REGISTRY_STATUSES.has(status)) return 'active';
  return status === 'withdrawn' ? 'withdrawn' : 'lapsed';
}

/**
 * Has this certification lapsed by date? The registry publishes
 * `next_recertification_date`; once it passes without a renewal row, the entry
 * flips to lapsed at import time — but this guard covers reads between imports.
 */
export function isDpfLapsedByDate(entry: Pick<DpfEntry, 'nextRecertificationDate'>, now: Date = new Date()): boolean {
  if (!entry.nextRecertificationDate) return false;
  const date = new Date(entry.nextRecertificationDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < now.getTime();
}

/**
 * VD-22. What a customer is told when the certification they were relying on is
 * no longer current.
 *
 * The superseded strategy called this an "Article 44 transfer breach alert". It
 * is not a breach: Articles 33 and 34 are about a security incident and run on a
 * 72-hour clock to a supervisory authority, and a certification lapsing is
 * neither of those things. What has happened is that a transfer which had a
 * Chapter V mechanism no longer evidences one, and the response is to confirm a
 * different safeguard — SCCs in almost every case. Sending a controller to their
 * breach procedure for this wastes the procedure and misses the real obligation.
 *
 * Nor is it retroactive. An organisation that leaves the framework keeps its
 * obligations for personal data received while it was certified, so this says
 * nothing about transfers already made; it is a prompt about the ones from here.
 *
 * Lapse and withdrawal are separated because they are separate findings: a lapse
 * is a missed renewal, which a vendor may not know about and often fixes within
 * weeks, and a withdrawal is a decision that will not be reversed by asking.
 */
export function dpfLapseFinding(
  status: DpfMatchStatus,
  organisationName: string,
  effectiveDate?: string | null,
): { title: string; detail: string; action: string } | null {
  if (status === 'active') return null;

  const on = effectiveDate ? ` on ${effectiveDate}` : '';
  const cause = {
    lapsed: `${organisationName}'s Data Privacy Framework certification lapsed${on} — the annual recertification was not completed.`,
    withdrawn: `${organisationName} withdrew from the Data Privacy Framework${on}.`,
    not_found: `${organisationName} is not on the Department of Commerce's Data Privacy Framework participant list.`,
  }[status];

  return {
    title: 'Transfer no longer evidenced under the Data Privacy Framework',
    detail:
      `${cause} Transfers to this recipient are no longer covered by the ` +
      'Commission’s adequacy decision for the DPF, so on this basis they ' +
      'currently have no Chapter V safeguard. This is not a personal data breach ' +
      'and does not engage Articles 33 or 34, and it does not act retroactively ' +
      'on data transferred while the certification was current.',
    action:
      'Confirm standard contractual clauses (Module 2 or 3) or another Chapter V ' +
      'safeguard with this recipient and record it against the transfer. Where no ' +
      'safeguard can be put in place, suspend the transfer.',
  };
}
