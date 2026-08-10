/**
 * Fails when src/app/sitemap.ts and the actual routes have drifted apart.
 *
 *   npm run check:sitemap --workspace=apps/web
 *
 * Why this exists: the sitemap hardcodes its route lists, and by August 2026 it
 * had drifted in both directions at once. It advertised four URLs that returned
 * 404 (/legal/privacy-policy, /legal/terms-of-service and /legal/cookie-policy
 * had all been renamed; /tools/cookie-checker was never built), and it omitted
 * twelve of the fifteen GDPR guides plus /gdpr, /blog, /enterprise,
 * /legal/subprocessors and /assessment — which was every page on the site with
 * real ranking potential.
 *
 * `tsc` cannot catch either direction: the routes are string literals that
 * happen not to correspond to directories.
 *
 * Two checks run:
 *   1. every route listed in sitemap.ts resolves to a real page file
 *   2. every marketing page is either listed or named in EXCLUDED below
 */
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(process.cwd(), 'src/app');
const LOCALE_DIR = path.join(APP_DIR, '[locale]');
const MARKETING_DIR = path.join(LOCALE_DIR, '(marketing)');
const SITEMAP_FILE = path.join(APP_DIR, 'sitemap.ts');

/**
 * Marketing pages deliberately kept out of the sitemap, each with the reason.
 * A stale entry — one naming a page that no longer exists — fails too, so this
 * map cannot rot quietly.
 */
const EXCLUDED = {
  '/compare/[competitor]':
    'expanded from COMPETITOR_SLUGS in sitemap.ts, one URL per allowlisted competitor',
  '/gdpr/vendors/[slug]':
    'expanded from the vendors table at build time',
  '/blog/[slug]':
    'no post records yet; the three legacy slugs permanently redirect to /gdpr/*',
  '/blog/category/[slug]':
    'thin filtered views of /blog, not worth the crawl budget until there are posts',
};

function walkPages(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walkPages(full));
    } else if (/^page\.(t|j)sx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Turn an absolute page.tsx path into the route it serves, dropping route groups. */
function routeFor(file, baseDir) {
  const rel = path.relative(baseDir, file).replace(/\\/g, '/');
  const segments = rel
    // Optional leading slash: the root page.tsx is relative to baseDir with no
    // directory in front of it.
    .replace(/\/?page\.(t|j)sx?$/, '')
    .split('/')
    .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')));
  return segments.length === 0 ? '' : `/${segments.join('/')}`;
}

if (!fs.existsSync(SITEMAP_FILE)) {
  console.error(`check-sitemap: no sitemap at ${SITEMAP_FILE}`);
  process.exit(1);
}

// Every route literal in the *_ROUTES arrays, plus '' for the homepage, which
// sitemap.ts pushes directly rather than listing in an array.
const source = fs.readFileSync(SITEMAP_FILE, 'utf8');
const listed = new Set(['']);
for (const block of source.matchAll(/const\s+\w*ROUTES\s*=\s*\[([\s\S]*?)\]/g)) {
  for (const literal of block[1].matchAll(/'([^']*)'/g)) listed.add(literal[1]);
}

// All routes that actually exist, across every route group under [locale].
const allRoutes = new Set(walkPages(LOCALE_DIR).map((f) => routeFor(f, LOCALE_DIR)));
const marketingRoutes = walkPages(MARKETING_DIR).map((f) => routeFor(f, MARKETING_DIR));

const errors = [];

// 1. Nothing in the sitemap may 404.
for (const route of listed) {
  if (!allRoutes.has(route)) {
    errors.push(`sitemap lists "${route || '/'}" but no page.tsx serves it`);
  }
}

// 2. Every marketing page is listed, or excluded on purpose.
for (const route of marketingRoutes) {
  if (listed.has(route)) continue;
  if (Object.hasOwn(EXCLUDED, route)) continue;
  errors.push(`marketing page "${route || '/'}" is missing from the sitemap`);
}

// 3. No stale exclusions.
for (const route of Object.keys(EXCLUDED)) {
  if (!marketingRoutes.includes(route)) {
    errors.push(`EXCLUDED names "${route}", which no longer exists — drop the entry`);
  }
}

console.log(
  `Checked ${listed.size} sitemap routes against ${allRoutes.size} real routes ` +
  `(${marketingRoutes.length} marketing pages).`
);

if (errors.length > 0) {
  console.error(`\n${errors.length} sitemap problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    '\nFix by editing the route lists in src/app/sitemap.ts, or by adding an\n' +
    'entry to EXCLUDED in this script with the reason the page stays out.\n'
  );
  process.exit(1);
}

console.log('OK — sitemap and routes agree.');
