import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from 'db';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3, // explicitly limit pool size so we don't blow past Supabase's 15-connection limit (Vercel edge functions might spin up multiple pools)
});

export const db = drizzle(pool, { schema });
