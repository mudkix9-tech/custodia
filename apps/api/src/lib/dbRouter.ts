import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { decryptToken } from './encryption.js';
import * as schema from 'db';
import { eq } from 'drizzle-orm';
import { db as primaryDb } from '../db.js';

const { Pool } = pg;

// Cache of dedicated database connections per org
const dedicatedPools = new Map<string, { pool: pg.Pool; db: ReturnType<typeof drizzle>; lastUsed: number }>();

export async function getDbForOrg(orgId: string): Promise<any> {
  // Check if this org has a dedicated database
  const org = await primaryDb.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
    columns: {
      dedicatedDatabaseHost: true,
      dedicatedDatabaseStatus: true,
    },
  });

  if (!org?.dedicatedDatabaseHost || org.dedicatedDatabaseStatus !== 'active') {
    return primaryDb;
  }

  // Check the connection cache
  const cached = dedicatedPools.get(orgId);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.db;
  }

  // Create a new pool for this org's dedicated database
  const connectionString = decryptToken(org.dedicatedDatabaseHost);
  const pool = new Pool({
    connectionString,
    max: 5, // smaller pool per dedicated instance
    ssl: { rejectUnauthorized: false }, // Use true in strict production
    idleTimeoutMillis: 30000,
  });

  const db = drizzle(pool, { schema });
  dedicatedPools.set(orgId, { pool, db, lastUsed: Date.now() });

  return db;
}

// Cleanup idle dedicated connections every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [orgId, entry] of dedicatedPools.entries()) {
    if (now - entry.lastUsed > 5 * 60 * 1000) {
      entry.pool.end();
      dedicatedPools.delete(orgId);
    }
  }
}, 5 * 60 * 1000);

export function getPrimaryDb() {
  return primaryDb;
}
