import { generate200Vendors } from '../utils/generateVendors.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Generating 200 vendor JSON files...');
  const vendors = generate200Vendors();
  const outputDir = path.resolve(__dirname, '../../vendors');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const v of vendors) {
    const filePath = path.join(outputDir, `${v.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(v, null, 2), 'utf-8');
  }

  console.log(`Successfully wrote 200 individual vendor JSON profiles to ${outputDir}`);
}

main().catch(err => {
  console.error('Error seeding vendor JSON profiles:', err);
  process.exit(1);
});
