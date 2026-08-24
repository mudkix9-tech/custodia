/**
 * Sprint 0 / D7 companion script.
 *
 * The sub-processor change detector used to persist its snapshots after
 * collapsing every newline (`/\s+/g`), so both stored snapshots are one
 * unreadable line and every diff renders as "1 addition, 1 removal". The
 * cleaning chain is fixed in apps/api/src/workers/vendors.ts; the newlines in
 * already-stored snapshots cannot be reconstructed.
 *
 * What can be repaired is the *baseline*: clearing sub_processor_list_hash and
 * sub_processor_list_snapshot makes the detector re-capture each vendor's page
 * under the fixed pipeline on its next run, so the next real change diffs
 * against a readable snapshot. Until then the detector simply sets fresh
 * baselines itself for any vendor whose hash is null, which is exactly the
 * behaviour we want here -- this script only makes that happen deliberately,
 * for all vendors at once, rather than one per scrape cycle.
 *
 * Dry-run by default: pass --apply to write. Nothing is deleted except the two
 * snapshot columns on the vendors table; detected-change rows and their
 * history in vendor_sub_processor_changes are untouched.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import pg from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const apply = process.argv.includes('--apply');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query(`
      SELECT id, name, sub_processor_list_hash IS NOT NULL AS has_baseline
      FROM vendors
      WHERE sub_processor_list_url IS NOT NULL
      ORDER BY name
    `);

    const withBaseline = rows.filter((r) => r.has_baseline);
    console.log(`Vendors with a sub-processor list URL: ${rows.length}`);
    console.log(`  carrying a collapsed baseline:        ${withBaseline.length}`);

    const sample = withBaseline.slice(0, 10);
    if (sample.length > 0) {
      console.log('Sample:');
      for (const r of sample) console.log(`  - ${r.name} (${r.id})`);
      if (withBaseline.length > sample.length) {
        console.log(`  ... and ${withBaseline.length - sample.length} more`);
      }
    }

    if (!apply) {
      console.log('\nDry run — no rows changed. Re-run with --apply to reset the baselines.');
      return;
    }

    const result = await pool.query(`
      UPDATE vendors
      SET sub_processor_list_hash = NULL,
          sub_processor_list_snapshot = NULL
      WHERE sub_processor_list_url IS NOT NULL
        AND sub_processor_list_hash IS NOT NULL
    `);
    console.log(`\nReset ${result.rowCount} vendor baselines.`);
    console.log('The detector will re-capture each page under the fixed pipeline on its next run.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
