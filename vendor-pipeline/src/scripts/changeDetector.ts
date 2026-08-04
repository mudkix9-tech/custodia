import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtractionConfig {
  cssSelector?: string;
  usePdf?: boolean;
}

export function cleanAndNormalizeHtml(html: string, selector?: string): string {
  // If we have a custom selector, extract it (simplistic regex-based extraction for standalone stability)
  let content = html;
  if (selector && selector.startsWith('#')) {
    const id = selector.slice(1);
    const regex = new RegExp(`<[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
    const match = regex.exec(html);
    if (match && match[1]) {
      content = match[1];
    }
  }

  // Remove boilerplate headers, footers, scripts, styles, etc.
  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' '); // Strip HTML tags

  // Collapse whitespace
  return content
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchAndHash(url: string, config: ExtractionConfig, cachePath?: string): Promise<{ text: string; hash: string }> {
  let bodyText = '';

  // Return cached content if available to keep dev/CI deterministic and fast
  if (cachePath && fs.existsSync(cachePath)) {
    bodyText = fs.readFileSync(cachePath, 'utf-8');
  } else {
    if (config.usePdf || url.endsWith('.pdf')) {
      // Mock reading pdf binary fallback
      const response = await fetch(url);
      bodyText = await response.text();
    } else {
      try {
        // Puppeteer fallback for JS-heavy legal pages
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        bodyText = await page.content();
        await browser.close();
      } catch (err) {
        // HTTP GET fallback if Puppeteer fails or runs in restricted envs
        const response = await fetch(url);
        bodyText = await response.text();
      }
    }

    if (cachePath) {
      fs.writeFileSync(cachePath, bodyText, 'utf-8');
    }
  }

  const cleaned = cleanAndNormalizeHtml(bodyText, config.cssSelector);
  const hash = crypto.createHash('sha256').update(cleaned).digest('hex');

  return { text: cleaned, hash };
}

async function runChangeDetector() {
  console.log('--- CHANGE DETECTOR RUNNING ---');
  const vendorsDir = path.resolve(__dirname, '../../vendors');
  const cacheDir = path.resolve(__dirname, '../../cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const files = fs.readdirSync(vendorsDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const vendorPath = path.join(vendorsDir, file);
    const vendor = JSON.parse(fs.readFileSync(vendorPath, 'utf-8'));

    if (!vendor.dpaUrl) continue;

    console.log(`Checking change detector for ${vendor.name}...`);
    const cacheFile = path.join(cacheDir, `${vendor.slug}-dpa.cache`);
    const config: ExtractionConfig = {
      cssSelector: vendor.cssSelector,
      usePdf: vendor.dpaUrl.endsWith('.pdf')
    };

    try {
      const { text, hash } = await fetchAndHash(vendor.dpaUrl, config, cacheFile);
      if (vendor.lastDpaHash && vendor.lastDpaHash !== hash) {
        console.log(`[ALERT] DPA Hash changed for ${vendor.name}!`);
        // Trigger diff renderer
        const { queueReview } = await import('./diffRenderer.js');
        await queueReview(vendor.name, vendor.slug, vendor.lastDpaText || '', text);

        vendor.lastDpaHash = hash;
        vendor.lastDpaText = text;
        vendor.automatedVerifiedAt = new Date().toISOString();
        fs.writeFileSync(vendorPath, JSON.stringify(vendor, null, 2), 'utf-8');
      } else if (!vendor.lastDpaHash) {
        // Set baseline
        vendor.lastDpaHash = hash;
        vendor.lastDpaText = text;
        fs.writeFileSync(vendorPath, JSON.stringify(vendor, null, 2), 'utf-8');
        console.log(`Baseline DPA Hash set for ${vendor.name}`);
      }
    } catch (err: any) {
      console.error(`Failed change detection for ${vendor.name}: ${err.message}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runChangeDetector().catch(err => console.error(err));
}
