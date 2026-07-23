import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema.js';
import { sql } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  console.log("Truncating document_embeddings table...");
  await db.execute(sql`TRUNCATE TABLE document_embeddings;`);
  console.log("Truncated successfully.");
  await pool.end();
}

main().catch(console.error);
