import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import pg from 'pg';

async function main() {
  console.log('Adding canonicalize_category_array function...');
  
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db',
  });

  await pool.query(`
    CREATE OR REPLACE FUNCTION canonicalize_category_array(categories jsonb)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT string_agg(value, ',' ORDER BY value)
      FROM jsonb_array_elements_text(categories);
    $$;
  `);

  console.log('Function added successfully.');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
