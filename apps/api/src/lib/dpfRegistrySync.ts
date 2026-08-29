/**
 * Sprint 7 — the DPF registry sync itself, shared by the script and the worker.
 *
 * Split from both so there is one ingestion rather than the two that existed
 * before: `scripts/sync-dpf.ts` and the `dpf-registry-import` branch of
 * `workers/vendorIntelligence.ts` were copy-and-paste of each other, which is
 * VD-7's shape applied to writes instead of reads. The parsing lives one level
 * further out in `vendorDpfRegistry.ts` because it is pure and belongs to the
 * fixtures; what is here needs a database and a network.
 *
 * Takes the Drizzle instance as an argument rather than importing `../db.js`,
 * which throws on import without `DATABASE_URL`.
 */
import * as XLSX from 'xlsx';
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { dpfRegistrations, vendors } from 'db';
import {
  DPF_API_BASE,
  DPF_LIST_FILENAME,
  dpfRejectRatioExceeded,
  extractDpfDetail,
  normaliseDpfExportRow,
  preferDpfRegistration,
  type DpfDetailRecord,
  type DpfExportRow,
  type DpfRegistrationRow,
} from './vendorDpfRegistry.js';
import { USER_AGENT } from './vendorProbe.js';

export interface DpfSyncResult {
  ok: boolean;
  fetchedRows: number;
  upserted: number;
  downgraded: number;
  enriched: number;
  rejected: number;
  rejectSamples: string[];
}

export interface DpfSyncOptions {
  db: any;
  apply?: boolean;
  withDetail?: boolean;
  log?: (line: string) => void;
}

