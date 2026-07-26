const fs = require('fs');
const path = require('path');

const workersDir = path.join(__dirname, 'apps', 'api', 'src', 'workers');

const filesToClean = [
  'breaches.ts',
  'cmp.ts',
  'compliance.ts',
  'dpiaReminders.ts',
  'dsar.ts',
  'incidents.ts',
  'notifications.ts',
  'policies.ts',
  'regulatoryNotificationWorker.ts',
  'regulatoryScraper.ts',
  'vendors.ts'
];

for (const file of filesToClean) {
  const filePath = path.join(workersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // A robust approach: find 'export async function schedule' and the matching closing brace.
  const startIdx = content.indexOf('export async function schedule');
  if (startIdx !== -1) {
    let braceCount = 0;
    let foundFirstBrace = false;
    let endIdx = -1;
    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (content[i] === '}') {
        braceCount--;
      }

      if (foundFirstBrace && braceCount === 0) {
        endIdx = i;
        break;
      }
    }

    if (endIdx !== -1) {
      const cleaned = content.substring(0, startIdx) + content.substring(endIdx + 1);
      fs.writeFileSync(filePath, cleaned, 'utf8');
      console.log(`Cleaned ${file}`);
    }
  }
}
