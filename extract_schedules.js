const fs = require('fs');
const path = require('path');

const workersDir = path.join(__dirname, 'apps', 'api', 'src', 'workers');
const files = fs.readdirSync(workersDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

let allSchedules = [];

for (const file of files) {
  const filePath = path.join(workersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Look for getRepeatableJobs or schedule functions and remove them.
  // We can just find the `export async function schedule...() { ... }` block
  // and extract the cron patterns.

  const scheduleFuncRegex = /export\s+async\s+function\s+schedule[A-Za-z]+Jobs\s*\(\)\s*\{([\s\S]*?)\n\}/g;
  
  let hasChanges = false;
  
  let match;
  while ((match = scheduleFuncRegex.exec(content)) !== null) {
    hasChanges = true;
    const body = match[1];
    
    // Extract queue name, job name, cron pattern
    // e.g. await vendorJobsQueue.add('sub-processor-change-detector', {}, { repeat: { pattern: '0 0 * * *' } });
    const addRegex = /await\s+([A-Za-z0-9_]+)\.add\('([^']+)',\s*[^,]+,\s*\{\s*repeat:\s*\{\s*pattern:\s*'([^']+)'\s*\}\s*\}\s*\);/g;
    let addMatch;
    while ((addMatch = addRegex.exec(body)) !== null) {
      allSchedules.push({
        queue: addMatch[1].replace('Queue', '').replace('Jobs', '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(), // approximate queue name
        jobName: addMatch[2],
        cron: addMatch[3],
        file: file
      });
    }

    // cmp.ts has setInterval
    if (file === 'cmp.ts' && body.includes('setInterval')) {
       allSchedules.push({
         queue: 'cmp-automation',
         jobName: 'consent-batch-insert-interval',
         cron: 'interval:5000',
         file: file
       });
       // Extract schedule
       const schRegex = /await\s+boss\.schedule\('([^']+)',\s*'([^']+)',\s*\{\s*name:\s*'([^']+)'/g;
       let schMatch;
       while ((schMatch = schRegex.exec(body)) !== null) {
         allSchedules.push({ queue: schMatch[1], jobName: schMatch[3], cron: schMatch[2], file: file });
       }
    }
  }

  // Remove the function
  if (hasChanges) {
    content = content.replace(/export\s+async\s+function\s+schedule[A-Za-z]+Jobs\s*\(\)\s*\{[\s\S]*?\n\}\n*/g, '');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Removed schedule function from ${file}`);
  }
}

// Dump extracted schedules
fs.writeFileSync('schedules.json', JSON.stringify(allSchedules, null, 2));
console.log('Saved schedules.json');
