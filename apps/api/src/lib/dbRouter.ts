import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { decryptToken } from './encryption.js';
import * as schema from 'db';
import { eq } from 'drizzle-orm';
import { db as primaryDb } from '../db.js';

const { Pool } = pg;

/**
 * A database handle carrying the full schema — either the primary pool or a
 * dedicated pool for a tenant on its own instance.
 *
 * Both are `drizzle(pool, { schema })` and so have the same type; the cache used
 * `ReturnType<typeof drizzle>`, which is schema-less and therefore did not match,
 * and the mismatch was papered over by returning `any`. That `any` became
 * `ctx.db`, so every query in every procedure returned `any` and no router output
 * was typed at all — which is most of why apps/web needed `@ts-nocheck`.
 */
export type OrgDatabase = typeof primaryDb;

// Cache of dedicated database connections per org
const dedicatedPools = new Map<string, { pool: pg.Pool; db: OrgDatabase; lastUsed: number }>();

export async function getDbForOrg(orgId: string): Promise<OrgDatabase> {
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
