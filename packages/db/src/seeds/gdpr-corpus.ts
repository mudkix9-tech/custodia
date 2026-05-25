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
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

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
  try {
    await fs.mkdir(corpusDir, { recursive: true });
    
    // Check if there are files in the corpus directory
    const files = await fs.readdir(corpusDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('No corpus files found in /corpus. Creating a dummy article for testing...');
      const dummyArticle: CorpusDocument = {
        sourceType: 'gdpr_article',
        sourceReference: 'Article 28(1)',
        sourceUrl: 'https://gdpr-info.eu/art-28-gdpr/',
        content: 'Article 28(1) - Processor. Where processing is to be carried out on behalf of a controller, the controller shall use only processors providing sufficient guarantees to implement appropriate technical and organisational measures in such a manner that processing will meet the requirements of this Regulation and ensure the protection of the rights of the data subject.',
        metadata: { chapter: 4, topic: ['processor', 'guarantees'] }
      };
      await fs.writeFile(path.join(corpusDir, 'dummy.json'), JSON.stringify([dummyArticle], null, 2));
      jsonFiles.push('dummy.json');
    }

    for (const file of jsonFiles) {
      console.log(`Processing ${file}...`);
      const fileData = await fs.readFile(path.join(corpusDir, file), 'utf-8');
      const documents: CorpusDocument[] = JSON.parse(fileData);
      
      for (const doc of documents) {
        const hash = getHash(doc.content);
        
        // Check if exists
        const existing = await db.query.documentEmbeddings.findFirst({
          where: eq(documentEmbeddings.contentHash, hash)
        });
        
        if (existing) {
          console.log(`Skipping existing document: ${doc.sourceReference}`);
          continue;
        }

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
    }
    
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Error seeding corpus:', err);
  }
}

// Execute if run directly
if (require.main === module || process.argv[1]?.endsWith('gdpr-corpus.ts')) {
  seedCorpus().then(() => process.exit(0)).catch(() => process.exit(1));
}
