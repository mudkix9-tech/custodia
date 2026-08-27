import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

/**
 * The global vendor catalogue seed.
 *
 * All legacy unverified stubs (39 hardcoded rows) have been purged.
 * The catalogue will be populated exclusively via verified sources:
 * 1. Official US Department of Commerce DPF Registry (`sync-dpf-registry.ts`)
 * 2. Audited Top 75 European SaaS Stack with verified DPA and EU hosting records.
 */
const VENDORS: Array<{
  name: string;
  website?: string;
  category?: string;
  headquartersCountry?: string;
  dpaAvailable?: boolean;
  dpaUrl?: string;
  privacyPolicyUrl?: string;
  euHostingAvailable?: boolean;
  euHostingDetail?: string;
  securityCertifications?: string[];
  subProcessorListUrl?: string;
  transferMechanisms?: string[];
  suggestedForIndustries?: string[];
  isPrivacyFriendly?: boolean;
}> = [];

async function seedVendors() {
  console.log('🌱 Seeding Global Vendors...');
  
  if (VENDORS.length === 0) {
    console.log('ℹ️ No unverified static vendors to seed. Global catalogue seed is reset.');
    process.exit(0);
  }
  
  for (const v of VENDORS) {
    const [existing] = await db.select().from(schema.vendors).where(eq(schema.vendors.name, v.name));
    
    if (!existing) {
      await db.insert(schema.vendors).values({
        ...v,
        isGlobal: true,
      });
      console.log(`✅ Inserted ${v.name}`);
    } else {
      await db.update(schema.vendors)
        .set({ 
          isPrivacyFriendly: v.isPrivacyFriendly ?? false,
          category: v.category,
          website: v.website,
          headquartersCountry: v.headquartersCountry,
          dpaAvailable: v.dpaAvailable,
          dpaUrl: v.dpaUrl,
          privacyPolicyUrl: v.privacyPolicyUrl,
          transferMechanisms: v.transferMechanisms,
          securityCertifications: v.securityCertifications
        })
        .where(eq(schema.vendors.id, existing.id));
      console.log(`⏭️ Updated ${v.name} (already exists)`);
    }
  }
 
  console.log('✅ Global Vendors Seeded successfully!');
  process.exit(0);
}

seedVendors().catch((err) => {
  console.error('Error seeding vendors:', err);
  process.exit(1);
});
