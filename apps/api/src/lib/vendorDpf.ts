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
 * Legal-form tokens the register carries and a catalogue name does not.
 *
 * The Department publishes legal entities — "Dropbox, Inc." — and a vendor
 * catalogue names products, so exact `dpfNameKey` equality misses most of the
 * register: 4,462 of the 7,547 EU-U.S. rows in the August 2026 export fold to a
 * key ending in one of these. Dropbox holds all three certifications, all
 * active, and was reported `not_found`.
 *
 * Derived by counting the trailing token of every EU-U.S. registrant rather
 * than by listing the forms somebody remembered, which is also what keeps the
 * list honest in the other direction: `group`, `solutions`, `systems`,
 * `technologies` and `software` all occur more often than `ltd` and are part of
 * the name, so none of them is here.
 */
const DPF_LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  // Anglophone forms, in descending order of how often the export uses them.
  'inc', 'incorporated', 'llc', 'lc', 'corporation', 'corp', 'company', 'co',
  'ltd', 'limited', 'llp', 'lllp', 'lp', 'plc', 'pc', 'pllc', 'pbc',
  // Registrants incorporated outside the US, which the export carries because
  // the certifying entity is sometimes the parent rather than the US arm.
  'gmbh', 'mbh', 'ag', 'kg', 'sa', 'sas', 'sarl', 'srl', 'spa', 'bv', 'nv',
  'ab', 'as', 'asa', 'oy', 'oyj', 'aps', 'pty', 'pte', 'kk', 'kft', 'zrt',
  'doo', 'sro', 'ltda',
]);

/**
 * How many trailing legal forms to strip. "Acme Pty Ltd" is two, and an export
 * row reading "Acme, Inc., LLC" is three. Bounded rather than looped to
 * exhaustion so a name which is *entirely* legal forms cannot fold away.
 */
const MAX_SUFFIXES_STRIPPED = 3;

/**
 * Shortest base key worth matching on. Below this the fold has stopped
 * identifying an organisation, and the point of this matcher is that "Go" must
 * not find Google (audit D19).
 */
const MIN_BASE_KEY_LENGTH = 3;

/**
 * The folded name with any trailing legal form removed — the key that matches a
 * catalogue's "Dropbox" against the register's "Dropbox, Inc.".
 *
 * **Stripping happens before folding, on whitespace-separated tokens, and that
 * ordering is the whole of its safety.** `co` is a legal form, and `dpfNameKey`
 * has already destroyed the word boundary by the time it runs — so stripping a
 * suffix off the folded key would turn Cisco into `cis`, Tesco into `tes` and
 * Costco into `cost`. Working on the raw tokens means only a standalone "Co" is
 * ever read as a legal form, which is what the register means when it writes
 * one.
 */
export function dpfBaseNameKey(name: string): string {
  let tokens = name.trim().split(/\s+/).filter(Boolean);

  for (let stripped = 0; stripped < MAX_SUFFIXES_STRIPPED && tokens.length > 1; stripped += 1) {
    const last = dpfNameKey(tokens[tokens.length - 1] ?? '');
    if (!DPF_LEGAL_SUFFIXES.has(last)) break;

    const rest = tokens.slice(0, -1);
    // Refuse a strip that would leave too little to identify anybody. An
    // organisation genuinely called "AI Inc" keeps its full key rather than
    // matching on `ai`.
    if (dpfNameKey(rest.join(' ')).length < MIN_BASE_KEY_LENGTH) break;
    tokens = rest;
  }

  return dpfNameKey(tokens.join(' '));
}

/**
 * Which of a catalogue row's two names the registry should be asked about —
 * VD-15.
 *
 * The Department certifies companies and the catalogue lists products, so
 * "Google Analytics" is a question the participant list cannot answer and
 * "Google LLC" is one it can. Where a row records its legal entity, that is the
 * name to match on; where it does not, the product name is the only name there
 * is and the base-name fold above is what gives it a chance.
 *
 * A function rather than `vendor.legalEntityName ?? vendor.name` at each call
 * site because there are three of them, and the last time this module had a
 * rule written out three times (VD-7) two of the copies were wrong for a year.
 */
export function dpfLookupName(
  vendor: { name?: string | null; legalEntityName?: string | null } | null | undefined,
): string {
  const legal = vendor?.legalEntityName?.trim();
  if (legal) return legal;
  return vendor?.name?.trim() ?? '';
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
  /**
   * The registrant's own page on the register. Carried on the entry so a caller
   * writing provenance cites the participant record it actually matched, rather
   * than the index page every row would share — a source URL that is the same
   * for 16,520 rows is not evidence of anything.
   */
  sourceUrl?: string | null;
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
 * folded name, then folded name with the trailing legal form removed from both
 * sides and only where exactly one registrant answers. Never substring: "Go"
 * must not match "Google", which is the exact defect D19 records — the third
 * pass is still whole-key equality, on a key both sides were reduced to by the
 * same rule, and never a prefix test.
 *
 * The order is deliberate rather than incidental. Domain beats name because a
 * published hostname identifies an organisation and a name does not; exact name
 * beats base name because "Blackboard" and "Blackboard Inc." are both in the
 * register and a vendor called the first should get the first.
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
  // A non-active entry matches by name but reports its real state — that is
  // the lapse signal, not a reason to keep hunting for an older active row.
  if (byName) return { status: registryStatusToMatch(byName.status), entry: byName };

  // Third pass: the same names with any trailing legal form removed from both
  // sides, which is what finds the register's "Dropbox, Inc." from a catalogue
  // that says "Dropbox". It runs even when the vendor's own name carries no
  // suffix, because the row that needs stripping is usually the register's.
  //
  // **A base key that matches more than one registrant matches none.** Two
  // legal entities can share a base — "Engaged MD, Inc." and "Engaged MD, LLC"
  // are separate certifications with separate statuses — and there is nothing
  // in a name to say which one a vendor is. Answering the Chapter V question
  // from a coin toss is the false confidence this whole file is arranged
  // against, so ambiguity reports `not_found`, the same as absence. It costs
  // 22 of the 7,525 distinct EU-U.S. bases in the August 2026 export.
  const base = dpfBaseNameKey(vendorName);
  if (base.length >= MIN_BASE_KEY_LENGTH) {
    const byBase = scoped.filter((entry) => dpfBaseNameKey(entry.organisationName) === base);
    if (byBase.length === 1) {
      return { status: registryStatusToMatch(byBase[0]!.status), entry: byBase[0]! };
    }
  }

  return { status: 'not_found', entry: null };
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
