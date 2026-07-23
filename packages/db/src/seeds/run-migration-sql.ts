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
  
  console.log("Running manual SQL migration...");
  try {
    await db.execute(sql`ALTER TABLE "document_embeddings" RENAME COLUMN "source_type" TO "authority";`);
    console.log("Renamed source_type to authority.");
  } catch (err: any) {
    console.warn("Could not rename source_type to authority (maybe already renamed?):", err.message);
  }
  
  try {
    await db.execute(sql`ALTER TABLE "document_embeddings" ADD COLUMN "document_type" varchar(50) NOT NULL DEFAULT 'guideline';`);
    console.log("Added document_type column.");
  } catch (err: any) {
    console.warn("Could not add document_type column (maybe already exists?):", err.message);
  }
  
  try {
    await db.execute(sql`DROP INDEX IF EXISTS "idx_embeddings_source";`);
    console.log("Dropped idx_embeddings_source index.");
  } catch (err: any) {
    console.warn("Could not drop idx_embeddings_source index:", err.message);
  }
  
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_embeddings_authority" ON "document_embeddings" ("authority");`);
    console.log("Created idx_embeddings_authority index.");
  } catch (err: any) {
    console.warn("Could not create idx_embeddings_authority index:", err.message);
  }

  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_embeddings_doc_type" ON "document_embeddings" ("document_type");`);
    console.log("Created idx_embeddings_doc_type index.");
  } catch (err: any) {
    console.warn("Could not create idx_embeddings_doc_type index:", err.message);
  }
  
  await pool.end();
}

main().catch(console.error);
