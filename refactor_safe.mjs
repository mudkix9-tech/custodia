import fs from 'fs';
import path from 'path';

const workersDir = path.join(process.cwd(), 'apps', 'api', 'src', 'workers');

const highPriority = [
  'dsar.ts',
  'emails.ts',
  'impactAssessmentWorker.ts',
  'webhooks.ts',
  'notifications.ts',
];

const lowPriority = [
  'breaches.ts',
  'cmp.ts',
  'compliance.ts',
  'dataMigration.ts',
  'dpiaReminders.ts',
  'incidents.ts',
  'policies.ts',
  'regulatoryScraper.ts',
  'regulatoryNotificationWorker.ts',
  'residencyProvisioner.ts',
  'vendors.ts',
];

const files = [...highPriority, ...lowPriority];

for (const file of files) {
  const filePath = path.join(workersDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  const drainDelay = highPriority.includes(file) ? 15 : 60;

  // Add createWorker import if missing
  if (!content.includes("createWorker")) {
    const importStatement = `import { createWorker } from '../lib/queue.js';\n`;
    content = importStatement + content;
    changed = true;
  }

  // Find where new Worker( is being called.
  // The structure is usually `export const nameWorker = new Worker('name', async (job) => { ... }, { connection });`
  // We can just regex replace `new Worker(` with `createWorker(`
  if (content.includes('new Worker(')) {
    content = content.replace(/new Worker\(/g, 'createWorker(');
    changed = true;
  }

  // Fix the options object for createWorker
  // We need to find `createWorker(..., { connection })` and replace ONLY the options object of createWorker
  // The simplest way is to look for the end of the Worker definition which is typically:
  // `}, { connection });` or `}, process.env.NODE_ENV === 'test' ? { connection: null as any } : { connection });`
  // Since we changed it to `createWorker`, we can look for `}, { connection });`
  content = content.replace(/\},\s*\{\s*connection(?:\s*:\s*connection)?\s*\}\s*\);/g, `}, { drainDelay: ${drainDelay} });`);
  
  // Handing the specific vendors.ts case
  content = content.replace(/\},\s*process\.env\.NODE_ENV === 'test'\s*\?\s*\{\s*connection\s*:\s*null as any\s*\}\s*:\s*\{\s*connection\s*\}\s*\);/g, `}, { drainDelay: ${drainDelay} });`);

  // Handling cases where it might be `}, { connection: connection || undefined });`
  content = content.replace(/\},\s*\{\s*connection:\s*connection \|\| undefined\s*\}\s*\);/g, `}, { drainDelay: ${drainDelay} });`);

  // Handling cases where connection was passed as `redis` (like webhooks.ts)
  content = content.replace(/\},\s*\{\s*connection\s*:\s*redis\s*\}\s*\);/g, `}, { drainDelay: ${drainDelay} });`);

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
