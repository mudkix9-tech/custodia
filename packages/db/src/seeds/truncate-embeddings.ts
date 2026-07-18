import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema.js';
import { sql } from 'drizzle-orm';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db' });
  const db = drizzle(pool, { schema });
  console.log("Truncating document_embeddings table...");
  await db.execute(sql`TRUNCATE TABLE document_embeddings;`);
  console.log("Truncated successfully.");
  await pool.end();
}

main().catch(console.error);
