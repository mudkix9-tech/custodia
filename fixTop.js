const fs = require('fs');
const path = 'c:/Users/nisar/Desktop/GDPR/packages/db/src/seed-assessment.ts';
let code = fs.readFileSync(path, 'utf8');

const replacement = `import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import crypto from 'crypto';
import { assessmentTemplates, assessments, assessmentAnswers, actionItems, pendingSignups } from './schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

function getDeterministicId(slug: string) {
  if (!slug) throw new Error('Slug is required for deterministic UUIDs');
  const hash = crypto.createHash('sha1').update(slug).digest('hex');
  return \`\${hash.slice(0,8)}-\${hash.slice(8,12)}-4\${hash.slice(13,16)}-a\${hash.slice(17,20)}-\${hash.slice(20,32)}\`;
}

const healthQId = getDeterministicId('client-compliance-q1');
const paymentQId = getDeterministicId('client-compliance-q4');
`;

const dbIndex = code.indexOf('const db = drizzle(pool);');
const afterDbIndex = code.indexOf('const healthQId', dbIndex); // Actually, let's just find `const questions = [`
const questionsIndex = code.indexOf('const questions = [');

code = replacement + '\n' + code.substring(questionsIndex);

fs.writeFileSync(path, code);
console.log('Fixed top of file');
