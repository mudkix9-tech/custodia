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

  // 1. Swap Worker import with createWorker import if not already present
  if (content.includes("import { Worker")) {
    content = content.replace(/import\s+\{\s*([^}]*?)\bWorker\b([^}]*?)\s*\}\s+from\s+['"]bullmq['"];?/, (match, p1, p2) => {
      const rest = (p1 + p2).split(',').map(s => s.trim()).filter(Boolean);
      if (rest.length > 0) {
        return `import { ${rest.join(', ')} } from 'bullmq';`;
      }
      return '';
    });
  } else {
    // If it imports something like import { Queue, Worker }...
    content = content.replace(/,\s*Worker\s*,?/, ',');
    content = content.replace(/Worker\s*,?/, '');
  }

  if (!content.includes("createWorker")) {
    const importStatement = `import { createWorker } from '../lib/queue.js';\n`;
    content = importStatement + content;
  }

  // 2. Replace `new Worker(` with `createWorker(`
  if (content.includes("new Worker(")) {
    content = content.replace(/new Worker\(/g, 'createWorker(');
    changed = true;
  }

  // 3. Replace { connection } inside the createWorker options ONLY
  // Since options is the 3rd argument to Worker/createWorker, it looks like:
  // createWorker('name', async (job) => { ... }, { connection })
  // We can just regex replace { connection } if it's immediately preceding the closing parenthesis of createWorker
  // Actually, standard regex is hard for this because the function body spans many lines.
  // Instead, let's just replace `{ connection }` with `{ drainDelay: ${drainDelay} }`
  // BUT ONLY IF it's not being used by a Queue!
  
  // Let's manually replace it using string split by `createWorker(`
  if (changed) {
    const parts = content.split('createWorker(');
    for (let i = 1; i < parts.length; i++) {
       // look for `{ connection }` near the end of this part (which corresponds to the options object)
       // We can just find the LAST `{ connection }` in this part.
       // Or even safer: Since they literally end with `}, { connection });`, let's just do that replacement!
       parts[i] = parts[i].replace(/},\s*\{\s*connection\s*\}\s*\);/g, `}, { drainDelay: ${drainDelay} });`);
       // What if it is `}, { connection, concurrency: 5 });` ?
       parts[i] = parts[i].replace(/\{\s*connection\s*,?/g, `{ drainDelay: ${drainDelay}, `);
       
       // Clean up any trailing commas like `{ drainDelay: X, }`
       parts[i] = parts[i].replace(/,\s*\}/g, ' }');
    }
    content = parts.join('createWorker(');
  }
  
  // Wait, if it's an inline worker like:
  // createWorker('name', async job => { ... }, { connection });
  // The regex `/\{\s*connection\s*,?/g` inside the `parts[i]` will hit it.
  // BUT it might also hit a Queue instantiation inside the worker block!
  // To avoid breaking Queue, we'll just leave `const connection = createRedisClient(...)` in the file.
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file} with drainDelay ${drainDelay}`);
  }
}
