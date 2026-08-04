import { createPatch } from 'diff';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../review-queue.db');

export interface ReviewQueueRecord {
  id?: number;
  vendorName: string;
  vendorSlug: string;
  diffText: string;
  suggestions: string; // JSON string
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export function getDb(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      db.run(`
        CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vendorName TEXT NOT NULL,
          vendorSlug TEXT NOT NULL,
          diffText TEXT NOT NULL,
          suggestions TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (createErr) => {
        if (createErr) return reject(createErr);
        resolve(db);
      });
    });
  });
}

export async function queueReview(vendorName: string, vendorSlug: string, oldText: string, newText: string): Promise<number> {
  const diffPatch = createPatch(`${vendorSlug}-dpa`, oldText, newText);

  // Trigger candidate extractor advice
  const { runCandidateExtractorOnText } = await import('./candidateExtractor.js');
  const suggestions = runCandidateExtractorOnText(newText);

  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO reviews (vendorName, vendorSlug, diffText, suggestions, status) VALUES (?, ?, ?, ?, 'pending')`,
      [vendorName, vendorSlug, diffPatch, JSON.stringify(suggestions)],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

async function runDiffRenderer() {
  console.log('--- DIFF RENDERER ---');
  const db = await getDb();
  db.all('SELECT * FROM reviews WHERE status = "pending"', (err, rows: any[]) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Active pending reviews in SQLite queue: ${rows.length}`);
    for (const row of rows) {
      console.log(`\nReview ID: ${row.id} - ${row.vendorName} (${row.vendorSlug})`);
      console.log(`Diff Patch:`);
      console.log(row.diffText);
      console.log(`Suggestions:`, JSON.stringify(JSON.parse(row.suggestions), null, 2));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDiffRenderer().catch(err => console.error(err));
}
