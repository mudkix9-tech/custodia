/**
 * Sprint 7 — sync `dpf_registrations` from the Department of Commerce's Data
 * Privacy Framework participant list.
 *
 *   npm run sync:dpf --workspace=apps/api              # bulk export only
 *   npm run sync:dpf --workspace=apps/api -- --detail  # plus detail records for
 *                                                      # participants the
 *                                                      # catalogue references
 *   npm run sync:dpf --workspace=apps/api -- --dry-run
 *
 * Replaces `sync-dpf.ts` and the `dpf-registry-import` branch of the vendor
 * intelligence worker, both of which fetched `dataframework-api.trade.gov` — a
 * host that does not resolve. What the endpoints actually are, and how that was
 * established, is in the header of `lib/vendorDpfRegistry.ts`.
 *
 * **This lives in apps/api rather than packages/db**, which is where the sprint
 * plan put it. The row normaliser and the name fold are in `apps/api/src/lib`,
 * fixture-covered by `test:vendors`, and the whole of VD-7 is what happens when
 * a second copy of a matching rule exists somewhere the fixtures cannot see it.
 * Moving the script to `packages/db` would mean either duplicating `dpfNameKey`
 * or having `packages/db` import from `apps/api`, and the first of those is the
 * defect this sprint closes.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const { db } = await import('../db.js');
const { syncDpfRegistry } = await import('../lib/dpfRegistrySync.js');

const args = process.argv.slice(2);
const apply = !args.includes('--dry-run');
const withDetail = args.includes('--detail');

const result = await syncDpfRegistry({
  db,
  apply,
  withDetail,
  log: (line: string) => console.log(line),
});

console.log(
  `\n${result.upserted} certification(s) written, ${result.downgraded} downgraded, ` +
  `${result.enriched} enriched from detail records, ${result.rejected} rejected.`,
);
if (!apply) console.log('Dry run — nothing was written. Re-run without --dry-run to apply.');
process.exit(result.ok ? 0 : 1);
