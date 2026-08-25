import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try current directory, then packages/db root, then monorepo root
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(__dirname, '../.env') });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(__dirname, '../../.env') });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(__dirname, '../../../.env') });
}

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  /**
   * `prepare: false` because DATABASE_URL points at Supabase's *transaction*
   * pooler (port 6543, `…pooler.supabase.com`). PgBouncer in transaction mode
   * hands each statement whichever backend connection is free, so a prepared
   * statement named on one connection is not there on the next — postgres-js
   * prepares by default and the migration dies partway through with
   * `prepared statement "s1" does not exist`.
   *
   * The runtime never hit this because `apps/api/src/db.ts` uses node-postgres,
   * which does not prepare unless asked. This file is the only postgres-js
   * client in the repo, which is why the incompatibility could sit here unseen:
   * nothing exercises it except an actual migration against an actual database.
   */
  const connection = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(connection);

  console.log('Running migrations...');

  const start = Date.now();
  await migrate(db, { migrationsFolder: './drizzle' });
  const end = Date.now();

  console.log(`Migrations completed in ${end - start}ms`);
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('Migration failed');
  console.error(err);
  process.exit(1);
});
