import * as dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function check() {
  const res = await pool.query(`SELECT * FROM assessments ORDER BY created_at DESC LIMIT 1`);
  const assessment = res.rows[0];
  console.log('Latest Assessment:', assessment);

  if (assessment) {
    const answers = await pool.query(`SELECT * FROM assessment_answers WHERE assessment_id = $1`, [assessment.id]);
    console.log(`Answers for ${assessment.id}:`, answers.rows.length);
    
    if (answers.rows.length > 0) {
      console.log('Sample answer:', answers.rows[0]);
    }

    const items = await pool.query(`SELECT * FROM action_items WHERE assessment_id = $1`, [assessment.id]);
    console.log(`Action items for ${assessment.id}:`, items.rows.length);
  }
  process.exit(0);
}
check();
