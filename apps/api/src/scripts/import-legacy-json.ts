/**
 * Imports legacy pre-gathered records from `seed-data/vendors.json` and
 * `seed-data/pending-review.json` into `vendor_candidates` and `vendor_intelligence_runs`.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
dotenv.config({ path: '../../.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const { db } = await import('../db.js');
const { vendorCandidates, vendorIntelligenceRuns } = await import('db');
const { normaliseCandidateDomain, slugify } = await import('../lib/vendorIntelligenceMappers.js');

async function importFile(filePath: string, label: string, defaultConfidence: number) {
  if (!existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return 0;
  }

  const rawJson = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(rawJson);
  if (!Array.isArray(parsed)) {
    console.warn(`Expected JSON array in ${filePath}`);
    return 0;
  }

  console.log(`\nImporting ${parsed.length} records from ${label} (${filePath})...`);

  const [run] = await db
    .insert(vendorIntelligenceRuns)
    .values({
      kind: 'enrich_batch',
      status: 'completed',
      targets: [],
      processed: parsed.length,
      accepted: 0,
      finishedAt: new Date(),
      triggeredBy: null,
    })
    .returning();

  let imported = 0;
  const seenDomains = new Set<string>();

  for (const raw of parsed) {
    try {
      const record = raw as Record<string, unknown>;
      const name = String(record.name || '').trim();
      if (!name) continue;
      const domain = normaliseCandidateDomain(String(record.website || ''));
      const dedupeKey = domain || `name:${slugify(name)}`;
      if (seenDomains.has(dedupeKey)) continue;
      seenDomains.add(dedupeKey);

      const hasProvenance = !!record.provenance;
      const confidence = hasProvenance ? 90 : defaultConfidence;

      await db
        .insert(vendorCandidates)
        .values({
          runId: run!.id,
          name: name.slice(0, 255),
          slug: String(record.slug || slugify(name)).slice(0, 100),
          domain,
          category: record.category ? String(record.category).slice(0, 100) : null,
          payload: record,
          probeResults: (record.provenance as Record<string, unknown>) ?? {},
          grounding: null,
          confidence,
          status: 'pending',
        })
        .onConflictDoNothing({ target: vendorCandidates.domain });
      imported += 1;
    } catch (err) {
      console.error(`Error importing record:`, err);
    }
  }

  console.log(`Successfully imported ${imported} candidate rows for ${label}`);
  return imported;
}

async function main() {
  const vendorsPath = resolve('../../packages/db/src/seed-data/vendors.json');
  const pendingPath = resolve('../../packages/db/src/seed-data/pending-review.json');

  const count1 = await importFile(vendorsPath, 'seed-data/vendors.json', 85);
  const count2 = await importFile(pendingPath, 'seed-data/pending-review.json', 50);

  console.log(`\nTotal legacy candidates staged in vendor_candidates: ${count1 + count2}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
