/**
 * DPF registry matching — audit P-5.
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
 */

/** Folded name key — the unique key on `dpf_registrations.name_key`. */
export function dpfNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export interface DpfEntry {
  nameKey: string;
  organisationName: string;
  domains?: readonly string[];
  status: string;
  nextRecertificationDate?: string | Date | null;
}

export type DpfMatchStatus = 'active' | 'lapsed' | 'not_found';

/**
 * Look up a vendor against imported registrations.
 *
 * Match order: domain first (the strongest signal — a registry entry that
 * publishes this hostname's registrable domain is unambiguous), then exact
 * folded name. Never substring: "Go" must not match "Google", which is the
 * exact defect D19 records.
 */
export function matchDpfStatus(
  vendorName: string,
  vendorDomain: string | null | undefined,
  entries: readonly DpfEntry[],
): { status: DpfMatchStatus; entry: DpfEntry | null } {
  if (vendorDomain) {
    const host = vendorDomain
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/^www\./, '');
    const byDomain = entries.find(
      (entry) =>
        entry.status === 'active' &&
        (entry.domains ?? []).some((d) => {
          if (!d) return false;
          const registered = d.toLowerCase().replace(/^www\./, '');
          return host === registered || host.endsWith('.' + registered);
        }),
    );
    if (byDomain) return { status: 'active', entry: byDomain };
  }

  const key = dpfNameKey(vendorName);
  const byName = entries.find((entry) => entry.nameKey === key);
  if (!byName) return { status: 'not_found', entry: null };
  // A non-active entry matches by name but reports its real state — that is
  // the lapse signal, not a reason to keep hunting for an older active row.
  return { status: byName.status === 'active' ? 'active' : 'lapsed', entry: byName };
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
