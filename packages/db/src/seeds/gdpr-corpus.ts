import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: '../../.env' });

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db' });
import * as schema from '../schema.js';
const db = drizzle(pool, { schema });
import { eq, or } from 'drizzle-orm';
import { documentEmbeddings } from '../schema.js';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs/promises';
import crypto from 'crypto';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'privaro',
  location: process.env.GCP_LOCATION || 'us-central1',
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
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });

  const firstEmbedding = response.embeddings?.[0];
  if (!firstEmbedding || !firstEmbedding.values) {
    throw new Error('No embeddings returned from Gemini/Vertex AI');
  }

  const values = firstEmbedding.values;
  if (values.length !== 3072) {
    throw new Error(`Expected 3072 dimensions, got ${values.length}`);
  }

  return values;
}

function getHash(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function seedCorpus() {
  console.log('Starting GDPR and EDPB Corpus seeding...');
  
  const corpusDir = path.join(process.cwd(), 'corpus');
  const gdprPath = path.join(corpusDir, 'gdpr-corpus.json');
  const recitalsPath = path.join(corpusDir, 'gdpr-recitals-corpus.json');
  const edpbPath = path.join(corpusDir, 'edpb-corpus.json');
  const charterPath = path.join(corpusDir, 'charter-corpus.json');
  
  try {
    // Read the scraped GDPR articles
    let gdprData: string;
    try {
      gdprData = await fs.readFile(gdprPath, 'utf-8');
    } catch {
      throw new Error(`GDPR corpus file not found at ${gdprPath}. Please run the scraper first: npx.cmd tsx src/seeds/scrape-gdpr.ts`);
    }
    const gdprDocs: CorpusDocument[] = JSON.parse(gdprData);
    console.log(`Loaded ${gdprDocs.length} GDPR articles.`);

    // Read the scraped GDPR recitals
    let recitalsDocs: CorpusDocument[] = [];
    try {
      const recitalsData = await fs.readFile(recitalsPath, 'utf-8');
      recitalsDocs = JSON.parse(recitalsData);
      console.log(`Loaded ${recitalsDocs.length} GDPR recitals.`);
    } catch {
      console.warn(`GDPR recitals corpus file not found at ${recitalsPath}. Proceeding without recitals.`);
    }

    // Read the scraped EDPB guidelines
    let edpbDocs: CorpusDocument[] = [];
    try {
      const edpbData = await fs.readFile(edpbPath, 'utf-8');
      edpbDocs = JSON.parse(edpbData);
      console.log(`Loaded ${edpbDocs.length} EDPB guidelines chunks.`);
    } catch {
      console.warn(`EDPB corpus file not found at ${edpbPath}. Proceeding with GDPR only.`);
    }

    // Read the scraped EU Charter of Fundamental Rights
    let charterDocs: CorpusDocument[] = [];
    try {
      const charterData = await fs.readFile(charterPath, 'utf-8');
      charterDocs = JSON.parse(charterData);
      console.log(`Loaded ${charterDocs.length} EU Charter documents.`);
    } catch {
      console.warn(`EU Charter corpus file not found at ${charterPath}. Proceeding without Charter documents.`);
    }

    const allDocs = [...gdprDocs, ...recitalsDocs, ...edpbDocs, ...charterDocs];
    console.log(`Total documents/chunks to seed: ${allDocs.length}`);

    // Clear existing embeddings from database
    console.log("Clearing existing GDPR, EDPB, and Charter embeddings from database...");
    await db.delete(documentEmbeddings).where(
      or(
        eq(documentEmbeddings.sourceType, 'gdpr_article'),
        eq(documentEmbeddings.sourceType, 'gdpr_recital'),
        eq(documentEmbeddings.sourceType, 'edpb_document'),
        eq(documentEmbeddings.sourceType, 'charter_article'),
        eq(documentEmbeddings.sourceType, 'charter_explanation')
      )
    );
    
    for (const doc of allDocs) {
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
