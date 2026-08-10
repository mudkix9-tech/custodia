/**
 * Fails when a Next.js route file declares `params` or `searchParams` as a plain
 * object instead of a Promise.
 *
 *   npm run check:params --workspace=apps/web
 *
 * Why this exists: Next 16 removed synchronous access to these (deprecated but
 * working in 15). A page typed `{ params: { id: string } }` renders fine and reads
 * `params.id` as `undefined`, so the data query silently gets nothing.
 *
 * `tsc` cannot catch it — the page declares that type itself, so there is nothing
 * to disagree with, and apps/web reports 0 errors either way. Four pages were
 * broken this way in August 2026, two of them public: the DSAR request form and
 * the published privacy notice.
 *
 * Only route files are checked (page/layout/route/template/default/*-image), since
 * those are the ones Next passes the promise to. A client component that receives
 * an already-awaited object as a prop is correct with the plain type.
 */
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(process.cwd(), 'src/app');

const ROUTE_FILES = /^(page|layout|route|template|default|opengraph-image|twitter-image|icon|apple-icon)\.(t|j)sx?$/;

// `params: {` or `searchParams: {` — a Promise annotation reads `params: Promise<`.
const SYNC_PARAMS = /\b(params|searchParams)\s*:\s*\{/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walk(full));
    } else if (ROUTE_FILES.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

if (!fs.existsSync(APP_DIR)) {
  console.error(`check-async-params: no app directory at ${APP_DIR}`);
  process.exit(1);
}

const routeFiles = walk(APP_DIR);
const findings = [];

for (const file of routeFiles) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!SYNC_PARAMS.test(line)) return;
    findings.push({
      file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      line: i + 1,
      text: line.trim(),
    });
  });
}

console.log(`Checked ${routeFiles.length} route files for synchronous params.`);

if (findings.length > 0) {
  console.error(`\n${findings.length} synchronous params declaration(s):\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}\n    ${f.text}`);
  console.error(
    '\nNext 16 passes a Promise. Make the function async and await it:\n' +
    '  export default async function Page({ params }: { params: Promise<{ id: string }> }) {\n' +
    '    const { id } = await params;\n'
  );
  process.exit(1);
}

console.log('OK — every route file awaits params.');
