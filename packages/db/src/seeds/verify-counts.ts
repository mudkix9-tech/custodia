import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  
  console.log("Verifying document embeddings counts by authority...");
  const result = await db.execute(sql`
    SELECT authority, COUNT(*) as count 
    FROM document_embeddings 
    GROUP BY authority 
    ORDER BY count DESC;
  `);
  console.table(result.rows);

  console.log("Checking active extensions in PostgreSQL database...");
  const extensions = await db.execute(sql`
    SELECT extname, extversion 
    FROM pg_extension;
  `);
  console.table(extensions.rows);
  await pool.end();
}

main().catch(console.error);
