/**
 * Initial/Manual Sync of the US Department of Commerce Data Privacy Framework (DPF)
 * participant list into `dpf_registrations`.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const { db } = await import('../db.js');
const { dpfRegistrations } = await import('db');
const { sql } = await import('drizzle-orm');
const { dpfNameKey } = await import('../lib/vendorDpf.js');

const DPF_LIST_URL =
  process.env.DPF_REGISTRY_URL ||
  'https://dataframework-api.trade.gov/api/v1/participants';

interface DpfRegistryEntry {
  name: string;
  status?: string;
  certification_date?: string | null;
  recertification_date?: string | null;
  next_recertification_date?: string | null;
  websites?: Array<{ website?: string; url?: string }> | string[];
  covered_entities?: unknown[];
}

function entryDomains(entry: DpfRegistryEntry): string[] {
  const raw = Array.isArray(entry.websites) ? entry.websites : [];
  return raw
    .map((w) => (typeof w === 'string' ? w : (w?.website || w?.url || '')))
    .map((s) => s.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '').split('/')[0])
    .filter((d): d is string => Boolean(d));
}

async function fetchDpfEntries(): Promise<DpfRegistryEntry[]> {
  console.log(`Fetching DPF participant registry from ${DPF_LIST_URL}...`);
  const response = await fetch(DPF_LIST_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'CustodiaCompliance/1.0' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`DPF registry responded with status ${response.status}`);
  const body = await response.json();
  if (Array.isArray(body)) return body as DpfRegistryEntry[];
  if (Array.isArray(body?.participants)) return body.participants;
  if (Array.isArray(body?.results)) return body.results;
  throw new Error('Unrecognised DPF registry payload shape');
}

async function main() {
  try {
    const entries = await fetchDpfEntries();
    console.log(`Received ${entries.length} raw entries from DPF API. Writing to database...`);

    let importedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < entries.length; i += batchSize) {
      const chunk = entries.slice(i, i + batchSize);
      for (const entry of chunk) {
        if (!entry?.name) continue;
        const key = dpfNameKey(entry.name).slice(0, 255);
        if (!key) continue;

        await db
          .insert(dpfRegistrations)
          .values({
            nameKey: key,
            organisationName: entry.name.slice(0, 500),
            domains: entryDomains(entry),
            status: String(entry.status || 'active').toLowerCase() === 'lapsed'
              ? 'lapsed'
              : String(entry.status || 'active').toLowerCase() === 'discontinued'
                ? 'discontinued'
                : 'active',
            certificationDate: entry.certification_date ?? null,
            recertificationDate: entry.recertification_date ?? null,
            nextRecertificationDate: entry.next_recertification_date ?? null,
            coveredEntities: (entry.covered_entities ?? []) as unknown as Record<string, unknown>,
            sourceUrl: DPF_LIST_URL,
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: dpfRegistrations.nameKey,
            set: {
              organisationName: entry.name.slice(0, 500),
              domains: entryDomains(entry),
              status: sql`excluded.status`,
              certificationDate: sql`excluded.certification_date`,
              recertificationDate: sql`excluded.recertification_date`,
              nextRecertificationDate: sql`excluded.next_recertification_date`,
              coveredEntities: sql`excluded.covered_entities`,
              fetchedAt: new Date(),
            },
          });
        importedCount += 1;
      }
      process.stdout.write(`\rImported ${importedCount}/${entries.length} entries...`);
    }

    console.log(`\n\nDPF registry sync complete! Total records saved: ${importedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('\nDPF registry sync failed:', err);
    process.exit(1);
  }
}

main();
