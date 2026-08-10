import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

type TrackerSeed = {
  tracker_key: string;
  provider: string;
  match_domains: string[];
  cookie_prefixes: string[];
  required_category: string;
  consent_mode_supported?: boolean;
  consent_signal_params?: string[];
  vendor_slug?: string | null;
  purpose?: string | null;
};

const VALID_CATEGORIES = ['necessary', 'analytics', 'marketing', 'functional'];

function loadTrackers(): TrackerSeed[] {
  const raw = readFileSync(resolve(__dirname, 'seed-data/trackers.json'), 'utf-8');
  const parsed = JSON.parse(raw) as TrackerSeed[];

  const seen = new Set<string>();
  for (const t of parsed) {
    if (!t.tracker_key) throw new Error('Tracker entry missing tracker_key');
    if (seen.has(t.tracker_key)) throw new Error(`Duplicate tracker_key: ${t.tracker_key}`);
    seen.add(t.tracker_key);
    if (!VALID_CATEGORIES.includes(t.required_category)) {
      throw new Error(`Tracker ${t.tracker_key} has invalid required_category: ${t.required_category}`);
    }
  }

  return parsed;
}

async function seedTrackers() {
  console.log('🌱 Seeding Tracker Registry...');
  const trackers = loadTrackers();

  let inserted = 0;
  let updated = 0;

  for (const t of trackers) {
    const values = {
      trackerKey: t.tracker_key,
      provider: t.provider,
      matchDomains: t.match_domains ?? [],
      cookiePrefixes: t.cookie_prefixes ?? [],
      requiredCategory: t.required_category,
      consentModeSupported: t.consent_mode_supported ?? false,
      consentSignalParams: t.consent_signal_params ?? [],
      vendorSlug: t.vendor_slug ?? null,
      purpose: t.purpose ?? null,
      isActive: true,
    };

    const [existing] = await db
      .select({ id: schema.trackerRegistry.id })
      .from(schema.trackerRegistry)
      .where(eq(schema.trackerRegistry.trackerKey, t.tracker_key));

    if (!existing) {
      await db.insert(schema.trackerRegistry).values(values);
      inserted += 1;
    } else {
      await db
        .update(schema.trackerRegistry)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.trackerRegistry.id, existing.id));
      updated += 1;
    }
  }

  console.log(`✅ Tracker registry seeded: ${inserted} inserted, ${updated} updated.`);
  await sql.end();
  process.exit(0);
}

seedTrackers().catch((err) => {
  console.error('Error seeding tracker registry:', err);
  process.exit(1);
});
