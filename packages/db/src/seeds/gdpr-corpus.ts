import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: '../../.env' });

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db' });
import * as schema from '../schema.js';
const db = drizzle(pool, { schema });
import { eq } from 'drizzle-orm';
import { documentEmbeddings } from '../schema.js';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// For demonstration, we assume corpus files are JSON files with a specific structure.
interface CorpusDocument {
  sourceType: string;
  sourceReference: string;
  sourceUrl?: string;
  content: string;
  metadata?: Record<string, any>;
}

async function generateEmbedding(text: string) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key') {
    // Return dummy embedding for testing if no API key
    return new Array(1536).fill(0).map(() => Math.random());
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });
  return response.data[0]?.embedding || [];
}

function getHash(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function seedCorpus() {
  console.log('Starting GDPR Corpus seeding...');
  
  const corpusDir = path.join(process.cwd(), 'corpus');
  const corpusPath = path.join(corpusDir, 'gdpr-corpus.json');
  
  try {
    // Read the scraped corpus file
    let fileData: string;
    try {
      fileData = await fs.readFile(corpusPath, 'utf-8');
    } catch {
      throw new Error(`Corpus file not found at ${corpusPath}. Please run the scraper first: npx.cmd tsx src/seeds/scrape-gdpr.ts`);
    }

    const documents: CorpusDocument[] = JSON.parse(fileData);
    console.log(`Loaded ${documents.length} articles from corpus JSON.`);

    // Clear existing GDPR articles first for a clean seed
    console.log("Clearing existing GDPR article embeddings from database...");
    await db.delete(documentEmbeddings).where(eq(documentEmbeddings.sourceType, 'gdpr_article'));
    
    for (const doc of documents) {
      const hash = getHash(doc.content);
      
      console.log(`Generating embedding for: ${doc.sourceReference}`);
      const embedding = await generateEmbedding(doc.content);
      
      await db.insert(documentEmbeddings).values({
        sourceType: doc.sourceType,
        sourceReference: doc.sourceReference,
        sourceUrl: doc.sourceUrl || null,
        content: doc.content,
        contentHash: hash,
        metadata: doc.metadata || {},
        embedding,
      });
      console.log(`Inserted: ${doc.sourceReference}`);
    }
    
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Error seeding corpus:', err);
  }
}

// Execute if run directly
if (process.argv[1]?.endsWith('gdpr-corpus.ts') || process.argv[1]?.endsWith('gdpr-corpus.js')) {
  seedCorpus().then(() => process.exit(0)).catch(() => process.exit(1));
}
