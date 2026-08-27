import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

/**
 * Global Vendor Catalogue Seed.
 *
 * All hardcoded and model-generated literals have been completely purged.
 * The catalogue will only be populated via deterministic, live-verified probes
 * and official government/regulatory registries.
 */
export const VERIFIED_GLOBAL_VENDORS: any[] = [];

async function seedVendors() {
  console.log('🌱 Checking global vendor seed...');
  if (VERIFIED_GLOBAL_VENDORS.length === 0) {
    console.log('ℹ️ 0 hardcoded vendor literals. Global catalogue seed is clean.');
    process.exit(0);
  }
}

seedVendors().catch((err) => {
  console.error('❌ Error in seedVendors:', err);
  process.exit(1);
});
