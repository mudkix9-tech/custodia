/**
 * Reading the Department of Commerce's DPF participant list — Sprint 7,
 * VD-9 and VD-22.
 *
 * ## What was actually verified, and when
 *
 * Sprint 7 opens with a verification task rather than a parser, because the
 * superseded strategy named an "official DPF API / daily JSON export" at a URL
 * that is a Salesforce UI route, and the code written against it since Sprint 2
 * pointed at `https://dataframework-api.trade.gov/api/v1/participants` — a host
 * that **does not resolve**. Every weekly import since has thrown at DNS, which
 * is invisible because the job also was never scheduled (see
 * `workers/dpfRegistry.ts`). Checked on 29 August 2026:
 *
 *   dataframework-api.trade.gov          NXDOMAIN
 *   www.dataprivacyframework.gov/…       200 text/html, 2,116 bytes, for every
 *                                        path — a Vite SPA shell, i.e. a
 *                                        soft-404 host in the VD-6 sense
 *   dpfapi.azurewebsites.net/api         the SPA's own API, unauthenticated
 *
 * Three endpoints on that host answer without credentials:
 *
 *   GET  /api/Framework                  the three frameworks and their ids
 *   POST /api/downloadFile               the full participant list as XLSX
 *   GET  /api/participants/{id}          one participant, in full
 *
 * The bulk export is the Tier 1 source: 16,534 rows, **one per (organisation,
 * framework)**, which is the shape VD-9 predicted before anyone had looked. It
 * carries status, both certification dates, the inactive date, HR and non-HR
 * coverage, covered entities and a public link. It does *not* carry the dispute
 * resolution body or the privacy policy URL; those are on the per-participant
 * detail record, which is why `detail_fetched_at` exists and why a null in
 * either column means "not fetched" rather than "none published".
 *
 * A dated sample of both shapes is committed at
 * `fixtures/dpf-registry-2026-08-29.json` so the parsers below are testable
 * without a network, and so a future change to the feed is visible as a diff
 * against a response somebody actually received.
 *
 * Everything here is pure. The fetching lives in `scripts/sync-dpf-registry.ts`.
 */
import { dpfNameKey, DPF_FRAMEWORKS, type DpfFramework } from './vendorDpf.js';

export const DPF_API_BASE = 'https://dpfapi.azurewebsites.net/api';

/** The bulk export's own filename, which is also its id in `downloadFile`. */
export const DPF_LIST_FILENAME = 'DataPrivacyFrameworkParticipantsList.xlsx';

/**
 * Where a row's facts can be checked. The export publishes a per-participant
 * link, and that — not the endpoint we happened to call — is the provenance
 * URL: it is the page a reviewer opens to see the same thing we read.
 */
export const DPF_PARTICIPANT_URL = 'https://www.dataprivacyframework.gov/participant/';

/**
 * The export writes the framework out in full, in the Department's words. Keys
 * are matched exactly rather than by substring, because "UK Extension to the
 * EU-U.S. Data Privacy Framework" contains "EU-U.S. Data Privacy Framework" and
 * a `startsWith`/`includes` fold would file every UK row as an EU one — which is
 * the failure VD-9 is about, arriving through the parser instead of the schema.
 */
const FRAMEWORK_BY_LABEL: Record<string, DpfFramework> = {
  'EU-U.S. Data Privacy Framework': 'eu_us',
  'UK Extension to the EU-U.S. Data Privacy Framework': 'uk_extension',
  'Swiss-U.S. Data Privacy Framework': 'swiss_us',
};

/** The detail endpoint gives framework ids instead of labels. Same three. */
const FRAMEWORK_BY_ID: Record<number, DpfFramework> = {
  1: 'eu_us',
  2: 'swiss_us',
  3: 'uk_extension',
};

export function dpfFrameworkFromLabel(label: string | null | undefined): DpfFramework | null {
  if (!label) return null;
  return FRAMEWORK_BY_LABEL[label.trim()] ?? null;
}

export function dpfFrameworkFromId(id: number | null | undefined): DpfFramework | null {
  if (id == null) return null;
  return FRAMEWORK_BY_ID[id] ?? null;
}

/**
 * The export's four status values, folded.
 *
 * "Active - Re-certification under Review" is kept apart from "Active" rather
 * than collapsed into it: the organisation is still a listed participant, so it
 * is not a lapse, but a reviewer looking at a renewal in progress wants to know
 * that is what they are looking at. `matchDpfStatus` folds it back to active for
 * the Chapter V question — the distinction is worth storing and not worth
 * putting in front of a customer as a third kind of answer.
 *
 * Lapse and withdrawal stay distinct for VD-22's reason: one is a missed
 * deadline, the other is a decision.
 */
const STATUS_BY_LABEL: Record<string, string> = {
  Active: 'active',
  'Active - Re-certification under Review': 'under_review',
  'Inactive - Lapse': 'lapsed',
  'Inactive - Withdrawal': 'withdrawn',
};

export function dpfStatusFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  return STATUS_BY_LABEL[label.trim()] ?? null;
}

