import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportVendors() {
  console.log('--- AGGREGATING AND EXPORTING ALL VENDORS ---');
  const vendorsDir = path.resolve(__dirname, '../../vendors');
  const outputDir = path.resolve(__dirname, '../../../'); // root of monorepo / desired seed directory
  const files = fs.readdirSync(vendorsDir);

  const aggregated: any[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const vendorPath = path.join(vendorsDir, file);
    const vendor = JSON.parse(fs.readFileSync(vendorPath, 'utf-8'));
    aggregated.push(vendor);
  }

  // Write single aggregated vendors.json inside pipeline
  fs.writeFileSync(path.resolve(__dirname, '../../vendors.json'), JSON.stringify(aggregated, null, 2), 'utf-8');

  // Also write vendors.json to the workspace seed resource directory for Custodia
  fs.writeFileSync(path.join(outputDir, 'vendors.json'), JSON.stringify(aggregated, null, 2), 'utf-8');

  console.log(`Aggregation complete. Successfully aggregated ${aggregated.length} vendor profiles into single 'vendors.json' at pipeline & workspace roots.`);
}

exportVendors().catch(err => {
  console.error('Error during vendor aggregation export:', err);
  process.exit(1);
});
export {};
