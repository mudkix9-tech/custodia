import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(__dirname, '../../.env') }); // packages/db/.env
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(__dirname, '../../../.env') }); // root .env
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(__dirname, '../../../../.env') }); // just in case
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const connection = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(connection);

async function main() {
  console.log('Testing ALTER TABLE on a partitioned table...');

  try {
    // 1. Create a mock partitioned parent table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS test_parent_records (
        id uuid DEFAULT gen_random_uuid(),
        created_at timestamp with time zone DEFAULT now(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
    `);
    
    // 2. Create a child partition
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS test_child_partition PARTITION OF test_parent_records
      FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
    `);

    // 3. Insert a dummy row
    await db.execute(sql`
      INSERT INTO test_parent_records (created_at) VALUES ('2026-01-15');
    `);

    // 4. Apply the equivalent of our migration
    console.log('Applying ALTER TABLE...');
    await db.execute(sql`
      ALTER TABLE test_parent_records ADD COLUMN event_type varchar(20) DEFAULT 'initial';
    `);

    // 5. Query the child partition directly to verify the column exists and has the default
    const res = await db.execute(sql`
      SELECT event_type FROM test_child_partition LIMIT 1;
    `);

    const row = (res as any[])[0] || (res as any).rows?.[0];
    console.log('Result from child partition:', row);
    if (row && row.event_type === 'initial') {
      console.log('SUCCESS: ALTER TABLE successfully cascaded to the child partition and applied the default value.');
    } else {
      console.log('FAILURE: Column exists but default value is wrong or missing.');
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    // Cleanup
    await db.execute(sql`DROP TABLE IF EXISTS test_parent_records CASCADE;`);
    process.exit(0);
  }
}

main().catch(console.error);
