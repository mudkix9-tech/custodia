import * as dotenv from 'dotenv';
dotenv.config({ path: '../../../.env' });
import { db } from '../db.js';
import { calculateComplianceScore } from './scoring.js';
import { organizations } from 'db';

async function run() {
  const org = await db.query.organizations.findFirst();
  if (!org) {
    console.log("No organization found. Cannot benchmark.");
    process.exit(0);
  }

  console.log(`Benchmarking calculateComplianceScore for org: ${org.id}`);
  
  // Warmup
  await calculateComplianceScore(org.id);

  const start = performance.now();
  let iterations = 10;
  for (let i = 0; i < iterations; i++) {
    await calculateComplianceScore(org.id);
  }
  const end = performance.now();

  console.log(`Average time over ${iterations} runs: ${((end - start) / iterations).toFixed(2)}ms`);
  process.exit(0);
}

run().catch(console.error);
