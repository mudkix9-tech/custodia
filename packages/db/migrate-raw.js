import postgres from 'postgres';
import fs from 'fs';

const sqlText = fs.readFileSync('drizzle/0005_audit_logs_update.sql', 'utf8');
const sql = postgres('postgres://privaro:privaro_password@localhost:5432/privaro_db', { max: 1 });

async function run() {
  try {
    await sql.unsafe(sqlText);
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    await sql.end();
  }
}
run();