/** The Department publishes an "as of" date for the export. Worth logging. */
export async function fetchDpfListDate(): Promise<string | null> {
  try {
    const response = await fetch(`${DPF_API_BASE}/participants/filemodified`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    // Returned as a JSON string literal, quotes and all.
    return (await response.text()).trim().replace(/^"|"$/g, '') || null;
  } catch {
    return null;
  }
}

/**
 * The bulk export. A POST because that is what the endpoint accepts — it answers
 * `405 Allow: POST` to anything else — and the body is the file descriptor the
 * site's own download button sends.
 */
export async function fetchDpfExportRows(): Promise<DpfExportRow[]> {
  const response = await fetch(`${DPF_API_BASE}/downloadFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({
      FileName: DPF_LIST_FILENAME,
      FileType: 'xlsx',
      Id: 0,
      Guid: DPF_LIST_FILENAME,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`DPF export responded ${response.status}`);

  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error('DPF export contained no sheets');
  return XLSX.utils.sheet_to_json<DpfExportRow>(sheet, { defval: null });
}

export async function fetchDpfDetail(participantId: number): Promise<DpfDetailRecord | null> {
  const response = await fetch(`${DPF_API_BASE}/participants/${participantId}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) return null;
  return (await response.json()) as DpfDetailRecord;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function syncDpfRegistry(options: DpfSyncOptions): Promise<DpfSyncResult> {
  const { db, apply = true, withDetail = false } = options;
  const log = options.log ?? (() => {});

  const listDate = await fetchDpfListDate();
  log(`[dpf] participant list as of ${listDate ?? 'unknown'}`);

  const raw = await fetchDpfExportRows();
  log(`[dpf] ${raw.length} rows in the export`);

  const rows: DpfRegistrationRow[] = [];
  const rejectSamples: string[] = [];
  let rejected = 0;
  for (const row of raw) {
    const normalised = normaliseDpfExportRow(row);
    if ('rejected' in normalised) {
      rejected += 1;
      if (rejectSamples.length < 10) rejectSamples.push(normalised.rejected);
      continue;
    }
    rows.push(normalised);
  }

  if (dpfRejectRatioExceeded(raw.length, rejected)) {
    // Refusing to write is the point. Past this ratio the Department has changed
    // a vocabulary, and continuing would run the resolve pass below against a
    // set that is missing thousands of live certifications — a mass Chapter V
    // downgrade on a shared catalogue, arriving as a silent risk-score move in
    // every tenant at once.
    log(`[dpf] ABORT: ${rejected}/${raw.length} rows unrecognised. Samples: ${rejectSamples.join('; ')}`);
    return { ok: false, fetchedRows: raw.length, upserted: 0, downgraded: 0, enriched: 0, rejected, rejectSamples };
  }
  if (rejected > 0) log(`[dpf] ${rejected} row(s) skipped: ${rejectSamples.join('; ')}`);

  // The export carries one row per (organisation, framework), but fourteen
  // organisations appear twice under one framework: an old participant listing
  // and a current one, under different participant ids. They have to be resolved
  // before the insert rather than after — Postgres rejects a statement whose ON
  // CONFLICT DO UPDATE would touch the same row twice — and `preferDpfRegistration`
  // is what decides which listing is the answer. Not the later row: the export is
  // sorted by name, so that would be a coin toss, and it lands wrong for two of
  // the fourteen.
  const byKey = new Map<string, DpfRegistrationRow>();
  for (const row of rows) {
    const key = `${row.nameKey}::${row.framework}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferDpfRegistration(existing, row) : row);
  }
  const deduped = [...byKey.values()];
  log(`[dpf] ${deduped.length} distinct (organisation, framework) certifications`);

  if (!apply) {
    return {
      ok: true, fetchedRows: raw.length, upserted: deduped.length,
      downgraded: 0, enriched: 0, rejected, rejectSamples,
    };
  }

  // `runAt` is the watermark the resolve pass uses. Taken before the first write
  // so a row written during this run can never look older than the run itself.
  const runAt = new Date();
  let upserted = 0;

  for (let i = 0; i < deduped.length; i += 500) {
    const chunk = deduped.slice(i, i + 500);
    await db
      .insert(dpfRegistrations)
      .values(chunk.map((row) => ({
        nameKey: row.nameKey,
        organisationName: row.organisationName,
        framework: row.framework,
        status: row.status,
        certificationDate: row.certificationDate,
        nextRecertificationDate: row.nextRecertificationDate,
        inactiveStartDate: row.inactiveStartDate,
        hrDataCovered: row.hrDataCovered,
        nonHrDataCovered: row.nonHrDataCovered,
        coveredEntities: row.coveredEntities,
        participantId: row.participantId,
        sourceUrl: row.sourceUrl,
        fetchedAt: runAt,
      })))
      .onConflictDoUpdate({
        target: [dpfRegistrations.nameKey, dpfRegistrations.framework],
        set: {
          organisationName: sql`excluded.organisation_name`,
          status: sql`excluded.status`,
          certificationDate: sql`excluded.certification_date`,
          nextRecertificationDate: sql`excluded.next_recertification_date`,
          inactiveStartDate: sql`excluded.inactive_start_date`,
          hrDataCovered: sql`excluded.hr_data_covered`,
          nonHrDataCovered: sql`excluded.non_hr_data_covered`,
          coveredEntities: sql`excluded.covered_entities`,
          participantId: sql`excluded.participant_id`,
          sourceUrl: sql`excluded.source_url`,
          fetchedAt: runAt,
          // Deliberately not touched: `domains`, `privacy_policy_url`,
          // `dispute_resolution_body` and `detail_fetched_at`. The export cannot
          // supply them, so overwriting them here would erase the detail pass's
          // work on every weekly run.
        },
      });
    upserted += chunk.length;
    log(`[dpf] upserted ${upserted}/${deduped.length}`);
  }

  // Resolve pass. A certification the export no longer lists at all is not the
  // same thing as one it lists as lapsed — the export carries its own inactive
  // rows, so an omission means the Department removed the record entirely. Either
  // way we can no longer evidence the certification, and `lapsed` is what the
  // product says when it cannot. Ordinarily this touches nothing.
  const downgradedRows = await db
    .update(dpfRegistrations)
    .set({ status: 'lapsed' })
    .where(and(lt(dpfRegistrations.fetchedAt, runAt), ne(dpfRegistrations.status, 'lapsed')))
    .returning({ id: dpfRegistrations.id, name: dpfRegistrations.organisationName });
  const downgraded = downgradedRows.length;
  if (downgraded > 0) {
    log(`[dpf] ${downgraded} certification(s) no longer listed, downgraded to lapsed: ` +
      downgradedRows.slice(0, 20).map((r: any) => r.name).join(', '));
  }

  let enriched = 0;
  if (withDetail) enriched = await enrichFromDetail(db, log);

  return { ok: true, fetchedRows: raw.length, upserted, downgraded, enriched, rejected, rejectSamples };
}

/**
 * Fill the two detail-only columns, for the participants the catalogue actually
 * references.
 *
 * Not for all 7,563 organisations: at one request per second that is two hours
 * of somebody else's server for facts about vendors nobody has linked. The
 * catalogue is the scope, so an empty catalogue costs nothing and Sprint 9's
 * seeding widens this by itself. Rows left alone keep `detail_fetched_at` NULL,
 * which is the difference between "no dispute body published" and "we have not
 * asked" — the distinction VD-13 is about.
 */
async function enrichFromDetail(db: any, log: (line: string) => void): Promise<number> {
  const catalogue = await db.query.vendors.findMany({ columns: { name: true } });
  if (catalogue.length === 0) {
    log('[dpf] catalogue is empty — no detail records to fetch');
    return 0;
  }

  const { dpfNameKey } = await import('./vendorDpf.js');
  const wanted = [...new Set(catalogue.map((v: any) => dpfNameKey(v.name).slice(0, 255)).filter(Boolean))] as string[];

  const targets = await db
    .select({
      participantId: dpfRegistrations.participantId,
      nameKey: dpfRegistrations.nameKey,
    })
    .from(dpfRegistrations)
    .where(and(inArray(dpfRegistrations.nameKey, wanted), sql`${dpfRegistrations.participantId} IS NOT NULL`));

  const byParticipant = new Map<number, string>();
  for (const t of targets) if (t.participantId) byParticipant.set(t.participantId, t.nameKey);
  log(`[dpf] ${byParticipant.size} participant(s) matched by the catalogue`);

  let enriched = 0;
  for (const [participantId, nameKey] of byParticipant) {
    // One request per second against a single host, the same budget the probe
    // runs under (Sprint 5/6). This is a government API with no published rate
    // limit, which is a reason to be careful rather than a reason not to be.
    await sleep(1000);
    const detail = await fetchDpfDetail(participantId);
    if (!detail) continue;

    const { domains, privacyPolicyUrl, disputeResolutionBodyByFramework } = extractDpfDetail(detail);
    const fetchedAt = new Date();

    for (const [framework, body] of Object.entries(disputeResolutionBodyByFramework)) {
      await db
        .update(dpfRegistrations)
        .set({ disputeResolutionBody: body, privacyPolicyUrl, domains, detailFetchedAt: fetchedAt })
        .where(and(eq(dpfRegistrations.nameKey, nameKey), eq(dpfRegistrations.framework, framework)));
    }
    // A participant whose certifications name no dispute provider still had its
    // detail record read, and the domains and policy URL are worth keeping —
    // stamping `detail_fetched_at` is what stops the next run asking again.
    if (Object.keys(disputeResolutionBodyByFramework).length === 0) {
      await db
        .update(dpfRegistrations)
        .set({ privacyPolicyUrl, domains, detailFetchedAt: fetchedAt })
        .where(eq(dpfRegistrations.nameKey, nameKey));
    }
    enriched += 1;
  }

  log(`[dpf] ${enriched} participant detail record(s) read`);
  return enriched;
}
