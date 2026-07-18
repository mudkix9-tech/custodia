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
  authority: string;
  documentType: string;
  sourceReference: string;
  sourceUrl?: string;
  content: string;
  metadata: {
    document_id: string;
    source: string;
    authority: string;
    title: string;
    section: string;
    category: string;
    articles: number[];
    date: string;
    language: string;
    chunk_index: number;
    total_chunks: number;
    url: string;
    [key: string]: any;
  };
}

function getSectionPath(authority: string, documentType: string, reference: string): string {
  if (authority === 'gdpr' && documentType === 'article') {
    const match = reference.match(/Article\s+(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      let chapter = '';
      if (num >= 1 && num <= 4) chapter = 'Chapter I';
      else if (num >= 5 && num <= 11) chapter = 'Chapter II';
      else if (num >= 12 && num <= 23) chapter = 'Chapter III';
      else if (num >= 24 && num <= 43) chapter = 'Chapter IV';
      else if (num >= 44 && num <= 50) chapter = 'Chapter V';
      else if (num >= 51 && num <= 59) chapter = 'Chapter VI';
      else if (num >= 60 && num <= 76) chapter = 'Chapter VII';
      else if (num >= 77 && num <= 84) chapter = 'Chapter VIII';
      else if (num >= 85 && num <= 91) chapter = 'Chapter IX';
      else if (num >= 92 && num <= 98) chapter = 'Chapter X';
      else if (num === 99) chapter = 'Chapter XI';
      return `${chapter} > ${reference}`;
    }
  }
  return reference;
}

function mapSourceAndAuthority(auth: string): { source: string; authority: string } {
  const source = auth;
  let authority = auth;
  if (['gdpr', 'cjeu', 'charter', 'eprivacy'].includes(auth)) {
    authority = 'eu';
  }
  return { source, authority };
}

async function generateEmbedding(text: string) {
  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  const firstEmbedding = response.embeddings?.[0];
  if (!firstEmbedding || !firstEmbedding.values) {
    throw new Error('No embeddings returned from Gemini/Vertex AI');
  }

  const values = firstEmbedding.values;
  if (values.length !== 768) {
    throw new Error(`Expected 768 dimensions, got ${values.length}`);
  }

  return [...values, ...new Array(768).fill(0)];
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
  const eprivacyPath = path.join(corpusDir, 'eprivacy-corpus.json');
  const icoPath = path.join(corpusDir, 'ico-corpus.json');
  const cnilPath = path.join(corpusDir, 'cnil-corpus.json');
  const bfdiPath = path.join(corpusDir, 'bfdi-corpus.json');
  const dpcPath = path.join(corpusDir, 'dpc-corpus.json');
  const apPath = path.join(corpusDir, 'ap-corpus.json');
  const aepdPath = path.join(corpusDir, 'aepd-corpus.json');
  const cjeuPath = path.join(corpusDir, 'cjeu-corpus.json');
  const edpbFinesPath = path.join(corpusDir, 'edpb-fines-corpus.json');
  const gdprhubPath = path.join(corpusDir, 'gdprhub-corpus.json');
  
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

    // Read the scraped ePrivacy Directive
    let eprivacyDocs: CorpusDocument[] = [];
    try {
      const eprivacyData = await fs.readFile(eprivacyPath, 'utf-8');
      eprivacyDocs = JSON.parse(eprivacyData);
      console.log(`Loaded ${eprivacyDocs.length} ePrivacy Directive documents.`);
    } catch {
      console.warn(`ePrivacy Directive corpus file not found at ${eprivacyPath}. Proceeding without ePrivacy documents.`);
    }

    // Read the scraped UK ICO guidelines
    let icoDocs: CorpusDocument[] = [];
    try {
      const icoData = await fs.readFile(icoPath, 'utf-8');
      icoDocs = JSON.parse(icoData);
      console.log(`Loaded ${icoDocs.length} UK ICO guidelines chunks.`);
    } catch {
      console.warn(`UK ICO corpus file not found at ${icoPath}. Proceeding without ICO documents.`);
    }

    // Read the scraped CNIL guidelines
    let cnilDocs: CorpusDocument[] = [];
    try {
      const cnilData = await fs.readFile(cnilPath, 'utf-8');
      cnilDocs = JSON.parse(cnilData);
      console.log(`Loaded ${cnilDocs.length} CNIL French translated guidelines chunks.`);
    } catch {
      console.warn(`CNIL corpus file not found at ${cnilPath}. Proceeding without CNIL documents.`);
    }

    // Read the scraped BfDI guidelines
    let bfdiDocs: CorpusDocument[] = [];
    try {
      const bfdiData = await fs.readFile(bfdiPath, 'utf-8');
      bfdiDocs = JSON.parse(bfdiData);
      console.log(`Loaded ${bfdiDocs.length} BfDI German translated guidelines chunks.`);
    } catch {
      console.warn(`BfDI corpus file not found at ${bfdiPath}. Proceeding without BfDI documents.`);
    }

    // Read the scraped DPC guidelines
    let dpcDocs: CorpusDocument[] = [];
    try {
      const dpcData = await fs.readFile(dpcPath, 'utf-8');
      dpcDocs = JSON.parse(dpcData);
      console.log(`Loaded ${dpcDocs.length} DPC Ireland guidelines chunks.`);
    } catch {
      console.warn(`DPC corpus file not found at ${dpcPath}. Proceeding without DPC documents.`);
    }

    // Read the scraped AP Netherlands guidelines
    let apDocs: CorpusDocument[] = [];
    try {
      const apData = await fs.readFile(apPath, 'utf-8');
      apDocs = JSON.parse(apData);
      console.log(`Loaded ${apDocs.length} AP Netherlands guidelines chunks.`);
    } catch {
      console.warn(`AP Netherlands corpus file not found at ${apPath}. Proceeding without AP Netherlands documents.`);
    }

    // Read the scraped AEPD Spain guidelines
    let aepdDocs: CorpusDocument[] = [];
    try {
      const aepdData = await fs.readFile(aepdPath, 'utf-8');
      aepdDocs = JSON.parse(aepdData);
      console.log(`Loaded ${aepdDocs.length} AEPD Spain guidelines chunks.`);
    } catch {
      console.warn(`AEPD Spain corpus file not found at ${aepdPath}. Proceeding without AEPD Spain documents.`);
    }

    // Read the CJEU rulings
    let cjeuDocs: CorpusDocument[] = [];
    try {
      const cjeuData = await fs.readFile(cjeuPath, 'utf-8');
      cjeuDocs = JSON.parse(cjeuData);
      console.log(`Loaded ${cjeuDocs.length} CJEU rulings chunks.`);
    } catch {
      console.warn(`CJEU rulings corpus file not found at ${cjeuPath}. Proceeding without CJEU rulings.`);
    }

    // Read the EDPB enforcement fines
    let edpbFinesDocs: CorpusDocument[] = [];
    try {
      const edpbFinesData = await fs.readFile(edpbFinesPath, 'utf-8');
      edpbFinesDocs = JSON.parse(edpbFinesData);
      console.log(`Loaded ${edpbFinesDocs.length} EDPB enforcement fines chunks.`);
    } catch {
      console.warn(`EDPB enforcement fines corpus file not found at ${edpbFinesPath}. Proceeding without EDPB fines.`);
    }

    // Read the GDPRhub decisions
    let gdprhubDocs: CorpusDocument[] = [];
    try {
      const gdprhubData = await fs.readFile(gdprhubPath, 'utf-8');
      gdprhubDocs = JSON.parse(gdprhubData);
      console.log(`Loaded ${gdprhubDocs.length} GDPRhub decisions chunks.`);
    } catch {
      console.warn(`GDPRhub decisions corpus file not found at ${gdprhubPath}. Proceeding without GDPRhub decisions.`);
    }

    const allDocs = [
      ...gdprDocs,
      ...recitalsDocs,
      ...edpbDocs,
      ...charterDocs,
      ...eprivacyDocs,
      ...icoDocs,
      ...cnilDocs,
      ...bfdiDocs,
      ...dpcDocs,
      ...apDocs,
      ...aepdDocs,
      ...cjeuDocs,
      ...edpbFinesDocs,
      ...gdprhubDocs
    ];
    console.log(`Total documents/chunks to seed: ${allDocs.length}`);

    // Fetch all existing hashes from the database for the relevant authorities
    console.log("Fetching existing embeddings to check hashes...");
    const existing = await db.select({
      id: documentEmbeddings.id,
      metadata: documentEmbeddings.metadata,
      title: documentEmbeddings.title,
    }).from(documentEmbeddings);

    const existingMap = new Map<string, { id: string; title: string }>();
    for (const item of existing) {
      const meta = item.metadata as any;
      if (meta && meta.content_hash) {
        existingMap.set(meta.content_hash, { id: item.id, title: item.title });
      }
    }

    // Keep track of the hashes we want to keep in the database
    const currentHashes = new Set<string>();
    
    let skippedCount = 0;
    let insertedCount = 0;

    const pendingDocs: CorpusDocument[] = [];
    for (const doc of allDocs) {
      const hash = getHash(doc.content);
      currentHashes.add(hash);
      if (existingMap.has(hash)) {
        skippedCount++;
      } else {
        pendingDocs.push(doc);
      }
    }

    console.log(`Found ${pendingDocs.length} new/modified documents to embed.`);

    const BATCH_SIZE = 15;
    const CONCURRENCY = 10;
    const batches: CorpusDocument[][] = [];
    for (let i = 0; i < pendingDocs.length; i += BATCH_SIZE) {
      batches.push(pendingDocs.slice(i, i + BATCH_SIZE));
    }

    const processBatch = async (batch: CorpusDocument[], batchIndex: number) => {
      const offset = batchIndex * BATCH_SIZE;
      const contents = batch.map(d => d.content);
      
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents,
      });

      const embeddings = response.embeddings;
      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(`Failed to generate embeddings: expected ${batch.length}, got ${embeddings?.length}`);
      }

      const insertValues = [];
      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        if (!doc) continue;
        const hash = getHash(doc.content);
        const values = embeddings[j]?.values;
        if (!values || values.length !== 3072) {
          throw new Error(`Expected 3072 dimensions, got ${values?.length}`);
        }
        const paddedValues = values;

        const { source, authority } = mapSourceAndAuthority(doc.authority);
        const section = getSectionPath(doc.authority, doc.documentType, doc.sourceReference);
        const url = doc.sourceUrl || doc.metadata?.url || '';
        const title = doc.metadata?.title || doc.sourceReference;
        const document_id = doc.metadata?.document_id || `${doc.authority}-${doc.documentType}-${doc.sourceReference.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        insertValues.push({
          documentId: document_id,
          source,
          authority,
          title,
          section,
          category: doc.metadata?.category || 'general',
          articles: doc.metadata?.articles || [],
          content: doc.content,
          embedding: paddedValues,
          metadata: {
            ...doc.metadata,
            content_hash: hash,
          },
          chunkIndex: doc.metadata?.chunk_index ?? 0,
          totalChunks: doc.metadata?.total_chunks ?? 1,
          sourceUrl: url,
          language: doc.metadata?.language || 'en',
        });
      }

      if (insertValues.length > 0) {
        await db.insert(documentEmbeddings).values(insertValues);
      }
      console.log(`Successfully processed batch ${batchIndex + 1}/${batches.length} (offset ${offset})`);
      insertedCount += batch.length;
    };

    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      console.log(`Processing concurrent chunk ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(batches.length / CONCURRENCY)} (batches ${i + 1}-${i + chunk.length})...`);
      await Promise.all(chunk.map((batch, idx) => processBatch(batch, i + idx)));
    }

    console.log(`Incremental Seeding Summary: Skipped (already exists): ${skippedCount}, Generated & Inserted: ${insertedCount}`);

    // Delete any embeddings in the database that are no longer in our corpus files
    const idsToDelete: string[] = [];
    for (const item of existing) {
      const meta = item.metadata as any;
      if (meta && meta.content_hash && !currentHashes.has(meta.content_hash)) {
        idsToDelete.push(item.id);
      }
    }

    if (idsToDelete.length > 0) {
      console.log(`Deleting ${idsToDelete.length} obsolete embeddings from database...`);
      const chunkSize = 100;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        await db.delete(documentEmbeddings).where(
          or(...chunk.map(id => eq(documentEmbeddings.id, id)))
        );
      }
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
