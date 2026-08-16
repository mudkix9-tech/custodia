/**
 * Submits all public/marketing URLs to IndexNow (Bing, Yandex, Seznam, etc.)
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs [--dry-run]
 *
 * IndexNow Protocol:
 *   https://www.indexnow.org/documentation
 */
import fs from 'node:fs';
import path from 'node:path';

const INDEXNOW_KEY = 'a771e3499e4d4cb8abc8eae1651024fd';
const HOST = 'trycustodia.com';
const ORIGIN = `https://${HOST}`;
const KEY_LOCATION = `${ORIGIN}/${INDEXNOW_KEY}.txt`;
const LOCALES = ['en', 'de', 'fr'];
const DEFAULT_LOCALE = 'en';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITEMAP_FILE = path.resolve(__dirname, '../src/app/sitemap.ts');

function getRoutesFromSitemap() {
  const source = fs.readFileSync(SITEMAP_FILE, 'utf8');
  const routes = [''];
  for (const block of source.matchAll(/const\s+\w*ROUTES\s*=\s*\[([\s\S]*?)\]/g)) {
    for (const literal of block[1].matchAll(/'([^']*)'/g)) {
      routes.push(literal[1]);
    }
  }

  // Also include competitor pages
  const compMatch = source.match(/COMPETITOR_SLUGS/);
  if (compMatch) {
    const compFile = path.resolve(__dirname, '../src/app/[locale]/(marketing)/compare/competitors.ts');
    if (fs.existsSync(compFile)) {
      const compSource = fs.readFileSync(compFile, 'utf8');
      for (const literal of compSource.matchAll(/'([a-z0-9-]+)'/g)) {
        routes.push(`/compare/${literal[1]}`);
      }
    }
  }

  return Array.from(new Set(routes));
}

function buildUrl(locale, route) {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${ORIGIN}${prefix}${route}` || ORIGIN;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const routes = getRoutesFromSitemap();
  const urlList = [];

  for (const route of routes) {
    for (const locale of LOCALES) {
      urlList.push(buildUrl(locale, route));
    }
  }

  console.log(`IndexNow Submission`);
  console.log(`-------------------`);
  console.log(`Host:        ${HOST}`);
  console.log(`Key:         ${INDEXNOW_KEY}`);
  console.log(`KeyLocation: ${KEY_LOCATION}`);
  console.log(`Total URLs:  ${urlList.length}\n`);

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  if (isDryRun) {
    console.log('[dry-run] Payload preview:');
    console.log(JSON.stringify({ ...payload, urlList: urlList.slice(0, 5) }, null, 2));
    console.log(`... and ${urlList.length - 5} more URLs.`);
    return;
  }

  const endpoints = [
    'https://api.indexnow.org/IndexNow',
    'https://www.bing.com/indexnow',
  ];

  for (const endpoint of endpoints) {
    console.log(`Submitting to ${endpoint}...`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      console.log(`  Response: HTTP ${res.status} ${res.statusText}`);
      if (res.status === 200 || res.status === 202) {
        console.log(`  ✓ Successfully submitted ${urlList.length} URLs to ${endpoint}`);
      } else {
        const text = await res.text();
        console.warn(`  ! Submission notice (${res.status}): ${text}`);
      }
    } catch (err) {
      console.error(`  ✗ Error submitting to ${endpoint}:`, err.message);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
