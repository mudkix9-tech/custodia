import postgres from 'postgres';
import fs from 'fs';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: '../../.env' });

const sqlText = fs.readFileSync('drizzle/0012_embeddings_v3_3072.sql', 'utf8');
const connectionString = process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db';
const sql = postgres(connectionString, { max: 1 });

async function run() {
  try {
    console.log('Running raw SQL migration on database...');
    await sql.unsafe(sqlText);
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    await sql.end();
  }
}
run();
