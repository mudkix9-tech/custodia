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
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find "export async function schedule"
  const startIdx = content.indexOf('export async function schedule');
  if (startIdx !== -1) {
    const cleaned = content.substring(0, startIdx).trim() + '\n';
    fs.writeFileSync(filePath, cleaned, 'utf8');
    console.log(`Cleaned ${file}`);
  }
}