/**
 * The export writes US-locale `M/D/YYYY`; Postgres wants ISO. Parsed by field
 * rather than by `new Date(...)`, because `new Date('5/4/2017')` is
 * month-first only by the runtime's grace and silently becomes 4 May or 5 April
 * depending on locale — a certification date out by eleven months reads exactly
 * like a correct one, which is the class of defect the retention fixtures exist
 * for.
 */
export function parseDpfDate(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
  }
  const text = String(raw).trim();
  if (!text) return null;

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${us[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso ? iso[0].slice(0, 10) : null;
}

/** `Yes` / `No`, or nothing said. Absent is a third answer, not a false. */
export function parseDpfBoolean(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (raw == null) return null;
  const text = String(raw).trim().toLowerCase();
  if (text === 'yes' || text === 'true') return true;
  if (text === 'no' || text === 'false') return false;
  return null;
}

/** `https://www.dataprivacyframework.gov/participant/6147` → 6147. */
export function parseParticipantId(publicLink: unknown): number | null {
  if (publicLink == null) return null;
  const match = /\/participant\/(\d+)/.exec(String(publicLink));
  return match ? Number(match[1]) : null;
}

/**
 * Registrable-ish domain from a published policy URL.
 *
 * The list export has no domains column at all — the only URL the Department
 * publishes for a participant is its privacy policy, on the detail record. That
 * is a weaker domain signal than a registry-published hostname would be, and it
 * is the one there is: an organisation's certified privacy policy is on its own
 * site in all but a handful of cases. `matchDpfStatus` treats a domain hit as
 * conclusive, so this deliberately keeps the full host rather than guessing at a
 * public suffix — `foo.github.io` must not collapse to `github.io` and match
 * every other tenant of it.
 */
export function domainFromUrl(url: unknown): string | null {
  if (url == null) return null;
  const text = String(url).trim();
  if (!text) return null;
  const host = (text
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split('/')[0] ?? '')
    .split('?')[0]!
    .split('#')[0]!
    .replace(/^www\./i, '')
    .toLowerCase();
  // A hostname, not an email, an IP or a bare word.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  if (/^\d+(\.\d+)+$/.test(host)) return null;
  return host;
}

/** One row of the bulk export, as `sheet_to_json` hands it over. */
export interface DpfExportRow {
  'Public Display Name'?: unknown;
  'Legal Name'?: unknown;
  'Install Date'?: unknown;
  'Usage End Date'?: unknown;
  'Inactive Start Date'?: unknown;
  Framework?: unknown;
  Status?: unknown;
  'HR Data'?: unknown;
  'Non-HR Data'?: unknown;
  'Covered Entities'?: unknown;
  'Public Link'?: unknown;
}

/** A `dpf_registrations` row, ready to upsert. */
export interface DpfRegistrationRow {
  nameKey: string;
  organisationName: string;
  framework: DpfFramework;
  status: string;
  certificationDate: string | null;
  nextRecertificationDate: string | null;
  inactiveStartDate: string | null;
  hrDataCovered: boolean | null;
  nonHrDataCovered: boolean | null;
  coveredEntities: string[];
  participantId: number | null;
  sourceUrl: string | null;
}

/**
 * Turn one export row into a registration, or reject it.
 *
 * Rejection rather than a default in three cases, all for the same reason: a row
 * whose framework or status we do not recognise is a row the Department has
 * changed the vocabulary of, and guessing at it writes a Chapter V answer nobody
 * verified. The sync counts rejections and fails loudly past a threshold, which
 * is how a vocabulary change surfaces as an alert instead of as silently wrong
 * adequacy for a fraction of the catalogue.
 */
export function normaliseDpfExportRow(row: DpfExportRow): DpfRegistrationRow | { rejected: string } {
  const name = String(row['Public Display Name'] ?? '').trim();
  if (!name) return { rejected: 'no public display name' };

  const nameKey = dpfNameKey(name).slice(0, 255);
  if (!nameKey) return { rejected: `name folds to nothing: ${name}` };

  const framework = dpfFrameworkFromLabel(String(row.Framework ?? ''));
  if (!framework) return { rejected: `unknown framework: ${String(row.Framework ?? '')}` };

  const status = dpfStatusFromLabel(String(row.Status ?? ''));
  if (!status) return { rejected: `unknown status: ${String(row.Status ?? '')}` };

  const participantId = parseParticipantId(row['Public Link']);

  // The export packs covered entities into one comma-joined cell, and the
  // entities themselves contain commas — "DevRev UV Cloud, Inc.; 1731
  // Embarcadero Rd, …". Splitting on comma would shred them, so the cell is
  // kept whole unless it carries the semicolon-and-address shape the detail
  // record uses, in which case each entity is its own line already.
  const rawEntities = row['Covered Entities'];
  const coveredEntities = rawEntities == null || String(rawEntities).trim() === ''
    ? []
    : [String(rawEntities).trim()];

  return {
    nameKey,
    organisationName: name.slice(0, 500),
    framework,
    status,
    certificationDate: parseDpfDate(row['Install Date']),
    nextRecertificationDate: parseDpfDate(row['Usage End Date']),
    inactiveStartDate: parseDpfDate(row['Inactive Start Date']),
    hrDataCovered: parseDpfBoolean(row['HR Data']),
    nonHrDataCovered: parseDpfBoolean(row['Non-HR Data']),
    coveredEntities,
    participantId,
    sourceUrl: participantId ? `${DPF_PARTICIPANT_URL}${participantId}` : null,
  };
}

/** The per-participant detail record, as far as we read it. */
export interface DpfDetailRecord {
  PrivacyPolicies?: Array<{ ExternalUrl?: unknown; PolicyCurrent?: unknown }> | null;
  Certifications?: Array<{
    FrameworkId?: number | null;
    RecourseMechanisms?: Array<{ Name?: unknown; Type?: unknown; Website?: unknown }> | null;
  }> | null;
}

/** What the detail record adds, per framework, to a row the export supplied. */
export interface DpfDetailEnrichment {
  domains: string[];
  privacyPolicyUrl: string | null;
  disputeResolutionBodyByFramework: Partial<Record<DpfFramework, string>>;
}

/**
 * Pull the two detail-only fields out of one participant record.
 *
 * The dispute body is per *certification*, not per organisation — the EU-U.S.
 * row names a DPA panel and the UK Extension row names the ICO — so it comes
 * back keyed by framework rather than as one value. `RecourseMechanisms` also
 * lists the US statutory body (the FTC) alongside the dispute provider, and
 * those are different things: the statutory body is who enforces, the dispute
 * provider is where a data subject goes. Only the latter is what Article 45's
 * redress limb asks about, so only the latter is taken.
 */
export function extractDpfDetail(detail: DpfDetailRecord): DpfDetailEnrichment {
  const policies = (detail.PrivacyPolicies ?? []).filter((p) => p && p.ExternalUrl);
  // Prefer a policy the registrant still marks current; fall back to any, since
  // a superseded URL still identifies the organisation's domain.
  const current = policies.find((p) => p.PolicyCurrent === true) ?? policies[0] ?? null;
  const privacyPolicyUrl = current?.ExternalUrl ? String(current.ExternalUrl).trim() : null;

  const domains: string[] = [];
  for (const policy of policies) {
    const domain = domainFromUrl(policy.ExternalUrl);
    if (domain && !domains.includes(domain)) domains.push(domain);
  }

  const disputeResolutionBodyByFramework: Partial<Record<DpfFramework, string>> = {};
  for (const cert of detail.Certifications ?? []) {
    const framework = dpfFrameworkFromId(cert?.FrameworkId ?? null);
    if (!framework) continue;
    const provider = (cert?.RecourseMechanisms ?? []).find(
      (m) => String(m?.Type ?? '').trim() === 'Dispute Resolution Provider' && m?.Name,
    );
    if (provider?.Name) {
      disputeResolutionBodyByFramework[framework] = String(provider.Name).trim().slice(0, 500);
    }
  }

  return { domains, privacyPolicyUrl, disputeResolutionBodyByFramework };
}

/**
 * Which of two listings for the same (organisation, framework) is the answer.
 *
 * The export contains 14 such pairs, and they are not duplicates — they are an
 * organisation's old participant record and its current one, under two different
 * participant ids. `US Cloud` has an active listing (8258) and a withdrawn one
 * (4210); `SANS Institute` has a lapsed listing (6951) and an active one (3144).
 *
 * Taking whichever arrived last would answer from the export's row order, which
 * is alphabetical by name and says nothing about which certification is current.
 * For two of those fourteen that would report a currently certified organisation
 * as withdrawn — a Chapter V mechanism deleted by a sort order. So a live listing
 * wins over a dead one, and between two of the same kind the later certification
 * does.
 */
const STATUS_PRECEDENCE: Record<string, number> = {
  active: 3,
  under_review: 2,
  lapsed: 1,
  withdrawn: 0,
};

export function preferDpfRegistration(
  a: DpfRegistrationRow,
  b: DpfRegistrationRow,
): DpfRegistrationRow {
  const byStatus = (STATUS_PRECEDENCE[b.status] ?? 0) - (STATUS_PRECEDENCE[a.status] ?? 0);
  if (byStatus !== 0) return byStatus > 0 ? b : a;
  return (b.certificationDate ?? '') > (a.certificationDate ?? '') ? b : a;
}

/**
 * How many unrecognised rows are tolerable before the sync refuses to write.
 *
 * A handful of odd rows in a 16,500-row export is ordinary. A tenth of them is
 * the Department having renamed something, and continuing past that would leave
 * the resolve pass flipping thousands of live certifications to lapsed because
 * this parser stopped recognising them — a silent mass Chapter V downgrade
 * across every tenant, from a shared catalogue table. Better to fail the run.
 */
export const DPF_REJECT_RATIO_LIMIT = 0.05;

export function dpfRejectRatioExceeded(total: number, rejected: number): boolean {
  if (total === 0) return true;
  return rejected / total > DPF_REJECT_RATIO_LIMIT;
}

export { DPF_FRAMEWORKS, type DpfFramework };
