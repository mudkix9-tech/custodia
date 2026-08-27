import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, isNull, or, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in environment.');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

async function purgeUntrustedVendors() {
  console.log('🧹 Purging ALL untrusted global vendor catalogue rows from database...');

  try {
    const globalVendors = await db
      .select({ id: schema.vendors.id })
      .from(schema.vendors)
      .where(or(eq(schema.vendors.isGlobal, true), isNull(schema.vendors.organizationId)));

    console.log(`Found ${globalVendors.length} global catalogue vendors in database.`);

    if (globalVendors.length === 0) {
      console.log('✅ No global catalogue vendors found. Database is completely clean.');
      process.exit(0);
    }

    const vendorIds = globalVendors.map(v => v.id);

    // 1. Unlink referencing organization_vendors in bulk
    await db
      .delete(schema.organizationVendors)
      .where(inArray(schema.organizationVendors.vendorId, vendorIds));
    console.log('✅ Unlinked referencing organization_vendors rows.');

    // 2. Delete the global vendor rows in bulk
    await db.delete(schema.vendors).where(inArray(schema.vendors.id, vendorIds));

    console.log(`✅ Successfully purged all ${globalVendors.length} unverified global vendor rows from Supabase.`);
    console.log('ℹ️ Custom tenant-owned vendors (isGlobal=false with organizationId) remain completely untouched.');
  } catch (err) {
    console.error('❌ Error during purge:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

purgeUntrustedVendors();
