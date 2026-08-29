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
import { or, inArray, arrayOverlaps } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { dpfRegistrations } from 'db';
import { dpfNameKey, dpfBaseNameKey, type DpfEntry } from './vendorDpf.js';
import { getRegistrableDomain } from './vendorDomains.js';

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
 * Every registrable-domain suffix a vendor's host could be registered under.
 *
 * A registry entry publishes `microsoft.com`; a vendor's website is
 * `azure.microsoft.com`. Two labels deep is where it stops, because beyond that
 * the suffixes stop naming organisations and start naming registries, and
 * `co.uk` would match every British registrant in the table.
 */
export function dpfDomainCandidates(targets: readonly DpfLookupTarget[]): string[] {
  const out = new Set<string>();
  for (const target of targets) {
    const host = hostOf(target.website);
    if (!host) continue;
    // Stop at the registrable domain rather than at "the last two labels". Those
    // are the same thing for `api.stripe.com` and not for `a.b.co.uk`, where
    // taking two labels yields the public suffix itself — so the enumeration
    // reached `co.uk`, which is what the rule below was written to prevent and
    // did not. `getRegistrableDomain` is the module that already knows the
    // multi-label suffixes; a second copy of that list here is how they drift.
    const registrable = getRegistrableDomain(host);
    const labels = host.split('.');
    for (let i = 0; i <= labels.length - 2; i += 1) {
      const candidate = labels.slice(i).join('.');
      out.add(candidate);
      if (candidate === registrable) break;
    }
  }
  return [...out];
}

/**
 * The domain half of the predicate — split out so a fixture can render it.
 *
 * This was written as a raw template, `sql`${col} && ${candidates}``, which
 * drizzle renders as `domains && ($1, $2)`: a *row constructor*, one placeholder
 * per candidate, not an array. Postgres then reports
 *   invalid input syntax for type text[] ... must start with "{"
 * and the whole lookup throws. It threw on every call carrying a website and
 * never once fired in production, because the only two catalogue rows had none —
 * Sprint 9's seed, which gives every vendor a domain, is what surfaced it.
 *
 * `tsc` sees a valid SQL template either way, and no fixture could reach it
 * while the expression was inline. `dpfLookupSqlShape` below is what a test
 * asserts on now: one placeholder, and an array literal in the parameter.
 */
export function dpfDomainPredicate(candidates: readonly string[]) {
  return arrayOverlaps(dpfRegistrations.domains, [...candidates]);
}

/**
 * How the domain predicate actually renders, for the fixtures. Pure: it uses
 * drizzle's dialect to produce SQL and parameters without a connection, which is
 * the only way this class of defect is visible before it reaches a database.
 */
export function dpfLookupSqlShape(candidates: readonly string[]): { sql: string; params: unknown[] } {
  const { sql: text, params } = new PgDialect().sqlToQuery(dpfDomainPredicate(candidates).getSQL());
  return { sql: text, params };
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

  const domainCandidates = new Set(dpfDomainCandidates(targets));

  const baseKeys = [...new Set(
    targets.map((t) => dpfBaseNameKey(t.name ?? '').slice(0, 255)).filter(Boolean),
  )];

  const predicates = [];
  if (nameKeys.length > 0) predicates.push(inArray(dpfRegistrations.nameKey, nameKeys));
  if (baseKeys.length > 0) predicates.push(inArray(dpfRegistrations.nameBaseKey, baseKeys));
  if (domainCandidates.size > 0) {
    // `arrayOverlaps` rather than a raw `&&` template. The raw form sent the
    // candidate list as an untyped parameter, which Postgres tried to parse as
    // an array literal and refused:
    //   invalid input syntax for type text[] ... must start with "{"
    // It threw on every call carrying a website, and never once fired in
    // production because the only two catalogue rows had none. Sprint 9's seed,
    // which gives every vendor a domain, is what found it: `tsc` sees a valid
    // SQL template either way.
    predicates.push(dpfDomainPredicate([...domainCandidates]));
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
      sourceUrl: dpfRegistrations.sourceUrl,
    })
    .from(dpfRegistrations)
    .where(predicates.length === 1 ? predicates[0] : or(...predicates));
}
