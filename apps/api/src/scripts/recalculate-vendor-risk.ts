/**
 * Recompute `organization_vendors.risk_score` / `risk_level` / `risk_factors`
 * for every tenant, from the current state of the shared catalogue.
 *
 * Why this has to exist as a separate step: the score is denormalised. It is
 * written when a vendor is linked and re-written when that org's own inputs
 * change, but nothing recomputes it when the *catalogue row* changes underneath
 * it. So backfilling `data_privacy_framework` onto the DPF-certified seeded
 * vendors -- which is what makes `vendorRisk.ts` stop scoring every US vendor at
 * the full 20/20 location risk -- moves nothing on its own. Every existing row
 * keeps the score it was given at link time, and the customer's inflated "high
 * risk vendors" tile, which is the entire symptom, stays exactly as it was.
 *
 * Run it after `npm run seed:vendors --workspace=packages/db`, or after any
 * other edit to the catalogue that a score reads: country, transfer mechanisms,
 * certifications, EU hosting, sub-processors.
 *
 * Dry-run by default; pass `--apply` to write. `--vendor=<uuid>` limits it to
 * one catalogue row. Nothing is deleted and no org's own inputs are touched --
 * this only recomputes a derived column from data that is already there.
 *
 * WORKER_ROLE=web is set before the imports so that pulling in the vendors
 * router (for `recalculateVendorRiskForAllOrgs`) does not register the worker
 * barrel's Puppeteer cluster as a side effect.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const { db } = await import('../db.js');
const { vendors, organizationVendors } = await import('db');
const { eq, sql } = await import('drizzle-orm');
const { recalculateVendorRiskForAllOrgs } = await import('../routers/vendors.js');

async function main() {
  const apply = process.argv.includes('--apply');
  const only = process.argv.find((a) => a.startsWith('--vendor='))?.split('=')[1];

  // Only catalogue rows some organisation actually links are worth the work.
  const linked = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      country: vendors.headquartersCountry,
      mechanisms: vendors.transferMechanisms,
      orgCount: sql<number>`count(${organizationVendors.id})::int`,
    })
    .from(vendors)
    .innerJoin(organizationVendors, eq(organizationVendors.vendorId, vendors.id))
    .groupBy(vendors.id, vendors.name, vendors.headquartersCountry, vendors.transferMechanisms);

  const targets = only ? linked.filter((v) => v.id === only) : linked;

  if (targets.length === 0) {
    console.log(only ? `No linked catalogue vendor with id ${only}.` : 'No linked catalogue vendors.');
    return;
  }

  const rowCount = targets.reduce((n, v) => n + v.orgCount, 0);
  console.log(`Catalogue vendors linked by at least one organisation: ${targets.length}`);
  console.log(`Organisation-vendor rows they cover:                   ${rowCount}`);

  // Surfaced because it is the field that moves the most scores at once, and a
  // seed that has not been re-run is the likeliest reason a recalculation is a
  // no-op.
  const usDpf = targets.filter(
    (v) => v.country?.toUpperCase() === 'US' && (v.mechanisms || []).includes('data_privacy_framework'),
  ).length;
  const usTotal = targets.filter((v) => v.country?.toUpperCase() === 'US').length;
  console.log(`US vendors carrying data_privacy_framework:            ${usDpf}/${usTotal}`);

  if (!apply) {
    console.log('\nDry run — no rows changed. Re-run with --apply to recompute.');
    return;
  }

  let done = 0;
  let failed = 0;
  for (const v of targets) {
    try {
      await recalculateVendorRiskForAllOrgs(db, v.id);
      done += 1;
    } catch (err: any) {
      failed += 1;
      console.error(`  ! ${v.name} (${v.id}): ${err?.message ?? err}`);
    }
    if (done % 25 === 0 && done > 0) console.log(`  … ${done}/${targets.length}`);
  }

  console.log(`\nRecomputed ${done} catalogue vendor${done === 1 ? '' : 's'} across ${rowCount} register rows.`);
  if (failed > 0) console.log(`${failed} failed — see the errors above; nothing else was rolled back.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
