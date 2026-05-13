import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from 'db';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db',
});

export const db = drizzle(pool, { schema });
