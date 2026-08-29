/**
 * Loading DPF registrations for the vendors that are actually being asked about
 * — VD-8.
 *
 * Every call site used to run `db.select().from(dpfRegistrations)` with no
 * predicate at all: the whole registry into memory, per request, to answer a
 * question about one vendor. That was free while the table held nothing. It is
 * 16,534 rows now — one per (organisation, framework) — pulled on every vendor
 * detail view, every risk recalculation and every cross-check batch.
 *
 * The predicate is the folded name, the folded name without its trailing legal
 * form, and the vendor's own host, because those are the three things
 * `matchDpfStatus` matches on. Anything it cannot match on is not worth
 * loading.
 */
import { or, inArray, sql } from 'drizzle-orm';
import { dpfRegistrations } from 'db';
import { dpfNameKey, dpfBaseNameKey, type DpfEntry } from './vendorDpf.js';

export interface DpfLookupTarget {
  name: string;
  website?: string | null;
}

/** Bare host, the same fold `matchDpfStatus` applies before comparing. */
function hostOf(website: string | null | undefined): string | null {
  if (!website) return null;
  const host = (website
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split('/')[0] ?? '')
    .replace(/^www\./, '');
  return host || null;
}

/**
 * Load the registrations that could match any of these vendors.
 *
 * Three predicates OR'd: the folded name against `name_key`, the same name with
 * any trailing legal form removed against `name_base_key`, and the vendor's host
 * against the `domains` array.
 *
 * The base-key half is what makes `matchDpfStatus`'s third pass reachable at
 * all: a catalogue that says "Dropbox" has no `name_key` in the register to
 * load, so without it the rows that pass would have matched were never in
 * memory to be matched. It deliberately loads *every* registrant sharing the
 * base, including the ones that make it ambiguous — the matcher decides to
 * refuse by counting them, so a narrower query would turn a refusal into a
 * wrong answer.
 *
 * The domain half has to cover subdomains —
 * `azure.microsoft.com` must find the entry that publishes `microsoft.com` —
 * which an array containment test cannot express, so the host's parent suffixes
 * are enumerated and matched by overlap. Two labels deep is where it stops:
 * beyond that the suffixes stop being organisations and start being registries,
 * and `co.uk` would match everything British.
 */
export async function loadDpfEntriesFor(
  dbInstance: any,
  targets: readonly DpfLookupTarget[],
): Promise<DpfEntry[]> {
  const nameKeys = [...new Set(
    targets.map((t) => dpfNameKey(t.name ?? '').slice(0, 255)).filter(Boolean),
  )];

  const domainCandidates = new Set<string>();
  for (const target of targets) {
    const host = hostOf(target.website);
    if (!host) continue;
    const labels = host.split('.');
    for (let i = 0; i <= labels.length - 2; i += 1) {
      domainCandidates.add(labels.slice(i).join('.'));
    }
  }

  const baseKeys = [...new Set(
    targets.map((t) => dpfBaseNameKey(t.name ?? '').slice(0, 255)).filter(Boolean),
  )];

  const predicates = [];
  if (nameKeys.length > 0) predicates.push(inArray(dpfRegistrations.nameKey, nameKeys));
  if (baseKeys.length > 0) predicates.push(inArray(dpfRegistrations.nameBaseKey, baseKeys));
  if (domainCandidates.size > 0) {
    predicates.push(sql`${dpfRegistrations.domains} && ${[...domainCandidates]}`);
  }
  // Nothing addressable — a vendor with no name and no website. Returning early
  // rather than falling through to an unfiltered select, which is the defect.
  if (predicates.length === 0) return [];

  return await dbInstance
    .select({
      nameKey: dpfRegistrations.nameKey,
      organisationName: dpfRegistrations.organisationName,
      framework: dpfRegistrations.framework,
      domains: dpfRegistrations.domains,
      status: dpfRegistrations.status,
      nextRecertificationDate: dpfRegistrations.nextRecertificationDate,
      inactiveStartDate: dpfRegistrations.inactiveStartDate,
    })
    .from(dpfRegistrations)
    .where(predicates.length === 1 ? predicates[0] : or(...predicates));
}
