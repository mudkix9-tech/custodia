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

  const connection = postgres(process.env.DATABASE_URL, { max: 1 });
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
