import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from 'db';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3, // strictly limit to 3 connections to allow 2 concurrent deploys
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
